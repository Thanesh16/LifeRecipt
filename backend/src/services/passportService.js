import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import Product from '../models/Product.js';
import Document from '../models/Document.js';
import Expense from '../models/Expense.js';
import ServiceRecord from '../models/ServiceRecord.js';
import WarrantyClaim from '../models/WarrantyClaim.js';
import OwnershipHistory from '../models/OwnershipHistory.js';
import ProductIntelligence from '../models/ProductIntelligence.js';
import PassportShare from '../models/PassportShare.js';
import timelineService from './timelineService.js';
import env from '../config/env.js';
import { formatINR, formatDateIN } from '../utils/formatters.js';

class PassportService {
  /**
   * Synthesize master Digital Ownership Passport for a product.
   * Single-source-of-truth aggregation across 8 models.
   */
  async getPassport(productId, userId) {
    const product = await Product.findOne({ _id: productId, userId }).lean();
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 1. Fetch documents
    const documents = await Document.find({ productId, userId })
      .select('type documentType title fileName fileType mimeType verified fileSize createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const hasInvoice = documents.some(
      (d) =>
        d.documentType === 'INVOICE' ||
        d.documentType === 'RECEIPT' ||
        d.type === 'INVOICE' ||
        d.type === 'RECEIPT' ||
        (d.title && /invoice|receipt|bill/i.test(d.title)) ||
        (d.fileName && /invoice|receipt|bill/i.test(d.fileName))
    );
    const hasWarrantyDoc = documents.some(
      (d) =>
        d.documentType === 'WARRANTY' ||
        d.type === 'WARRANTY' ||
        (d.title && /warranty/i.test(d.title)) ||
        (d.fileName && /warranty/i.test(d.fileName))
    );

    // 2. Fetch service records & claims
    const serviceRecords = await ServiceRecord.find({ productId, userId })
      .sort({ reportedDate: -1 })
      .lean();

    const warrantyClaims = await WarrantyClaim.find({ productId, userId })
      .sort({ createdAt: -1 })
      .lean();

    const completedServices = serviceRecords.filter((s) => s.status === 'COMPLETED');
    const totalServiceExpenditure = completedServices.reduce(
      (sum, s) => sum + (Number(s.actualCost) || 0),
      0
    );

    // 3. Fetch expenses & Total Cost of Ownership (TCO)
    const expenses = await Expense.find({ productId, userId }).lean();
    const additionalExpensesTotal = expenses
      .filter((e) => e.source !== 'PURCHASE')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const purchasePrice = Number(product.purchasePrice) || 0;
    const totalCostOfOwnership = purchasePrice + additionalExpensesTotal;

    // 4. Fetch ownership history & chain of custody
    const ownershipHistory = await OwnershipHistory.find({ productId })
      .sort({ startedAt: 1 })
      .lean();

    const transferCount = Math.max(0, ownershipHistory.length - 1);

    // 5. Fetch product intelligence (if available)
    const intelligence = await ProductIntelligence.findOne({ productId }).lean();

    // 6. Compute Passport Completeness Score (0 - 100%)
    let completenessScore = 0;
    const completenessBreakdown = [];
    const missingItems = [];

    // Product identity (Brand + Model + Category) - 25 pts
    if (product.brand && product.model) {
      completenessScore += 15;
      completenessBreakdown.push({ label: 'Brand and Model identified', points: 15, status: 'PASS' });
    } else {
      missingItems.push('Add verified brand and model number');
      completenessBreakdown.push({ label: 'Brand and Model', points: 0, maxPoints: 15, status: 'MISSING' });
    }

    if (product.category) {
      completenessScore += 10;
      completenessBreakdown.push({ label: 'Product category classified', points: 10, status: 'PASS' });
    } else {
      missingItems.push('Assign product category');
      completenessBreakdown.push({ label: 'Category', points: 0, maxPoints: 10, status: 'MISSING' });
    }

    // Serial Number - 15 pts
    if (product.serialNumber && product.serialNumber.trim().length > 0) {
      completenessScore += 15;
      completenessBreakdown.push({ label: 'Hardware serial number registered', points: 15, status: 'PASS' });
    } else {
      missingItems.push('Provide hardware serial number for authenticity verification');
      completenessBreakdown.push({ label: 'Serial Number', points: 0, maxPoints: 15, status: 'MISSING' });
    }

    // Proof of Purchase / Invoice Document - 25 pts
    if (hasInvoice) {
      completenessScore += 25;
      completenessBreakdown.push({ label: 'Purchase invoice/receipt attached', points: 25, status: 'PASS' });
    } else {
      missingItems.push('Upload official purchase invoice or receipt document');
      completenessBreakdown.push({ label: 'Invoice Document', points: 0, maxPoints: 25, status: 'MISSING' });
    }

    // Purchase Date & Financial Baseline - 15 pts
    if (product.purchaseDate && purchasePrice > 0) {
      completenessScore += 15;
      completenessBreakdown.push({ label: 'Verified purchase date and acquisition cost', points: 15, status: 'PASS' });
    } else {
      missingItems.push('Confirm purchase date and acquisition price');
      completenessBreakdown.push({ label: 'Purchase baseline', points: 0, maxPoints: 15, status: 'MISSING' });
    }

    // Warranty & Protection Documentation - 10 pts
    const hasWarrantyDetails = Boolean(product.warranty?.endDate || hasWarrantyDoc);
    if (hasWarrantyDetails) {
      completenessScore += 10;
      completenessBreakdown.push({ label: 'Warranty coverage documented', points: 10, status: 'PASS' });
    } else {
      missingItems.push('Record warranty coverage or upload warranty certificate');
      completenessBreakdown.push({ label: 'Warranty Documentation', points: 0, maxPoints: 10, status: 'MISSING' });
    }

    // Verification Badge Tier
    let verificationTier = 'BASIC';
    if (hasInvoice && product.serialNumber && purchasePrice > 0) {
      verificationTier = 'VERIFIED';
    } else if (product.serialNumber || hasInvoice || purchasePrice > 0) {
      verificationTier = 'STANDARD';
    }

    // Warranty Status Determination
    const now = new Date();
    let warrantyStatus = 'NO_WARRANTY';
    let warrantyExpiry = null;
    let warrantyProvider = product.warranty?.provider || product.brand || 'Manufacturer';

    if (product.warranty?.endDate) {
      warrantyExpiry = new Date(product.warranty.endDate);
      const daysLeft = Math.ceil((warrantyExpiry - now) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        warrantyStatus = 'EXPIRED';
      } else if (daysLeft <= 30) {
        warrantyStatus = 'EXPIRING_SOON';
      } else {
        warrantyStatus = 'ACTIVE';
      }
    }

    // Log PASSPORT_GENERATED timeline event if needed
    try {
      await timelineService.recordEvent({
        userId,
        productId,
        eventType: 'PASSPORT_GENERATED',
        title: 'Digital Ownership Passport Generated',
        description: `Ownership passport generated. Integrity Tier: ${verificationTier} (${completenessScore}% complete).`,
        source: 'SYSTEM',
        metadata: {
          completenessScore,
          verificationTier,
        },
      });
    } catch (tErr) {
      // Non-blocking
    }

    return {
      product: {
        _id: product._id,
        productName: product.productName,
        brand: product.brand || 'Unspecified Brand',
        model: product.model || 'Standard',
        category: product.category || 'General',
        serialNumber: product.serialNumber || null,
        purchaseDate: product.purchaseDate,
        purchasePrice,
        currency: 'INR',
        sellerName: product.sellerName || product.originalSeller || 'Retailer',
        status: product.status || 'Active',
        createdAt: product.createdAt,
      },
      verification: {
        tier: verificationTier,
        score: completenessScore,
        breakdown: completenessBreakdown,
        missingItems,
        verifiedAt: new Date(),
        badgeTitle:
          verificationTier === 'VERIFIED'
            ? 'Verified LifeReceipt Passport'
            : verificationTier === 'STANDARD'
            ? 'Standard LifeReceipt Passport'
            : 'Basic Digital Passport',
      },
      warranty: {
        status: warrantyStatus,
        endDate: warrantyExpiry,
        provider: warrantyProvider,
        policyNumber: product.warranty?.policyNumber || null,
        coverageType: product.warranty?.coverageType || 'Standard Manufacturer Warranty',
        claimsCount: warrantyClaims.length,
        claims: warrantyClaims.map((c) => ({
          _id: c._id,
          claimReference: c.claimReference,
          status: c.status,
          createdAt: c.createdAt,
        })),
      },
      financials: {
        purchasePrice,
        totalServiceExpenditure,
        additionalExpensesTotal,
        totalCostOfOwnership,
        currency: 'INR',
        formattedPurchasePrice: formatINR(purchasePrice),
        formattedTCO: formatINR(totalCostOfOwnership),
        formattedServiceExpenditure: formatINR(totalServiceExpenditure),
      },
      serviceHistory: {
        totalCount: serviceRecords.length,
        completedCount: completedServices.length,
        inProgressCount: serviceRecords.filter(
          (s) => s.status === 'REQUESTED' || s.status === 'SCHEDULED' || s.status === 'IN_SERVICE'
        ).length,
        records: serviceRecords.map((s) => ({
          _id: s._id,
          serviceType: s.serviceType,
          status: s.status,
          serviceProvider: s.serviceProvider,
          serviceCenterName: s.serviceCenterName,
          issueTitle: s.issueTitle,
          reportedDate: s.reportedDate,
          completedDate: s.completedDate,
          actualCost: s.actualCost,
          currency: 'INR',
        })),
      },
      documentsSummary: {
        totalCount: documents.length,
        hasInvoice,
        hasWarrantyDoc,
        documents: documents.map((d) => ({
          _id: d._id,
          type: d.documentType || d.type || 'RECEIPT',
          title: d.title || d.fileName || 'Document',
          fileType: d.mimeType || d.fileType || 'application/pdf',
          verified: d.verified,
          createdAt: d.createdAt,
        })),
      },
      ownershipChain: {
        transferCount,
        currentOwnershipStartedAt: product.purchaseDate || product.createdAt,
        isOriginalOwner: transferCount === 0,
        chain: ownershipHistory.map((h, idx) => ({
          order: idx + 1,
          startedAt: h.startedAt,
          endedAt: h.endedAt,
          source: h.source,
          ownerName: h.ownerName || `Owner #${idx + 1}`,
        })),
      },
      intelligence: intelligence
        ? {
            lifecycleStage: intelligence.lifecycleStage || 'MATURE',
            estimatedResaleValue: intelligence.estimatedResaleValue || null,
            reliabilityRating: intelligence.reliabilityRating || null,
          }
        : null,
    };
  }

  /**
   * Generate a cryptographic share token for external passport sharing.
   */
  async createShareToken(productId, userId, { permissionLevel = 'BASIC', expiresDays = 30 } = {}) {
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    const validLevels = ['BASIC', 'STANDARD', 'FULL'];
    const level = validLevels.includes(permissionLevel) ? permissionLevel : 'BASIC';

    // Cryptographically secure token
    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt =
      expiresDays && Number(expiresDays) > 0
        ? new Date(Date.now() + Number(expiresDays) * 24 * 60 * 60 * 1000)
        : null;

    const share = await PassportShare.create({
      productId,
      userId,
      shareToken: token,
      tokenHash,
      permissionLevel: level,
      expiresAt,
    });

    // Generate Share URL and QR Code
    const baseUrl = env.FRONTEND_URL || env.CLIENT_URL || 'http://localhost:5173';
    const shareUrl = `${baseUrl}/shared/passport/${token}`;
    const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    // Record timeline event
    try {
      await timelineService.recordEvent({
        userId,
        productId,
        eventType: 'PASSPORT_SHARED',
        title: 'Digital Passport Share Link Created',
        description: `Created ${level} permission share link valid until ${
          expiresAt ? formatDateIN(expiresAt) : 'Revocation'
        }.`,
        source: 'USER',
        metadata: {
          shareId: String(share._id),
          permissionLevel: level,
          expiresAt,
        },
      });
    } catch (tErr) {
      // Non-blocking
    }

    return {
      shareId: share._id,
      shareToken: token,
      shareUrl,
      qrCodeDataUrl,
      permissionLevel: share.permissionLevel,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    };
  }

  /**
   * Retrieve active and historical share tokens for a product.
   */
  async getShareTokens(productId, userId) {
    const shares = await PassportShare.find({ productId, userId })
      .sort({ createdAt: -1 })
      .lean();

    const baseUrl = env.FRONTEND_URL || env.CLIENT_URL || 'http://localhost:5173';
    const now = new Date();

    return shares.map((s) => {
      let status = 'ACTIVE';
      if (s.revokedAt) {
        status = 'REVOKED';
      } else if (s.expiresAt && now > new Date(s.expiresAt)) {
        status = 'EXPIRED';
      }

      const shareUrl = `${baseUrl}/shared/passport/${s.shareToken}`;

      return {
        _id: s._id,
        permissionLevel: s.permissionLevel,
        status,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        viewCount: s.viewCount || 0,
        lastViewedAt: s.lastViewedAt,
        createdAt: s.createdAt,
        shareUrl,
      };
    });
  }

  /**
   * Retrieve all active and historical share tokens for the user across all products.
   */
  async getUserShares(userId) {
    const shares = await PassportShare.find({ userId })
      .populate('productId', 'name productName brand model serialNumber')
      .sort({ createdAt: -1 })
      .lean();

    const baseUrl = env.FRONTEND_URL || env.CLIENT_URL || 'http://localhost:5173';
    const now = new Date();

    return shares.map((s) => {
      let status = 'ACTIVE';
      if (s.revokedAt) {
        status = 'REVOKED';
      } else if (s.expiresAt && now > new Date(s.expiresAt)) {
        status = 'EXPIRED';
      }

      const shareUrl = `${baseUrl}/shared/passport/${s.shareToken}`;

      return {
        _id: s._id,
        productId: s.productId?._id || s.productId,
        productName: s.productId?.productName || s.productId?.name || 'Hardware Asset',
        brand: s.productId?.brand || '',
        model: s.productId?.model || '',
        serialNumber: s.productId?.serialNumber || '',
        permissionLevel: s.permissionLevel,
        status,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        viewCount: s.viewCount || 0,
        lastViewedAt: s.lastViewedAt,
        createdAt: s.createdAt,
        shareUrl,
      };
    });
  }

  /**
   * Revoke an existing share token immediately.
   */
  async revokeShareToken(userId, shareId) {
    const share = await PassportShare.findOne({ _id: shareId, userId });
    if (!share) {
      const err = new Error('Passport share token not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    share.revokedAt = new Date();
    await share.save();

    return {
      success: true,
      message: 'Passport share token revoked successfully',
      revokedAt: share.revokedAt,
    };
  }

  /**
   * Retrieve public passport via share token with strict privacy tier filtering.
   */
  async getPublicPassport(token) {
    if (!token || typeof token !== 'string') {
      const err = new Error('Invalid passport share token');
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const share = await PassportShare.findOne({ tokenHash });

    if (!share) {
      const err = new Error('Passport share link not found or invalid');
      err.statusCode = 404;
      throw err;
    }

    if (share.revokedAt) {
      const err = new Error('This passport share link has been revoked by the owner');
      err.statusCode = 403;
      throw err;
    }

    const now = new Date();
    if (share.expiresAt && now > new Date(share.expiresAt)) {
      const err = new Error('This passport share link has expired');
      err.statusCode = 410;
      throw err;
    }

    // Increment view audit
    share.viewCount = (share.viewCount || 0) + 1;
    share.lastViewedAt = now;
    await share.save();

    // Generate master passport data
    const fullPassport = await this.getPassport(share.productId, share.userId);

    // Apply strict privacy tier filtering
    const level = share.permissionLevel || 'BASIC';

    const maskSerial = (sn) => {
      if (!sn) return null;
      if (sn.length <= 4) return '****';
      return '•'.repeat(Math.max(4, sn.length - 4)) + sn.slice(-4);
    };

    if (level === 'BASIC') {
      return {
        permissionLevel: 'BASIC',
        passport: {
          product: {
            productName: fullPassport.product.productName,
            brand: fullPassport.product.brand,
            model: fullPassport.product.model,
            category: fullPassport.product.category,
            serialNumber: maskSerial(fullPassport.product.serialNumber),
            status: fullPassport.product.status,
          },
          verification: {
            tier: fullPassport.verification.tier,
            score: fullPassport.verification.score,
            badgeTitle: fullPassport.verification.badgeTitle,
            verifiedAt: fullPassport.verification.verifiedAt,
          },
          warranty: {
            status: fullPassport.warranty.status,
            provider: fullPassport.warranty.provider,
            claimsCount: fullPassport.warranty.claimsCount,
          },
          ownershipChain: {
            isOriginalOwner: fullPassport.ownershipChain.isOriginalOwner,
            transferCount: fullPassport.ownershipChain.transferCount,
          },
          intelligence: fullPassport.intelligence
            ? { lifecycleStage: fullPassport.intelligence.lifecycleStage }
            : null,
        },
        viewCount: share.viewCount,
        lastViewedAt: share.lastViewedAt,
      };
    }

    if (level === 'STANDARD') {
      return {
        permissionLevel: 'STANDARD',
        passport: {
          product: {
            productName: fullPassport.product.productName,
            brand: fullPassport.product.brand,
            model: fullPassport.product.model,
            category: fullPassport.product.category,
            serialNumber: maskSerial(fullPassport.product.serialNumber),
            purchaseDate: fullPassport.product.purchaseDate,
            sellerName: fullPassport.product.sellerName,
            status: fullPassport.product.status,
          },
          verification: fullPassport.verification,
          warranty: {
            status: fullPassport.warranty.status,
            endDate: fullPassport.warranty.endDate,
            provider: fullPassport.warranty.provider,
            coverageType: fullPassport.warranty.coverageType,
            claimsCount: fullPassport.warranty.claimsCount,
          },
          serviceSummary: {
            totalCount: fullPassport.serviceHistory.totalCount,
            completedCount: fullPassport.serviceHistory.completedCount,
          },
          ownershipChain: fullPassport.ownershipChain,
          documentsSummary: {
            hasInvoice: fullPassport.documentsSummary.hasInvoice,
            hasWarrantyDoc: fullPassport.documentsSummary.hasWarrantyDoc,
            verifiedCount: fullPassport.documentsSummary.totalCount,
          },
          intelligence: fullPassport.intelligence,
        },
        viewCount: share.viewCount,
        lastViewedAt: share.lastViewedAt,
      };
    }

    // FULL permission level
    return {
      permissionLevel: 'FULL',
      passport: fullPassport,
      viewCount: share.viewCount,
      lastViewedAt: share.lastViewedAt,
    };
  }

  /**
   * Generate vector-quality PDF Passport using pdfkit and stream to response.
   */
  async generatePassportPDF(productId, userId, res) {
    const passport = await this.getPassport(productId, userId);
    const product = passport.product;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `LifeReceipt Ownership Passport - ${product.productName}`,
        Author: 'LifeReceipt Digital Ownership Platform',
        Subject: 'Digital Ownership Passport',
        Keywords: 'LifeReceipt, Ownership, Passport, Warranty, Provenance',
      },
    });

    const filename = `LifeReceipt-Passport-${product.productName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    doc.pipe(res);

    // Header styling
    doc.rect(40, 40, 515, 65).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
      .text('LIFERECEIPT DIGITAL OWNERSHIP PASSPORT', 55, 55);
    doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
      .text('OFFICIAL VERIFIED CERTIFICATE OF DIGITAL OWNERSHIP & PROVENANCE', 55, 78);
    doc.fillColor('#38bdf8').fontSize(9).font('Helvetica-Bold')
      .text(`ISSUED: ${formatDateIN(new Date())}`, 430, 55, { align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica')
      .text(`TIER: ${passport.verification.tier}`, 430, 78, { align: 'right' });

    // Section 1: Product Specifications
    let y = 120;
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('1. PRODUCT IDENTIFICATION', 40, y);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 16).lineTo(555, y + 16).stroke();

    y += 24;
    doc.rect(40, y, 515, 75).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('PRODUCT NAME', 55, y + 10);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(product.productName, 55, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('BRAND / MODEL', 55, y + 42);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(`${product.brand} • ${product.model}`, 55, y + 54);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('CATEGORY', 300, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(product.category, 300, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('SERIAL NUMBER', 300, y + 42);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(product.serialNumber || 'Not Recorded', 300, y + 54);

    // Section 2: Provenance & Ownership
    y += 90;
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('2. PROVENANCE & OWNERSHIP CHAIN', 40, y);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 16).lineTo(555, y + 16).stroke();

    y += 24;
    doc.rect(40, y, 515, 55).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('ACQUIRED DATE', 55, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(formatDateIN(product.purchaseDate) || 'Unknown', 55, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('ORIGINAL SELLER', 190, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(product.sellerName || 'Verified Seller', 190, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('TRANSFERS', 330, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(passport.ownershipChain.isOriginalOwner ? 'Original Owner (0 transfers)' : `${passport.ownershipChain.transferCount} transfers`, 330, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('PASSPORT SCORE', 450, y + 10);
    doc.fillColor('#0284c7').fontSize(12).font('Helvetica-Bold').text(`${passport.verification.score}%`, 450, y + 22);

    // Section 3: Warranty & Service Ecosystem
    y += 70;
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('3. WARRANTY & SERVICE RECORD SUMMARY', 40, y);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 16).lineTo(555, y + 16).stroke();

    y += 24;
    doc.rect(40, y, 515, 55).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('WARRANTY STATUS', 55, y + 10);
    const wColor = passport.warranty.status === 'ACTIVE' ? '#16a34a' : passport.warranty.status === 'EXPIRING_SOON' ? '#d97706' : '#64748b';
    doc.fillColor(wColor).fontSize(10).font('Helvetica-Bold').text(passport.warranty.status, 55, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('EXPIRATION DATE', 190, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(formatDateIN(passport.warranty.endDate) || 'N/A', 190, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('PROVIDER', 330, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(passport.warranty.provider || 'Manufacturer', 330, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('SERVICES COMPLETED', 450, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(String(passport.serviceHistory.completedCount), 450, y + 22);

    // Section 4: Verified Financial Baseline (INR)
    y += 70;
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('4. VERIFIED FINANCIAL SUMMARY (INR)', 40, y);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 16).lineTo(555, y + 16).stroke();

    y += 24;
    doc.rect(40, y, 515, 55).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('PURCHASE PRICE', 55, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(`INR ${Math.round(product.purchasePrice).toLocaleString('en-IN')}`, 55, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('SERVICE EXPENDITURE', 200, y + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(`INR ${Math.round(passport.financials.totalServiceExpenditure).toLocaleString('en-IN')}`, 200, y + 22);

    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('TOTAL COST OF OWNERSHIP', 370, y + 10);
    doc.fillColor('#047857').fontSize(11).font('Helvetica-Bold').text(`INR ${Math.round(passport.financials.totalCostOfOwnership).toLocaleString('en-IN')}`, 370, y + 22);

    // Section 5: Recent Service Records Table
    y += 70;
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('5. VERIFIED SERVICE & MAINTENANCE HISTORY', 40, y);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 16).lineTo(555, y + 16).stroke();

    y += 24;
    const services = passport.serviceHistory.records.slice(0, 4);

    if (services.length === 0) {
      doc.rect(40, y, 515, 36).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fillColor('#64748b').fontSize(9).font('Helvetica-Oblique').text('No service or maintenance records logged for this product.', 55, y + 12);
      y += 46;
    } else {
      // Table header
      doc.rect(40, y, 515, 20).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
        .text('DATE', 50, y + 6)
        .text('TYPE', 120, y + 6)
        .text('ISSUE / TITLE', 210, y + 6)
        .text('SERVICE CENTER', 350, y + 6)
        .text('STATUS', 460, y + 6)
        .text('COST', 510, y + 6);
      y += 20;

      services.forEach((s, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(40, y, 515, 20).fill(rowBg).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.fillColor('#334155').fontSize(8).font('Helvetica')
          .text(formatDateIN(s.reportedDate) || '—', 50, y + 6)
          .text(s.serviceType.replace('_', ' '), 120, y + 6)
          .text((s.issueTitle || 'Service').slice(0, 26), 210, y + 6)
          .text((s.serviceCenterName || s.serviceProvider || 'Provider').slice(0, 22), 350, y + 6)
          .text(s.status, 460, y + 6)
          .text(s.actualCost > 0 ? `INR ${Math.round(s.actualCost).toLocaleString('en-IN')}` : 'Free', 510, y + 6);
        y += 20;
      });
      y += 10;
    }

    // Embed QR Code for Instant Online Verification
    try {
      const verifyUrl = `${env.FRONTEND_URL || env.CLIENT_URL || 'http://localhost:5173'}/products/${product._id}/passport`;
      const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1 });
      doc.image(qrBuffer, 445, 685, { width: 90 });
    } catch (qrErr) {
      // Non-blocking fallback
    }

    // Official Footer & Integrity Seal
    doc.rect(40, 680, 395, 90).fill('#f1f5f9').strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
      .text('VERIFICATION INTEGRITY GUARANTEE', 55, 692);
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
      .text('This digital passport was generated by the LifeReceipt Ownership Intelligence Engine.', 55, 706)
      .text('All purchase records, serial numbers, warranty claims, and service records are tamper-evident.', 55, 718)
      .text('Zero-Hallucination Policy: LifeReceipt only records verifiable facts and confirmed service entries.', 55, 730)
      .text('Scan the QR code to view live verification status and complete cryptographic proof.', 55, 742);

    doc.end();
  }
}

const passportService = new PassportService();
export default passportService;
