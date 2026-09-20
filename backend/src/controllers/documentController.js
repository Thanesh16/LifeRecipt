import fs from 'fs';
import path from 'path';
import Document from '../models/Document.js';
import Product from '../models/Product.js';
import { processDocumentWithAI } from '../services/aiExtractionService.js';
import documentIntelligenceService from '../services/documentIntelligenceService.js';
import securityAuditService from '../services/securityAuditService.js';
import timelineService from '../services/timelineService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * @desc    Upload receipt or invoice document & trigger full intelligence pipeline
 * @route   POST /api/v1/documents/upload-and-extract
 * @access  Private
 */
export const uploadAndExtract = async (req, res, next) => {
  const reqStartTime = Date.now();
  try {
    if (!req.file) {
      return sendError(res, 'Please upload a valid receipt or invoice file (JPG, PNG, PDF).', 400);
    }

    const userId = req.user._id;
    const { documentType = 'RECEIPT', productId = null } = req.body;
    const fileSizeKb = (req.file.size / 1024).toFixed(1);
    console.log(`[Document] Upload received: ${req.file.originalname} (${fileSizeKb} KB)`);

    // 1. Compute SHA-256 file hash
    const fileHash = documentIntelligenceService.computeFileHash(req.file.path);

    // 2. Extract multi-page text
    if (req.file.mimetype === 'application/pdf') {
      console.log('[Document] PDF processing started');
    }
    const { pageCount, pages, fullText } = await documentIntelligenceService.extractMultiPageText(
      req.file.path,
      req.file.mimetype
    );
    console.log(`[Document] OCR completed: ${pageCount} page(s), ${fullText ? fullText.length : 0} chars`);

    // 3. Classify document
    const classification = documentIntelligenceService.classifyDocument(
      fullText,
      req.file.originalname,
      documentType
    );
    console.log(`[Document] Document classified as: ${classification.detectedType} (confidence: ${classification.confidence}%)`);

    const effectiveType = (classification.isConfident && classification.confidence >= 0.75)
      ? classification.detectedType
      : (documentType && documentType !== 'ALL' ? documentType : classification.detectedType);

    // 4. Extract structured fields with field-level confidence
    const structuredFields = documentIntelligenceService.extractStructuredFields(
      fullText,
      effectiveType,
      pages
    );

    // 5. Intelligent AI multi-modal extraction (Gemini / OpenAI)
    let aiProviderConfigured = false;
    let aiProvider = 'deterministic';
    let aiModelUsed = 'deterministic-regex-fallback';
    console.log('[Document] Gemini extraction started');
    const aiStartTime = Date.now();
    try {
      const aiResult = await processDocumentWithAI({
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      });

      if (aiResult) {
        aiProviderConfigured = aiResult.aiProviderConfigured;
        aiProvider = aiResult.aiProvider;
        aiModelUsed = aiResult.aiModelUsed || aiProvider;
        const aiDurationMs = Date.now() - aiStartTime;
        console.log(`[Document] Gemini extraction completed in ${aiDurationMs}ms (model: ${aiModelUsed})`);

        const aiData = aiResult.extractedData;
        if (aiData) {
          const paginationRegex = /^(--\s*\d+\s*(?:of|\/)\s*\d+\s*--|page\s*\d+\s*(?:of|\/)\s*\d+|\d+\s*of\s*\d+)$/i;

          // Merge clean product name (never allow pagination or noise)
          if (aiData.productName && !paginationRegex.test(aiData.productName.trim())) {
            structuredFields.productName = aiData.productName.trim();
          }

          if (aiData.productDescription) {
            structuredFields.productDescription = aiData.productDescription;
          }

          if (aiData.products && Array.isArray(aiData.products) && aiData.products.length > 0) {
            structuredFields.products = aiData.products;
          }

          if (aiData.brand) structuredFields.brand = aiData.brand;
          if (aiData.model) structuredFields.model = aiData.model;
          if (aiData.category) structuredFields.category = aiData.category;
          if (aiData.serialNumber) structuredFields.serialNumber = aiData.serialNumber;
          if (aiData.purchaseDate) structuredFields.purchaseDate = aiData.purchaseDate;

          // Only override purchasePrice if explicitly detected or null
          if (aiData.purchasePrice !== undefined) {
            structuredFields.purchasePrice = aiData.purchasePrice;
          }

          if (aiData.currency) structuredFields.currency = aiData.currency;
          if (aiData.sellerName) structuredFields.sellerName = aiData.sellerName;
          if (aiData.invoiceNumber) structuredFields.invoiceNumber = aiData.invoiceNumber;
          if (aiData.quantity) structuredFields.quantity = aiData.quantity;
          if (aiData.taxInfo) structuredFields.taxInfo = aiData.taxInfo;

          // Merge warranty
          if (aiData.warranty && (aiData.warranty.hasWarranty || aiData.warranty.durationMonths)) {
            structuredFields.warranty = {
              ...structuredFields.warranty,
              ...aiData.warranty,
            };
          }

          // Merge return info
          if (aiData.returnInfo && aiData.returnInfo.returnEligible) {
            structuredFields.returnInfo = {
              ...structuredFields.returnInfo,
              ...aiData.returnInfo,
            };
          }

          // Update confidence map from AI assessments
          const confScoreMap = { High: 0.95, Medium: 0.80, Low: 0.60, Unknown: 0.20 };
          if (aiData.confidence) {
            for (const [fKey, confLevel] of Object.entries(aiData.confidence)) {
              if (structuredFields.fieldConfidence && confScoreMap[confLevel]) {
                structuredFields.fieldConfidence[fKey] = {
                  value: structuredFields[fKey] !== undefined ? structuredFields[fKey] : aiData[fKey],
                  confidence: confScoreMap[confLevel],
                  source: `AI (${aiModelUsed})`,
                };
              }
            }
          }
        }
      }
    } catch (aiErr) {
      console.warn(`[AI Secondary Extraction Notice] ${aiErr.message}`);
    }

    // 6. Check for duplicate document in user vault
    const duplicateWarning = await documentIntelligenceService.detectDuplicateDocument(
      userId,
      fileHash,
      structuredFields
    );

    // 7. Check product matching and conflict detection with enriched data
    let matchedProduct = {
      productId: null,
      confidence: 0,
      matchReason: 'Unlinked document',
      matchType: 'NONE',
      candidateProducts: [],
    };
    let conflicts = [];

    if (productId) {
      const existingProduct = await Product.findOne({ _id: productId, userId });
      if (existingProduct) {
        matchedProduct = {
          productId: existingProduct._id,
          confidence: 1.0,
          matchReason: 'Directly linked by user',
          matchType: 'EXACT',
          candidateProducts: [],
        };
        conflicts = documentIntelligenceService.detectConflicts(existingProduct, structuredFields);
      }
    } else {
      matchedProduct = await documentIntelligenceService.matchDocumentToProducts(userId, structuredFields);
      if (matchedProduct.productId) {
        const topProduct = await Product.findOne({ _id: matchedProduct.productId, userId });
        if (topProduct) {
          conflicts = documentIntelligenceService.detectConflicts(topProduct, structuredFields);
        }
      }
    }
    console.log('[Document] Validation & matching completed');

    // 8. Persist Document record in MongoDB
    const docRecord = await Document.create({
      userId,
      productId: productId || (matchedProduct.matchType === 'EXACT' ? matchedProduct.productId : null),
      documentType: effectiveType,
      source: 'UPLOAD',
      fileName: req.file.originalname,
      storagePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      fileHash,
      pageCount,
      pages,
      ocrText: fullText || '',
      classification,
      extractedData: {
        ...structuredFields,
        confidence: Object.fromEntries(
          Object.entries(structuredFields.fieldConfidence || {}).map(([k, v]) => [k, String(v.confidence)])
        ),
      },
      fieldConfidence: structuredFields.fieldConfidence,
      missingFields: structuredFields.missingFields,
      conflicts,
      matchedProduct,
      duplicateWarning,
      aiModelUsed,
      status: 'PROCESSED',
    });
    console.log(`[Document] Document record persisted in MongoDB: ${docRecord._id}`);

    // 9. Log security audit event
    await securityAuditService.logEvent({
      userId,
      email: req.user.email,
      action: 'DOCUMENT_UPLOAD',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        documentId: docRecord._id,
        fileName: docRecord.fileName,
        documentType: docRecord.documentType,
        fileSize: docRecord.fileSize,
      },
    });

    // 10. Record DOCUMENT_ADDED timeline event if attached to an existing product
    const targetProdId = docRecord.productId;
    if (targetProdId) {
      try {
        const productExists = await Product.findOne({ _id: targetProdId, userId });
        if (productExists) {
          await timelineService.recordEvent({
            userId,
            productId: targetProdId,
            eventType: 'DOCUMENT_ADDED',
            title: 'Document Added',
            description: `${docRecord.documentType.replace('_', ' ')} added: ${docRecord.fileName}`,
            eventDate: docRecord.createdAt || new Date(),
            source: 'SYSTEM',
            relatedDocumentId: docRecord._id,
            metadata: {
              fileName: docRecord.fileName,
              fileSize: docRecord.fileSize,
              documentType: docRecord.documentType,
            },
          });
        }
      } catch (tErr) {
        console.error('[Timeline Event Error] Failed to record document added event:', tErr);
      }
    }

    const totalMs = Date.now() - reqStartTime;
    console.log(`[Document] Response returned in ${totalMs}ms`);

    return sendSuccess(
      res,
      {
        document: docRecord,
        classification,
        extractedData: docRecord.extractedData,
        fieldConfidence: docRecord.fieldConfidence,
        missingFields: docRecord.missingFields,
        conflicts: docRecord.conflicts,
        matchedProduct: docRecord.matchedProduct,
        duplicateWarning: docRecord.duplicateWarning,
        aiProviderConfigured,
        aiProvider,
        statusMessage: duplicateWarning.isDuplicate ? duplicateWarning.duplicateReason : null,
      },
      'Document uploaded and processed successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm extracted data from review screen and create the Product record
 * @route   POST /api/v1/documents/confirm-product
 * @access  Private
 */
export const confirmAndCreateProduct = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { documentId, productData } = req.body;

    if (!productData || !productData.productName?.trim()) {
      return sendError(res, 'Product name is required to confirm creation.', 400);
    }

    // 1. Verify document ownership if documentId is provided
    let document = null;
    if (documentId) {
      document = await Document.findOne({ _id: documentId, userId });
      if (!document) {
        return sendError(res, 'Document not found or access denied.', 404);
      }
    }

    // 2. Create Product record
    const newProduct = await Product.create({
      userId,
      productName: productData.productName.trim(),
      productDescription: productData.productDescription?.trim() || '',
      category: productData.category || 'Other',
      brand: productData.brand?.trim() || '',
      model: productData.model?.trim() || '',
      serialNumber: productData.serialNumber?.trim() || '',
      purchaseDate: productData.purchaseDate ? new Date(productData.purchaseDate) : Date.now(),
      purchasePrice: typeof productData.purchasePrice === 'number' ? Math.max(0, productData.purchasePrice) : Number(productData.purchasePrice) || 0,
      currency: productData.currency || req.user.preferences?.currency || 'INR',
      sellerName: productData.sellerName?.trim() || '',
      sellerContact: productData.sellerContact?.trim() || '',
      warranty: {
        hasWarranty: Boolean(productData.warranty?.hasWarranty),
        warrantyStartDate: productData.warranty?.warrantyStartDate ? new Date(productData.warranty.warrantyStartDate) : undefined,
        warrantyEndDate: productData.warranty?.warrantyEndDate ? new Date(productData.warranty.warrantyEndDate) : undefined,
        warrantyProvider: productData.warranty?.warrantyProvider?.trim() || '',
        warrantyType: productData.warranty?.warrantyType || 'None',
      },
      returnInfo: {
        returnEligible: Boolean(productData.returnInfo?.returnEligible),
        returnStartDate: productData.returnInfo?.returnStartDate ? new Date(productData.returnInfo.returnStartDate) : undefined,
        returnEndDate: productData.returnInfo?.returnEndDate ? new Date(productData.returnInfo.returnEndDate) : undefined,
        returnPolicyNotes: productData.returnInfo?.returnPolicyNotes?.trim() || '',
      },
      notes: productData.notes?.trim() || (productData.invoiceNumber ? `Invoice #: ${productData.invoiceNumber}` : ''),
      status: productData.status || 'Active',
    });

    // 3. Associate document with the new product
    if (document) {
      document.productId = newProduct._id;
      document.status = 'CONFIRMED';
      if (productData.documentType) {
        document.documentType = productData.documentType;
      }
      await document.save();
    }

    // Record automatic Phase 5 ownership timeline events
    try {
      await timelineService.recordProductCreationEvents(newProduct, document);
    } catch (timelineErr) {
      console.error('[Timeline Event Error] Failed to record confirmed product creation events:', timelineErr);
    }

    return sendSuccess(
      res,
      {
        product: newProduct,
        document,
      },
      'Product successfully confirmed and linked to document',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all documents owned by authenticated user
 * @route   GET /api/v1/documents
 * @access  Private
 */
export const getDocuments = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { productId, documentType } = req.query;

    const filter = { userId };
    if (productId) filter.productId = productId;
    if (documentType && documentType !== 'ALL') filter.documentType = documentType;

    const documents = await Document.find(filter)
      .populate('productId', 'productName category brand model serialNumber')
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(
      res,
      {
        count: documents.length,
        documents,
      },
      'Documents retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single document metadata
 * @route   GET /api/v1/documents/:id
 * @access  Private
 */
export const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('productId', 'productName category brand model serialNumber');

    if (!document) {
      return sendError(res, 'Document not found or access denied.', 404);
    }

    return sendSuccess(res, document, 'Document retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Stream or download document file securely
 * @route   GET /api/v1/documents/:id/file
 * @access  Private
 */
export const downloadDocumentFile = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return sendError(res, 'Document not found or access denied.', 404);
    }

    if (!fs.existsSync(document.storagePath)) {
      return sendError(res, 'Document file not found on disk storage.', 404);
    }

    const { download = 'false' } = req.query;
    const disposition = download === 'true' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(document.fileName)}"`
    );
    res.setHeader('Content-Length', document.fileSize);

    const fileStream = fs.createReadStream(document.storagePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete document record and file on disk
 * @route   DELETE /api/v1/documents/:id
 * @access  Private
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return sendError(res, 'Document not found or access denied.', 404);
    }

    // Attempt to remove file from disk
    if (fs.existsSync(document.storagePath)) {
      try {
        fs.unlinkSync(document.storagePath);
      } catch (fileErr) {
        console.warn(`[File Cleanup Warning] Could not remove disk file: ${fileErr.message}`);
      }
    }

    // Record security audit event
    await securityAuditService.logEvent({
      userId: req.user._id,
      email: req.user.email,
      action: 'DOCUMENT_DELETE',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        documentId: document._id,
        fileName: document.fileName,
      },
    });

    return sendSuccess(res, { id: req.params.id }, 'Document deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reprocess document with updated classification or extraction
 * @route   POST /api/v1/documents/:id/reprocess
 * @access  Private
 */
export const reprocessDocument = async (req, res, next) => {
  const reprocessStartTime = Date.now();
  try {
    const userId = req.user._id;
    const document = await Document.findOne({ _id: req.params.id, userId });

    if (!document) {
      return sendError(res, 'Document not found or access denied.', 404);
    }

    const { documentType = document.documentType } = req.body;
    console.log(`[Document] Reprocessing started for document: ${document._id} (${document.fileName}), targetType: ${documentType}`);
    document.documentType = documentType;

    // Re-extract structured fields based on updated type
    const structuredFields = documentIntelligenceService.extractStructuredFields(
      document.ocrText,
      documentType,
      document.pages
    );

    document.extractedData = {
      ...structuredFields,
      confidence: Object.fromEntries(
        Object.entries(structuredFields.fieldConfidence || {}).map(([k, v]) => [k, String(v.confidence)])
      ),
    };
    document.fieldConfidence = structuredFields.fieldConfidence;
    document.missingFields = structuredFields.missingFields;

    // Re-run conflict check if attached to product
    if (document.productId) {
      const prod = await Product.findOne({ _id: document.productId, userId });
      if (prod) {
        document.conflicts = documentIntelligenceService.detectConflicts(prod, structuredFields);
      }
    }

    await document.save();
    console.log(`[Document] Reprocessing completed in ${Date.now() - reprocessStartTime}ms for document: ${document._id}`);

    return sendSuccess(res, document, 'Document reprocessed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Link document to an existing product with conflict detection
 * @route   POST /api/v1/documents/:id/link-product
 * @access  Private
 */
export const linkProduct = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    if (!productId) {
      return sendError(res, 'Product ID is required.', 400);
    }

    const [document, product] = await Promise.all([
      Document.findOne({ _id: req.params.id, userId }),
      Product.findOne({ _id: productId, userId }),
    ]);

    if (!document) {
      return sendError(res, 'Document not found or access denied.', 404);
    }
    if (!product) {
      return sendError(res, 'Target product not found or access denied.', 404);
    }

    document.productId = product._id;
    document.status = 'CONFIRMED';
    document.conflicts = documentIntelligenceService.detectConflicts(product, document.extractedData);
    await document.save();

    // Log timeline event
    try {
      await timelineService.recordEvent({
        userId,
        productId: product._id,
        eventType: 'DOCUMENT_ADDED',
        title: 'Document Linked',
        description: `${document.documentType.replace('_', ' ')} linked to product: ${document.fileName}`,
        eventDate: new Date(),
        source: 'SYSTEM',
        relatedDocumentId: document._id,
      });
    } catch (tErr) {
      console.warn('[Timeline Warning] Failed to log link event:', tErr.message);
    }

    return sendSuccess(res, document, 'Document successfully linked to product');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update extracted metadata directly during user review
 * @route   PATCH /api/v1/documents/:id/extracted-data
 * @access  Private
 */
export const updateExtractedData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const document = await Document.findOne({ _id: req.params.id, userId });

    if (!document) {
      return sendError(res, 'Document not found or access denied.', 404);
    }

    const { extractedData } = req.body;
    if (extractedData && typeof extractedData === 'object') {
      for (const [key, value] of Object.entries(extractedData)) {
        if (value !== undefined) {
          document.extractedData[key] = value;
        }
      }
      document.markModified('extractedData');

      // Re-evaluate conflicts if linked to product
      if (document.productId) {
        const prod = await Product.findOne({ _id: document.productId, userId });
        if (prod) {
          document.conflicts = documentIntelligenceService.detectConflicts(prod, document.extractedData);
        }
      }

      await document.save();
    }

    return sendSuccess(res, document, 'Extracted data updated successfully');
  } catch (error) {
    next(error);
  }
};
