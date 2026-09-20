import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import EmailConnection from '../../models/EmailConnection.js';
import EmailReceipt from '../../models/EmailReceipt.js';
import Product from '../../models/Product.js';
import Document from '../../models/Document.js';
import OwnershipEvent from '../../models/OwnershipEvent.js';
import emailProviderFactory from './emailProviderFactory.js';
import { encryptToken, decryptToken } from '../../utils/cryptoUtils.js';
import { processDocumentWithAI, parseDeterministicReceipt } from '../aiExtractionService.js';
import timelineService from '../timelineService.js';
import env from '../../config/env.js';

/**
 * LIFERECEIPT Email Intelligence Service
 * Handles email connection management, incremental synchronization, attachment analysis,
 * Indian GST parsing, duplicate checking, and user review confirmation.
 */
class EmailIntelligenceService {
  constructor() {
    this.attachmentDir = path.resolve(env.UPLOAD_DIR, 'email_attachments');
    if (!fs.existsSync(this.attachmentDir)) {
      fs.mkdirSync(this.attachmentDir, { recursive: true });
    }
  }

  /**
   * Connect an email provider with explicit user authorization
   */
  async connectProvider({
    userId,
    provider,
    emailAddress,
    accessToken,
    refreshToken = null,
    tokenExpiry = null,
    scopes = [],
    providerAccountId = '',
  }) {
    if (!userId) throw new Error('User ID is required');
    if (!provider) throw new Error('Provider is required (GMAIL or OUTLOOK)');
    if (!emailAddress) throw new Error('Email address is required');

    const cleanEmail = emailAddress.trim().toLowerCase();
    const cleanProvider = provider.toUpperCase();

    // Verify provider is supported
    emailProviderFactory.getProvider(cleanProvider);

    // Encrypt sensitive OAuth tokens before saving
    const encryptedAccessToken = encryptToken(accessToken);
    const encryptedRefreshToken = encryptToken(refreshToken);

    // Find existing connection or create new
    let connection = await EmailConnection.findOne({
      userId,
      provider: cleanProvider,
    });

    if (connection) {
      connection.emailAddress = cleanEmail;
      connection.providerAccountId = providerAccountId || connection.providerAccountId;
      connection.scopes = scopes.length > 0 ? scopes : connection.scopes;
      connection.encryptedAccessToken = encryptedAccessToken;
      if (encryptedRefreshToken) {
        connection.encryptedRefreshToken = encryptedRefreshToken;
      }
      connection.tokenExpiry = tokenExpiry;
      connection.status = 'CONNECTED';
      connection.errorMessage = '';
      await connection.save();
    } else {
      connection = await EmailConnection.create({
        userId,
        provider: cleanProvider,
        providerAccountId,
        emailAddress: cleanEmail,
        scopes,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiry,
        status: 'CONNECTED',
      });
    }

    return connection;
  }

  /**
   * List connected accounts for user
   */
  async getUserConnections(userId) {
    return await EmailConnection.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * Disconnect email provider: revokes access, removes tokens, preserves confirmed records
   */
  async disconnectProvider(userId, connectionId) {
    const connection = await EmailConnection.findOne({ _id: connectionId, userId })
      .select('+encryptedAccessToken');

    if (!connection) {
      const err = new Error('Email connection not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    try {
      if (connection.encryptedAccessToken) {
        const rawToken = decryptToken(connection.encryptedAccessToken);
        const providerAdapter = emailProviderFactory.getProvider(connection.provider);
        await providerAdapter.revokeAccess({ token: rawToken });
      }
    } catch (rErr) {
      console.warn('[Disconnect Warning] Revoke failed (ignoring):', rErr.message);
    }

    connection.status = 'DISCONNECTED';
    connection.encryptedAccessToken = null;
    connection.encryptedRefreshToken = null;
    await connection.save();

    return { disconnected: true, connectionId: connection._id };
  }

  /**
   * Ensure the connection has a valid, non-expired access token.
   * If expired (or within 60s of expiring) and refresh token is available, automatically refreshes it.
   */
  async _getValidAccessToken(connection) {
    let rawAccessToken = connection.encryptedAccessToken ? decryptToken(connection.encryptedAccessToken) : null;
    const now = Date.now();
    const isExpired = connection.tokenExpiry && new Date(connection.tokenExpiry).getTime() - now < 60000;

    if ((!rawAccessToken || isExpired) && connection.encryptedRefreshToken) {
      const rawRefreshToken = decryptToken(connection.encryptedRefreshToken);
      if (rawRefreshToken && connection.provider === 'GMAIL') {
        try {
          const clientId = env.GOOGLE_CLIENT_ID;
          const clientSecret = env.GOOGLE_CLIENT_SECRET;
          if (clientId && clientSecret) {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: rawRefreshToken,
                grant_type: 'refresh_token',
              }),
            });

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.access_token) {
                rawAccessToken = tokenData.access_token;
                connection.encryptedAccessToken = encryptToken(rawAccessToken);
                if (tokenData.expires_in) {
                  connection.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);
                }
                connection.status = 'CONNECTED';
                connection.errorMessage = '';
                await connection.save();
                return rawAccessToken;
              }
            } else {
              const errBody = await tokenResponse.text();
              console.warn(`[Token Refresh Warning] Failed to refresh Gmail access token: ${errBody}`);
            }
          }
        } catch (refreshErr) {
          console.warn(`[Token Refresh Warning] Error during refresh: ${refreshErr.message}`);
        }
      }
    }

    return rawAccessToken;
  }

  /**
   * Incremental Mailbox Sync for Purchase Receipts
   */
  async syncMailbox(userId, connectionId, { manual = true } = {}) {
    const connection = await EmailConnection.findOne({ _id: connectionId, userId })
      .select('+encryptedAccessToken +encryptedRefreshToken');

    if (!connection) {
      const err = new Error('Email connection not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    if (connection.status === 'DISCONNECTED') {
      const err = new Error('Cannot sync a disconnected email account');
      err.statusCode = 400;
      throw err;
    }

    const providerAdapter = emailProviderFactory.getProvider(connection.provider);
    let rawToken = await this._getValidAccessToken(connection);

    if (!rawToken) {
      connection.status = 'EXPIRED';
      connection.errorMessage = 'Authentication token missing or invalid. Please reconnect.';
      await connection.save();
      const err = new Error('Email authorization expired. Please reconnect your account.');
      err.statusCode = 401;
      throw err;
    }

    // Determine sinceDate: uses lastSyncedAt or past N days (default: 90 days)
    const syncDays = connection.syncSettings?.syncPeriodDays || 90;
    const sinceDate = connection.lastSyncedAt
      ? connection.lastSyncedAt
      : new Date(Date.now() - syncDays * 24 * 60 * 60 * 1000);

    // 1. Search messages from provider
    let messages = [];
    try {
      messages = await providerAdapter.searchPurchaseMessages({
        accessToken: rawToken,
        sinceDate,
        maxResults: 30,
      });
    } catch (searchErr) {
      if (searchErr.message?.includes('401') && connection.encryptedRefreshToken) {
        connection.tokenExpiry = new Date(0);
        const refreshedToken = await this._getValidAccessToken(connection);
        if (refreshedToken && refreshedToken !== rawToken) {
          rawToken = refreshedToken;
          messages = await providerAdapter.searchPurchaseMessages({
            accessToken: rawToken,
            sinceDate,
            maxResults: 30,
          });
        } else {
          throw searchErr;
        }
      } else {
        throw searchErr;
      }
    }

    let newCandidatesCount = 0;
    let duplicateCount = 0;
    const createdCandidates = [];

    // 2. Process each discovered message
    for (const msgRef of messages) {
      // Check if already processed
      const existingReceipt = await EmailReceipt.findOne({
        userId,
        providerMessageId: msgRef.messageId,
      });

      if (existingReceipt) {
        continue;
      }

      // Fetch full message details
      const msgDetails = await providerAdapter.getMessageDetails({
        accessToken: rawToken,
        messageId: msgRef.messageId,
      });

      // Quick filter: Check purchase relevance
      const isPurchase = this._detectPurchaseRelevance(msgDetails);
      if (!isPurchase.relevant) {
        continue;
      }

      // Process attachments if available
      const savedAttachments = [];
      let extractedData = null;
      let primaryStoragePath = null;
      let primaryMimeType = null;
      let primaryFileName = null;
      let fileHash = '';

      if (msgDetails.attachments && msgDetails.attachments.length > 0) {
        for (const att of msgDetails.attachments) {
          const ext = path.extname(att.fileName || '').toLowerCase();
          const validMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
          const validExt = ['.pdf', '.jpg', '.jpeg', '.png'];

          if (validMime.includes(att.mimeType) || validExt.includes(ext)) {
            // Download attachment buffer
            const downloaded = await providerAdapter.getAttachment({
              accessToken: rawToken,
              messageId: msgRef.messageId,
              attachmentId: att.attachmentId,
            });

            // Hash buffer for duplicate checking
            fileHash = crypto.createHash('sha256').update(downloaded.buffer).digest('hex');

            const safeName = `${userId}_${Date.now()}_${path.basename(att.fileName || 'invoice.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const targetPath = path.join(this.attachmentDir, safeName);
            fs.writeFileSync(targetPath, downloaded.buffer);

            savedAttachments.push({
              attachmentId: att.attachmentId,
              fileName: att.fileName || safeName,
              mimeType: downloaded.mimeType || att.mimeType,
              fileSize: downloaded.buffer.length,
              storagePath: targetPath,
              fileHash,
            });

            if (!primaryStoragePath) {
              primaryStoragePath = targetPath;
              primaryMimeType = downloaded.mimeType || att.mimeType;
              primaryFileName = att.fileName;
            }
          }
        }
      }

      // Perform AI / deterministic extraction
      if (primaryStoragePath) {
        const aiResult = await processDocumentWithAI({
          filePath: primaryStoragePath,
          mimeType: primaryMimeType,
          originalName: primaryFileName,
        });
        extractedData = aiResult.extractedData;
      } else {
        // Fallback: extract from email body text
        extractedData = parseDeterministicReceipt(
          `${msgDetails.subject}\n${msgDetails.snippet}\n${msgDetails.bodyText}`,
          msgDetails.subject
        );
      }

      // Check for duplicates against existing User records (Products, Documents, EmailReceipts)
      const duplicateAnalysis = await this._evaluateDuplicate({
        userId,
        fileHash,
        providerMessageId: msgRef.messageId,
        invoiceNumber: extractedData?.invoiceNumber,
        purchasePrice: extractedData?.purchasePrice,
        purchaseDate: extractedData?.purchaseDate,
        productName: extractedData?.productName || msgDetails.subject,
        sellerName: extractedData?.sellerName,
      });

      if (duplicateAnalysis.isDuplicate) {
        duplicateCount++;
      } else {
        newCandidatesCount++;
      }

      // Source Conflict Detection (compare email subject & snippet with attachment extracted data)
      const sourceConflict = this._detectSourceConflict(msgDetails, extractedData, savedAttachments.length > 0);

      // Confidence score calculation
      let confidenceScore = isPurchase.score;
      if (extractedData?.purchasePrice) confidenceScore += 20;
      if (extractedData?.invoiceNumber) confidenceScore += 20;
      if (savedAttachments.length > 0) confidenceScore += 15;
      if (sourceConflict.hasConflict) confidenceScore = Math.min(confidenceScore, 40);
      confidenceScore = Math.min(100, confidenceScore);

      const confidenceLevel =
        sourceConflict.hasConflict
          ? 'LOW'
          : confidenceScore >= 75
          ? 'HIGH'
          : confidenceScore >= 45
          ? 'MEDIUM'
          : 'LOW';

      // Create EmailReceipt candidate
      const candidate = await EmailReceipt.create({
        userId,
        emailConnectionId: connection._id,
        provider: connection.provider,
        providerMessageId: msgRef.messageId,
        threadId: msgDetails.threadId,
        sender: msgDetails.sender,
        senderEmail: msgDetails.senderEmail,
        subject: msgDetails.subject,
        receivedAt: msgDetails.receivedAt,
        snippet: msgDetails.snippet,
        attachmentMetadata: savedAttachments,
        extractionStatus:
          duplicateAnalysis.duplicateStatus === 'EXACT_DUPLICATE'
            ? 'DUPLICATE'
            : 'REVIEW_REQUIRED',
        confidence: confidenceLevel,
        confidenceScore,
        duplicateStatus: duplicateAnalysis.duplicateStatus,
        duplicateReason: duplicateAnalysis.duplicateReason,
        sourceConflict,
        existingMatch: duplicateAnalysis.existingMatch,
        extractedProduct: {
          productName: extractedData?.productName || this._extractTitleFromSubject(msgDetails.subject),
          category: extractedData?.category || 'Electronics',
          brand: extractedData?.brand || '',
          model: extractedData?.model || '',
          serialNumber: extractedData?.serialNumber || '',
          purchaseDate: extractedData?.purchaseDate ? new Date(extractedData.purchaseDate) : msgDetails.receivedAt,
          purchasePrice: extractedData?.purchasePrice || 0,
          currency: extractedData?.currency || 'INR',
          sellerName: extractedData?.sellerName || this._extractSellerFromSender(msgDetails.sender),
          invoiceNumber: extractedData?.invoiceNumber || '',
          taxInfo: extractedData?.taxInfo || '',
          warranty: {
            hasWarranty: Boolean(extractedData?.warranty?.hasWarranty),
            durationMonths: extractedData?.warranty?.durationMonths || null,
            warrantyProvider: extractedData?.warranty?.warrantyProvider || '',
          },
          returnInfo: {
            returnEligible: Boolean(extractedData?.returnInfo?.returnEligible),
            returnEndDate: extractedData?.returnInfo?.returnEndDate ? new Date(extractedData.returnInfo.returnEndDate) : null,
          },
        },
      });

      createdCandidates.push(candidate);
    }

    // Update lastSyncedAt
    connection.lastSyncedAt = new Date();
    await connection.save();

    return {
      syncedCount: messages.length,
      newCandidatesCount,
      duplicateCount,
      totalDiscovered: createdCandidates.length,
      candidates: createdCandidates,
    };
  }

  /**
   * Retrieve email purchase candidates with status filters and tabs
   */
  async getCandidates({ userId, tab = 'all', page = 1, limit = 20 }) {
    const filter = { userId };

    switch (tab.toLowerCase()) {
      case 'needs_review':
      case 'review_required':
        filter.extractionStatus = 'REVIEW_REQUIRED';
        break;
      case 'confirmed':
        filter.extractionStatus = 'CONFIRMED';
        break;
      case 'rejected':
        filter.extractionStatus = 'REJECTED';
        break;
      case 'duplicate':
      case 'duplicates':
        filter.$or = [
          { extractionStatus: 'DUPLICATE' },
          { duplicateStatus: { $in: ['EXACT_DUPLICATE', 'POSSIBLE_DUPLICATE'] } },
        ];
        break;
      case 'failed':
        filter.extractionStatus = 'FAILED';
        break;
      case 'all':
      default:
        // No extra filter
        break;
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [candidates, total, counts] = await Promise.all([
      EmailReceipt.find(filter)
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('linkedProductId', 'productName brand model purchasePrice currency status')
        .lean(),
      EmailReceipt.countDocuments(filter),
      this._getStatusCounts(userId),
    ]);

    return {
      candidates,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
      counts,
    };
  }

  /**
   * Retrieve single candidate details
   */
  async getCandidateById(userId, candidateId) {
    const candidate = await EmailReceipt.findOne({ _id: candidateId, userId })
      .populate('linkedProductId')
      .populate('linkedDocumentId')
      .lean();

    if (!candidate) {
      const err = new Error('Email receipt record not found');
      err.statusCode = 404;
      throw err;
    }

    return candidate;
  }

  /**
   * User Confirms Email Receipt & Creates Product + Document + Timeline Event
   */
  async confirmCandidate({ userId, candidateId, modifiedFields = {}, linkToExistingProductId = null }) {
    const candidate = await EmailReceipt.findOne({ _id: candidateId, userId });
    if (!candidate) {
      const err = new Error('Email receipt candidate not found');
      err.statusCode = 404;
      throw err;
    }

    if (candidate.extractionStatus === 'CONFIRMED') {
      const err = new Error('This email receipt has already been confirmed');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    let product;
    let document;

    // Merge extracted data with user adjustments
    const finalProductData = {
      productName: modifiedFields.productName || candidate.extractedProduct?.productName || 'Imported Asset',
      category: modifiedFields.category || candidate.extractedProduct?.category || 'Electronics',
      brand: modifiedFields.brand !== undefined ? modifiedFields.brand : candidate.extractedProduct?.brand || '',
      model: modifiedFields.model !== undefined ? modifiedFields.model : candidate.extractedProduct?.model || '',
      serialNumber: modifiedFields.serialNumber !== undefined ? modifiedFields.serialNumber : candidate.extractedProduct?.serialNumber || '',
      purchaseDate: modifiedFields.purchaseDate ? new Date(modifiedFields.purchaseDate) : candidate.extractedProduct?.purchaseDate || now,
      purchasePrice: modifiedFields.purchasePrice !== undefined ? Number(modifiedFields.purchasePrice) : candidate.extractedProduct?.purchasePrice || 0,
      currency: 'INR',
      sellerName: modifiedFields.sellerName !== undefined ? modifiedFields.sellerName : candidate.extractedProduct?.sellerName || '',
      warranty: {
        hasWarranty: modifiedFields.warranty?.hasWarranty ?? candidate.extractedProduct?.warranty?.hasWarranty ?? false,
        warrantyProvider: modifiedFields.warranty?.warrantyProvider || candidate.extractedProduct?.warranty?.warrantyProvider || '',
        warrantyStartDate: modifiedFields.warranty?.warrantyStartDate ? new Date(modifiedFields.warranty.warrantyStartDate) : undefined,
        warrantyEndDate: modifiedFields.warranty?.warrantyEndDate ? new Date(modifiedFields.warranty.warrantyEndDate) : undefined,
      },
      returnInfo: {
        returnEligible: modifiedFields.returnInfo?.returnEligible ?? candidate.extractedProduct?.returnInfo?.returnEligible ?? false,
        returnEndDate: modifiedFields.returnInfo?.returnEndDate ? new Date(modifiedFields.returnInfo.returnEndDate) : undefined,
      },
    };

    if (linkToExistingProductId) {
      // 1. Link to existing product
      product = await Product.findOne({ _id: linkToExistingProductId, userId });
      if (!product) {
        const err = new Error('Selected existing product not found');
        err.statusCode = 404;
        throw err;
      }
    } else {
      // 2. Create new Product
      product = await Product.create({
        userId,
        ...finalProductData,
        source: 'EMAIL',
        sourceMetadata: {
          provider: candidate.provider,
          emailReceiptId: candidate._id,
          importedAt: now,
        },
      });

      // Initial acquisition timeline event
      await timelineService.recordEvent({
        userId,
        productId: product._id,
        eventType: 'PURCHASED',
        title: 'Product Purchased',
        description: `Purchased from ${product.sellerName || 'online merchant'} for ₹${product.purchasePrice.toLocaleString('en-IN')}. (Source: ${candidate.provider} Import)`,
        eventDate: product.purchaseDate || now,
        source: 'EMAIL',
        metadata: {
          emailReceiptId: String(candidate._id),
          provider: candidate.provider,
        },
      });
    }

    // 3. Create Document in Phase 3 Document Vault
    const primaryAttachment = candidate.attachmentMetadata?.[0];
    if (primaryAttachment && primaryAttachment.storagePath && fs.existsSync(primaryAttachment.storagePath)) {
      // Copy attachment to main document directory if needed
      const docsDir = path.resolve(env.UPLOAD_DIR, 'documents');
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

      const docStoragePath = path.join(docsDir, path.basename(primaryAttachment.storagePath));
      fs.copyFileSync(primaryAttachment.storagePath, docStoragePath);

      document = await Document.create({
        userId,
        productId: product._id,
        fileName: primaryAttachment.fileName,
        storagePath: docStoragePath,
        fileSize: primaryAttachment.fileSize,
        mimeType: primaryAttachment.mimeType,
        documentType: 'RECEIPT',
        source: 'EMAIL',
        emailReceiptId: candidate._id,
        status: 'CONFIRMED',
        extractedData: {
          productName: product.productName,
          category: product.category,
          brand: product.brand,
          model: product.model,
          serialNumber: product.serialNumber,
          purchaseDate: product.purchaseDate ? product.purchaseDate.toISOString() : null,
          purchasePrice: product.purchasePrice,
          currency: 'INR',
          sellerName: product.sellerName,
          invoiceNumber: candidate.extractedProduct?.invoiceNumber || '',
          taxInfo: candidate.extractedProduct?.taxInfo || '',
        },
      });

      // Record Document Added timeline event
      await timelineService.recordEvent({
        userId,
        productId: product._id,
        eventType: 'DOCUMENT_ADDED',
        title: 'Receipt Attached from Email',
        description: `Attached purchase receipt ${primaryAttachment.fileName} imported from ${candidate.provider}.`,
        eventDate: now,
        source: 'EMAIL',
        relatedDocumentId: document._id,
        metadata: { emailReceiptId: String(candidate._id) },
      });
    }

    // 4. Update candidate status
    candidate.extractionStatus = 'CONFIRMED';
    candidate.confirmedAt = now;
    candidate.linkedProductId = product._id;
    if (document) {
      candidate.linkedDocumentId = document._id;
    }
    await candidate.save();

    return {
      confirmed: true,
      product,
      document,
      candidate,
    };
  }

  /**
   * User Rejects Email Receipt Candidate
   */
  async rejectCandidate(userId, candidateId, reason = '') {
    const candidate = await EmailReceipt.findOne({ _id: candidateId, userId });
    if (!candidate) {
      const err = new Error('Email receipt candidate not found');
      err.statusCode = 404;
      throw err;
    }

    candidate.extractionStatus = 'REJECTED';
    candidate.rejectedAt = new Date();
    candidate.errorMessage = reason || 'Rejected by user during review';
    await candidate.save();

    return { rejected: true, candidateId: candidate._id, candidate };
  }

  // --- Internal Helper Functions ---
  _detectPurchaseRelevance(msg) {
    const subject = (msg.subject || '').toLowerCase();
    const body = (msg.bodyText || '').toLowerCase();
    const sender = (msg.sender || '').toLowerCase();
    const combined = `${subject} ${body} ${sender}`;

    let score = 0;

    // High signal purchase keywords
    if (combined.includes('tax invoice')) score += 35;
    if (combined.includes('invoice')) score += 25;
    if (combined.includes('receipt')) score += 25;
    if (combined.includes('order confirmation') || combined.includes('order confirmed')) score += 25;
    if (combined.includes('gstin') || combined.includes('cgst') || combined.includes('sgst')) score += 30;
    if (combined.includes('payment successful') || combined.includes('payment received')) score += 15;
    if (combined.includes('₹') || combined.includes('rs.') || combined.includes('inr')) score += 15;

    // Known merchant senders
    const merchants = ['amazon', 'flipkart', 'croma', 'reliancedigital', 'apple', 'dell', 'myntra', 'tatacliq'];
    if (merchants.some((m) => sender.includes(m))) {
      score += 25;
    }

    // Negative filters: marketing/social/spam
    const negatives = ['newsletter', 'promotion', 'webinar', 'unsubscribe', 'connection request', 'reset password'];
    if (negatives.some((n) => subject.includes(n))) {
      score -= 30;
    }

    return {
      relevant: score >= 25,
      score: Math.max(0, Math.min(100, score)),
    };
  }

  async _evaluateDuplicate({
    userId,
    fileHash,
    providerMessageId,
    invoiceNumber,
    purchasePrice,
    purchaseDate,
    productName,
    sellerName,
  }) {
    // Check exact provider message
    const msgMatch = await EmailReceipt.findOne({ userId, providerMessageId, extractionStatus: 'CONFIRMED' });
    if (msgMatch) {
      return {
        isDuplicate: true,
        duplicateStatus: 'EXACT_DUPLICATE',
        duplicateReason: 'This email receipt was already imported and confirmed previously.',
        existingMatch: {
          productId: msgMatch.linkedProductId,
          productName: msgMatch.extractedProduct?.productName,
          purchasePrice: msgMatch.extractedProduct?.purchasePrice,
          invoiceNumber: msgMatch.extractedProduct?.invoiceNumber,
        },
      };
    }

    // Check invoice number match in Document collection
    if (invoiceNumber && invoiceNumber.trim().length > 3) {
      const docMatch = await Document.findOne({
        userId,
        'extractedData.invoiceNumber': invoiceNumber.trim(),
      }).populate('productId');

      if (docMatch) {
        return {
          isDuplicate: true,
          duplicateStatus: 'EXACT_DUPLICATE',
          duplicateReason: `Invoice number "${invoiceNumber}" matches an existing document in your vault.`,
          existingMatch: {
            productId: docMatch.productId?._id,
            productName: docMatch.productId?.productName || docMatch.fileName,
            purchasePrice: docMatch.productId?.purchasePrice,
            invoiceNumber,
          },
        };
      }
    }

    // Check product match by name & date & price
    if (productName && purchasePrice && purchasePrice > 0) {
      const cleanName = productName.trim();
      const existingProduct = await Product.findOne({
        userId,
        productName: { $regex: new RegExp(cleanName.substring(0, 15), 'i') },
        purchasePrice,
      });

      if (existingProduct) {
        return {
          isDuplicate: true,
          duplicateStatus: 'POSSIBLE_DUPLICATE',
          duplicateReason: `An existing asset "${existingProduct.productName}" (₹${purchasePrice.toLocaleString('en-IN')}) was found in your ledger.`,
          existingMatch: {
            productId: existingProduct._id,
            productName: existingProduct.productName,
            purchasePrice: existingProduct.purchasePrice,
            purchaseDate: existingProduct.purchaseDate,
          },
        };
      }
    }

    return {
      isDuplicate: false,
      duplicateStatus: 'NONE',
      duplicateReason: '',
      existingMatch: null,
    };
  }

  async _getStatusCounts(userId) {
    const [all, needsReview, confirmed, rejected, duplicates, failed] = await Promise.all([
      EmailReceipt.countDocuments({ userId }),
      EmailReceipt.countDocuments({ userId, extractionStatus: 'REVIEW_REQUIRED' }),
      EmailReceipt.countDocuments({ userId, extractionStatus: 'CONFIRMED' }),
      EmailReceipt.countDocuments({ userId, extractionStatus: 'REJECTED' }),
      EmailReceipt.countDocuments({
        userId,
        $or: [
          { extractionStatus: 'DUPLICATE' },
          { duplicateStatus: { $in: ['EXACT_DUPLICATE', 'POSSIBLE_DUPLICATE'] } },
        ],
      }),
      EmailReceipt.countDocuments({ userId, extractionStatus: 'FAILED' }),
    ]);

    return {
      all,
      needsReview,
      confirmed,
      rejected,
      duplicates,
      failed,
    };
  }

  _extractTitleFromSubject(subject = '') {
    return subject
      .replace(/^(re|fwd|tax invoice for your|invoice for|your order|order confirmed):\s*/i, '')
      .replace(/#\S+/g, '')
      .trim()
      .substring(0, 80);
  }

  _extractSellerFromSender(sender = '') {
    const nameMatch = sender.match(/^"?([^"<@]+)"?\s*</);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim();
    }
    return sender.split('@')[0] || '';
  }

  /**
   * Update sync settings for a connection
   */
  async updateConnectionSettings(userId, connectionId, { scanPeriodDays, syncPeriodDays, syncFrequencyHours, autoEnrich }) {
    const connection = await EmailConnection.findOne({ _id: connectionId, userId });
    if (!connection) {
      const err = new Error('Email connection not found');
      err.statusCode = 404;
      throw err;
    }

    if (!connection.syncSettings) {
      connection.syncSettings = {};
    }

    const days = scanPeriodDays !== undefined ? scanPeriodDays : syncPeriodDays;
    if (days !== undefined) connection.syncSettings.syncPeriodDays = Number(days);
    if (syncFrequencyHours !== undefined) connection.syncSettings.syncFrequencyHours = Number(syncFrequencyHours);
    if (autoEnrich !== undefined) connection.syncSettings.autoEnrich = Boolean(autoEnrich);

    await connection.save();
    return connection;
  }

  /**
   * Compare email metadata (subject, snippet) with attached document extraction.
   * If a mismatch is detected (e.g. Email says Sony Bravia, attachment says HP Pavilion),
   * flag a source conflict and require user review.
   */
  _detectSourceConflict(msgDetails, extractedData, hasAttachment) {
    if (!hasAttachment || !extractedData) {
      return {
        hasConflict: false,
        conflictType: '',
        emailIndicates: '',
        attachmentIndicates: '',
        conflictReason: '',
      };
    }

    const emailSubject = (msgDetails.subject || '').trim();
    const emailSnippet = (msgDetails.snippet || '').trim();
    const emailCombined = `${emailSubject} ${emailSnippet}`.toLowerCase();

    const attachmentProduct = (extractedData.productName || '').trim();
    const attachmentBrand = (extractedData.brand || '').trim();
    const attachmentModel = (extractedData.model || '').trim();

    // Check brand / product category mismatches
    const brands = [
      'sony', 'apple', 'samsung', 'hp', 'dell', 'lenovo', 'lg', 'asus',
      'boat', 'bose', 'oneplus', 'xiaomi', 'philips', 'canon', 'panasonic',
      'avirox', 'havells', 'voltas', 'whirlpool', 'godrej'
    ];

    const emailBrands = brands.filter((b) => new RegExp(`\\b${b}\\b`, 'i').test(emailCombined));

    if (emailBrands.length > 0 && (attachmentBrand || attachmentProduct)) {
      const docCombined = `${attachmentBrand} ${attachmentProduct} ${attachmentModel}`.toLowerCase();
      for (const eBrand of emailBrands) {
        const otherBrands = brands.filter((b) => b !== eBrand);
        const conflictingDocBrand = otherBrands.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(docCombined));
        if (conflictingDocBrand && !new RegExp(`\\b${eBrand}\\b`, 'i').test(docCombined)) {
          return {
            hasConflict: true,
            conflictType: 'PRODUCT_BRAND_MISMATCH',
            emailIndicates: emailSubject,
            attachmentIndicates: attachmentProduct || `${conflictingDocBrand.toUpperCase()} Item`,
            conflictReason: `Email subject indicates '${eBrand.toUpperCase()}' but attachment invoice contains '${conflictingDocBrand.toUpperCase()} (${attachmentProduct || 'different product'})'.`,
          };
        }
      }
    }

    // Check price mismatch if email snippet has a clear total and attachment has a different price
    const emailPriceMatch = emailCombined.match(/(?:total|paid|amount|net payable)[\s:]*(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/i);
    if (emailPriceMatch && extractedData.purchasePrice) {
      const emailPrice = parseFloat(emailPriceMatch[1].replace(/,/g, ''));
      const docPrice = parseFloat(extractedData.purchasePrice);
      if (!isNaN(emailPrice) && !isNaN(docPrice) && emailPrice > 0 && docPrice > 0) {
        const diffPercent = Math.abs(emailPrice - docPrice) / Math.max(emailPrice, docPrice);
        if (diffPercent > 0.15) { // Discrepancy > 15%
          return {
            hasConflict: true,
            conflictType: 'PRICE_MISMATCH',
            emailIndicates: `₹${emailPrice}`,
            attachmentIndicates: `₹${docPrice}`,
            conflictReason: `Email states ₹${emailPrice} but attached document total is ₹${docPrice}.`,
          };
        }
      }
    }

    return {
      hasConflict: false,
      conflictType: '',
      emailIndicates: '',
      attachmentIndicates: '',
      conflictReason: '',
    };
  }
}

export default new EmailIntelligenceService();
