import Product from '../models/Product.js';
import Document from '../models/Document.js';
import WarrantyClaim from '../models/WarrantyClaim.js';
import ServiceRecord from '../models/ServiceRecord.js';
import serviceRecordService from './serviceRecordService.js';
import timelineService from './timelineService.js';
import Alert from '../models/Alert.js';
import { formatDateIN } from '../utils/formatters.js';

/**
 * LIFERECEIPT WarrantyClaim Service
 * Phase 13: Warranty & Service Ecosystem
 * 
 * Manages warranty claim preparation, dynamic readiness checklists,
 * claim lifecycle submission, and status management.
 */
class WarrantyClaimService {
  /**
   * Prepare a warranty claim: collects available data, checks readiness,
   * identifies missing items, and builds a factual checklist.
   */
  async prepareClaim(arg1, arg2) {
    let product = await Product.findOne({ _id: arg2, userId: arg1 })
      .select('productName brand model serialNumber category purchaseDate purchasePrice warranty sellerName status')
      .lean();
    let userId = arg1;
    let productId = arg2;

    if (!product) {
      product = await Product.findOne({ _id: arg1, userId: arg2 })
        .select('productName brand model serialNumber category purchaseDate purchasePrice warranty sellerName status')
        .lean();
      userId = arg2;
      productId = arg1;
    }

    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 1. Fetch all documents associated with this product
    const documents = await Document.find({ productId, userId })
      .select('fileName documentType fileSize mimeType createdAt extractedData')
      .lean();

    // 2. Fetch past service records for this product
    const serviceRecords = await ServiceRecord.find({ productId, userId })
      .sort({ reportedDate: -1 })
      .limit(5)
      .lean();

    // 3. Evaluate Checklist Items
    const invoiceDoc = documents.find(
      (d) => d.documentType === 'INVOICE' || d.documentType === 'RECEIPT'
    );
    const warrantyDoc = documents.find(
      (d) => d.documentType === 'WARRANTY' || (d.extractedData && d.extractedData.warrantyDuration)
    );

    const hasSerial = Boolean(product.serialNumber && product.serialNumber.trim().length > 0);
    const hasInvoice = Boolean(invoiceDoc);
    const hasWarrantyDoc = Boolean(warrantyDoc || (product.warranty?.hasWarranty && product.warranty?.warrantyEndDate));
    const hasBrandAndModel = Boolean(product.brand && product.model);
    const hasPurchaseDate = Boolean(product.purchaseDate);

    const checklist = [
      {
        id: 'serial_number',
        label: 'Hardware Serial Number (S/N)',
        available: hasSerial,
        status: hasSerial ? 'PASS' : 'FAIL',
        value: hasSerial ? product.serialNumber : null,
        description: hasSerial ? `Serial Number: ${product.serialNumber}` : 'Serial number missing',
        required: true,
      },
      {
        id: 'purchase_invoice',
        label: 'Purchase Invoice / Receipt',
        available: hasInvoice,
        status: hasInvoice ? 'PASS' : 'FAIL',
        value: invoiceDoc ? invoiceDoc.fileName : null,
        description: invoiceDoc ? `Invoice: ${invoiceDoc.fileName}` : 'Purchase receipt missing',
        required: true,
      },
      {
        id: 'warranty_document',
        label: 'Warranty Certificate / Coverage Details',
        available: hasWarrantyDoc,
        status: hasWarrantyDoc ? 'PASS' : 'FAIL',
        value: product.warranty?.warrantyEndDate ? `Valid until ${formatDateIN(product.warranty.warrantyEndDate)}` : null,
        description: hasWarrantyDoc ? 'Warranty active and verified' : 'No active warranty documentation',
        required: false,
      },
      {
        id: 'product_model',
        label: 'Product Brand & Model',
        available: hasBrandAndModel,
        status: hasBrandAndModel ? 'PASS' : 'FAIL',
        value: hasBrandAndModel ? `${product.brand} ${product.model}` : null,
        description: hasBrandAndModel ? `${product.brand} ${product.model}` : 'Brand or model unspecified',
        required: true,
      },
      {
        id: 'purchase_date',
        label: 'Proof of Purchase Date',
        available: hasPurchaseDate,
        status: hasPurchaseDate ? 'PASS' : 'FAIL',
        value: hasPurchaseDate ? formatDateIN(product.purchaseDate) : null,
        description: hasPurchaseDate ? `Purchased on ${formatDateIN(product.purchaseDate)}` : 'Purchase date not recorded',
        required: true,
      },
    ];

    const passedCount = checklist.filter((item) => item.available).length;
    const readinessScore = Math.round((passedCount / checklist.length) * 100);
    const missingItems = checklist.filter((item) => item.required && !item.available).map((item) => item.label);
    const isReady = missingItems.length === 0;

    let warrantyStatus = 'NO_WARRANTY';
    if (product.warranty?.warrantyEndDate) {
      const daysLeft = Math.ceil((new Date(product.warranty.warrantyEndDate) - new Date()) / (1000 * 60 * 60 * 24));
      warrantyStatus = daysLeft < 0 ? 'EXPIRED' : daysLeft <= 30 ? 'EXPIRING_SOON' : 'ACTIVE';
    }

    return {
      product: {
        _id: product._id,
        name: product.productName,
        productName: product.productName,
        brand: product.brand,
        model: product.model,
        serialNumber: product.serialNumber,
        purchaseDate: product.purchaseDate,
        sellerName: product.sellerName,
        warranty: product.warranty,
        warrantyStatus,
      },
      readinessScore,
      documents,
      serviceRecords,
      checklist,
      missingItems,
      isReady,
      readinessMessage: isReady
        ? 'All required purchase and hardware identity items are available for claim submission.'
        : `Complete these required items before submitting your claim: ${missingItems.join(', ')}.`,
    };
  }

  async prepareWarrantyClaim(arg1, arg2) {
    return this.prepareClaim(arg1, arg2);
  }

  /**
   * Submit or draft a warranty claim
   */
  async submitClaim({
    userId,
    productId,
    issueTitle,
    issueDescription = '',
    claimType = 'MANUFACTURER',
    provider = '',
    serviceCenter = '',
    relatedDocumentIds = [],
    notes = '',
    status = 'SUBMITTED',
  }) {
    if (!userId) throw new Error('User ID is required');
    if (!productId) throw new Error('Product ID is required');
    if (!issueTitle || !issueTitle.trim()) throw new Error('Issue title is required');

    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // Verify documents
    let validDocIds = [];
    if (Array.isArray(relatedDocumentIds) && relatedDocumentIds.length > 0) {
      const docs = await Document.find({ _id: { $in: relatedDocumentIds }, userId }).select('_id');
      validDocIds = docs.map((d) => d._id);
    }

    // Run preparation checklist to snapshot readiness
    const prep = await this.prepareClaim(userId, productId);

    // Auto-generate a claim reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const claimReference = `CLM-${product.brand ? product.brand.substring(0, 3).toUpperCase() : 'LR'}-${timestamp}`;

    // 1. Create WarrantyClaim
    const claim = await WarrantyClaim.create({
      userId,
      productId,
      claimReference,
      status: status || 'SUBMITTED',
      issueTitle: issueTitle.trim(),
      issueDescription: (issueDescription || '').trim(),
      claimType,
      submittedDate: status === 'SUBMITTED' ? new Date() : null,
      provider: (provider || product.warranty?.warrantyProvider || product.brand || '').trim(),
      serviceCenter: (serviceCenter || '').trim(),
      relatedDocumentIds: validDocIds,
      checklist: {
        hasSerial: prep.checklist.find((c) => c.id === 'serial_number')?.available || false,
        hasInvoice: prep.checklist.find((c) => c.id === 'purchase_invoice')?.available || false,
        hasWarrantyDoc: prep.checklist.find((c) => c.id === 'warranty_document')?.available || false,
        hasProofOfPurchase: prep.checklist.find((c) => c.id === 'purchase_date')?.available || false,
        missingItems: prep.missingItems,
      },
      notes: (notes || '').trim(),
    });

    // 2. Create linked ServiceRecord
    const serviceRecord = await serviceRecordService.createServiceRecord({
      userId,
      productId,
      serviceType: 'WARRANTY_CLAIM',
      status: status === 'SUBMITTED' ? 'REQUESTED' : 'REQUESTED',
      serviceProvider: claim.provider,
      serviceCenterName: claim.serviceCenter,
      issueTitle: claim.issueTitle,
      issueDescription: claim.issueDescription,
      reportedDate: new Date(),
      warrantyRelated: true,
      warrantyClaimReference: claim.claimReference,
      relatedDocumentIds: validDocIds,
      source: 'USER',
    });

    claim.serviceRecordId = serviceRecord._id;
    await claim.save();

    // 3. Timeline event
    if (status === 'SUBMITTED') {
      await timelineService.recordEvent({
        userId,
        productId,
        eventType: 'WARRANTY_CLAIM_SUBMITTED',
        title: `Warranty Claim Submitted: ${claim.claimReference}`,
        description: `Submitted claim for ${claim.issueTitle} to ${claim.provider || 'Manufacturer'}.`,
        eventDate: new Date(),
        source: 'SERVICE',
        metadata: {
          warrantyClaimId: String(claim._id),
          claimReference: claim.claimReference,
        },
      });

      // 4. Alert
      await Alert.create({
        userId,
        productId,
        type: 'WARRANTY_CLAIM',
        title: `Warranty Claim Submitted (${claim.claimReference})`,
        message: `Claim for "${claim.issueTitle}" on ${product.productName} has been recorded.`,
        priority: 'MEDIUM',
      });
    }

    return claim;
  }

  async submitWarrantyClaim(payload) {
    return this.submitClaim(payload);
  }

  /**
   * Get user's warranty claims
   */
  async getClaims({ userId, productId = null, status = null, page = 1, limit = 20 }) {
    const filter = { userId };
    if (productId) filter.productId = productId;
    if (status) filter.status = status;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = Math.max(1, parseInt(limit, 10));

    const [claims, total] = await Promise.all([
      WarrantyClaim.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('productId', 'productName brand model serialNumber category warranty')
        .populate('relatedDocumentIds', 'fileName fileSize mimeType documentType')
        .populate('serviceRecordId')
        .lean(),
      WarrantyClaim.countDocuments(filter),
    ]);

    return {
      claims,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parsedLimit) || 1,
        limit: parsedLimit,
      },
    };
  }

  async getWarrantyClaims(options = {}) {
    const res = await this.getClaims(options);
    return res.claims;
  }

  async getClaimById(arg1, arg2) {
    let claim = await WarrantyClaim.findOne({ _id: arg2, userId: arg1 })
      .populate('productId', 'productName brand model serialNumber category warranty')
      .populate('relatedDocumentIds', 'fileName fileSize mimeType documentType')
      .populate('serviceRecordId')
      .lean();

    if (!claim) {
      claim = await WarrantyClaim.findOne({ _id: arg1, userId: arg2 })
        .populate('productId', 'productName brand model serialNumber category warranty')
        .populate('relatedDocumentIds', 'fileName fileSize mimeType documentType')
        .populate('serviceRecordId')
        .lean();
    }

    if (!claim) {
      const err = new Error('Warranty claim not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    return claim;
  }

  async getWarrantyClaimById(arg1, arg2) {
    return this.getClaimById(arg1, arg2);
  }

  /**
   * Update claim status with strict verification policy
   */
  async updateClaimStatus(arg1, arg2, arg3, arg4 = {}) {
    let claimId = arg1;
    let userId = arg2;
    let status = arg3;
    let options = arg4 || {};

    if (typeof arg3 === 'object' && (!arg4 || Object.keys(arg4).length === 0)) {
      userId = arg1;
      claimId = arg2;
      status = arg3.status;
      options = arg3;
    }

    let claim = await WarrantyClaim.findOne({ _id: claimId, userId });
    if (!claim) {
      claim = await WarrantyClaim.findOne({ _id: userId, userId: claimId });
      if (claim) {
        const temp = userId;
        userId = claimId;
        claimId = temp;
      }
    }

    if (!claim) {
      const err = new Error('Warranty claim not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    const prevStatus = claim.status;
    if (status) claim.status = status;
    const resolutionNotes = options.resolutionNotes || options.notes || options.resolution || '';
    if (resolutionNotes) claim.resolutionNotes = resolutionNotes.trim();
    if (options.claimReference) claim.claimReference = options.claimReference.trim();

    if (claim.status === 'COMPLETED' || claim.status === 'APPROVED' || claim.status === 'REJECTED') {
      claim.resolvedDate = new Date();
    }

    await claim.save();

    // Update linked ServiceRecord
    if (claim.serviceRecordId) {
      let svcStatus = 'REQUESTED';
      if (claim.status === 'SUBMITTED' || claim.status === 'UNDER_REVIEW') svcStatus = 'IN_SERVICE';
      if (claim.status === 'APPROVED' || claim.status === 'COMPLETED') svcStatus = 'COMPLETED';
      if (claim.status === 'REJECTED') svcStatus = 'REJECTED';
      if (claim.status === 'CANCELLED') svcStatus = 'CANCELLED';

      await serviceRecordService.updateServiceRecord(userId, claim.serviceRecordId, {
        status: svcStatus,
        notes: resolutionNotes ? `Claim Resolution: ${resolutionNotes}` : undefined,
      });
    }

    // Timeline event
    if (claim.status !== prevStatus) {
      await timelineService.recordEvent({
        userId,
        productId: claim.productId,
        eventType: claim.status === 'COMPLETED' || claim.status === 'APPROVED' ? 'WARRANTY_CLAIM_RESOLVED' : 'SERVICE',
        title: `Warranty Claim ${claim.status}: ${claim.claimReference || claim.issueTitle}`,
        description: resolutionNotes || `Claim status updated to ${claim.status}.`,
        eventDate: new Date(),
        source: 'SERVICE',
        metadata: {
          warrantyClaimId: String(claim._id),
          status: claim.status,
        },
      });
    }

    return claim;
  }
}

export default new WarrantyClaimService();
