import Product from '../models/Product.js';
import Document from '../models/Document.js';
import Expense from '../models/Expense.js';
import OwnershipTransfer from '../models/OwnershipTransfer.js';
import OwnershipHistory from '../models/OwnershipHistory.js';
import { formatDateIN } from '../utils/formatters.js';

class LifecycleService {
  /**
   * Format the duration between two dates into human-readable Indian English.
   * e.g., "8 months", "1 year, 2 months", "15 days"
   */
  formatDuration(startDate, endDate = new Date()) {
    if (!startDate) return 'Ownership age unavailable';
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return 'Ownership age unavailable';
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts = [];
    if (years > 0) {
      parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
    }
    if (months > 0) {
      parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
    }
    if (years === 0 && months === 0) {
      parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }

    return parts.join(', ') || '0 days';
  }

  /**
   * Deterministic record completeness scoring formula.
   * Evaluates key ownership proof elements without arbitrary percentages.
   */
  calculateCompleteness(product, documents = []) {
    let score = 0;
    const missingFields = [];

    // 1. Purchase Date (15 pts)
    if (product.purchaseDate && !isNaN(new Date(product.purchaseDate).getTime())) {
      score += 15;
    } else {
      missingFields.push({ key: 'purchaseDate', label: 'Purchase Date', points: 15 });
    }

    // 2. Purchase Price (15 pts)
    if (product.purchasePrice !== undefined && product.purchasePrice > 0) {
      score += 15;
    } else {
      missingFields.push({ key: 'purchasePrice', label: 'Purchase Price', points: 15 });
    }

    // 3. Purchase Document / Invoice in Vault (25 pts)
    const hasDoc = documents.some((d) => ['RECEIPT', 'INVOICE'].includes(d.documentType));
    if (hasDoc) {
      score += 25;
    } else {
      missingFields.push({ key: 'hasDocument', label: 'Receipt / Invoice Document', points: 25 });
    }

    // 4. Serial Number (15 pts)
    if (product.serialNumber && product.serialNumber.trim()) {
      score += 15;
    } else {
      missingFields.push({ key: 'serialNumber', label: 'Hardware Serial Number', points: 15 });
    }

    // 5. Brand (10 pts)
    if (product.brand && product.brand.trim()) {
      score += 10;
    } else {
      missingFields.push({ key: 'brand', label: 'Brand', points: 10 });
    }

    // 6. Model (10 pts)
    if (product.model && product.model.trim()) {
      score += 10;
    } else {
      missingFields.push({ key: 'model', label: 'Model', points: 10 });
    }

    // 7. Seller Name (10 pts)
    if (product.sellerName && product.sellerName.trim()) {
      score += 10;
    } else {
      missingFields.push({ key: 'sellerName', label: 'Merchant / Seller Name', points: 10 });
    }

    let status = 'Incomplete';
    if (score >= 80) status = 'High Completeness';
    else if (score >= 50) status = 'Moderate';

    return {
      score,
      percentage: score,
      missingFields,
      status,
    };
  }

  /**
   * Deterministic Lifecycle Stage Priority Engine.
   * Priority:
   * 1. TRANSFER_PENDING
   * 2. DISPOSED
   * 3. SOLD
   * 4. RETURN_PERIOD
   * 5. WARRANTY_ACTIVE
   * 6. WARRANTY_EXPIRED
   * 7. LONG_TERM_OWNERSHIP (>= 24 months)
   * 8. ACTIVE_OWNERSHIP (default)
   */
  calculateLifecycleStage(product, activeTransfer = null) {
    const now = new Date();

    // 1. Pending Transfer
    if (activeTransfer && activeTransfer.status === 'PENDING' && new Date(activeTransfer.expiresAt) >= now) {
      return {
        stage: 'TRANSFER_PENDING',
        label: 'Transfer Pending',
        badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        description: `Ownership transfer pending recipient acceptance until ${formatDateIN(activeTransfer.expiresAt)}.`,
      };
    }

    // 2. Disposed
    if (product.status === 'Disposed') {
      return {
        stage: 'DISPOSED',
        label: 'Disposed',
        badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        description: 'Product has been responsibly recycled or disposed of.',
      };
    }

    // 3. Sold
    if (product.status === 'Sold') {
      return {
        stage: 'SOLD',
        label: 'Sold',
        badgeColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        description: 'Product has been resold or ownership transferred outside the platform.',
      };
    }

    // 4. Return Period Active
    if (
      product.returnInfo?.returnEligible &&
      product.returnInfo?.returnEndDate &&
      new Date(product.returnInfo.returnEndDate) >= now
    ) {
      return {
        stage: 'RETURN_PERIOD',
        label: 'Return Window Active',
        badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        description: `Eligible for return or exchange until ${formatDateIN(product.returnInfo.returnEndDate)}.`,
      };
    }

    // 5. Warranty Active
    if (
      product.warranty?.hasWarranty &&
      product.warranty?.warrantyEndDate &&
      new Date(product.warranty.warrantyEndDate) >= now
    ) {
      return {
        stage: 'WARRANTY_ACTIVE',
        label: 'Warranty Active',
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        description: `Protected under active warranty until ${formatDateIN(product.warranty.warrantyEndDate)}.`,
      };
    }

    // 6. Warranty Expired
    if (
      product.warranty?.hasWarranty &&
      product.warranty?.warrantyEndDate &&
      new Date(product.warranty.warrantyEndDate) < now
    ) {
      return {
        stage: 'WARRANTY_EXPIRED',
        label: 'Warranty Expired',
        badgeColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        description: `Warranty coverage concluded on ${formatDateIN(product.warranty.warrantyEndDate)}.`,
      };
    }

    // 7. Long-Term Ownership (owned >= 2 years)
    const pDate = product.purchaseDate ? new Date(product.purchaseDate) : null;
    if (pDate && !isNaN(pDate.getTime())) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      if (pDate <= twoYearsAgo) {
        return {
          stage: 'LONG_TERM_OWNERSHIP',
          label: 'Long-Term Ownership',
          badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
          description: 'Asset in sustained long-term ownership beyond initial warranty coverage.',
        };
      }
    }

    // 8. Normal Active Ownership
    return {
      stage: 'ACTIVE_OWNERSHIP',
      label: 'Active Ownership',
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      description: 'Product actively owned in digital ledger with regular ownership status.',
    };
  }

  /**
   * Retrieve complete lifecycle state and actionable metrics for a product.
   */
  async getProductLifecycle(arg1, arg2) {
    let product = await Product.findOne({ _id: arg1, userId: arg2 })
      .select('productName category brand model serialNumber purchaseDate purchasePrice currency warranty returnInfo status transferredAt originalPurchaseDate originalSeller sellerName')
      .lean();

    let productId = arg1;
    let userId = arg2;

    if (!product) {
      product = await Product.findOne({ _id: arg2, userId: arg1 })
        .select('productName category brand model serialNumber purchaseDate purchasePrice currency warranty returnInfo status transferredAt originalPurchaseDate originalSeller sellerName')
        .lean();
      if (product) {
        productId = arg2;
        userId = arg1;
      }
    }

    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // Fetch active pending transfer if any
    const now = new Date();
    const activeTransfer = await OwnershipTransfer.findOne({
      productId,
      status: 'PENDING',
      expiresAt: { $gte: now },
    }).lean();

    // Fetch associated documents
    const documents = await Document.find({ productId, userId })
      .select('documentType fileName fileSize createdAt')
      .lean();

    // Fetch service/repair expenses
    const expenses = await Expense.find({
      productId,
      expenseType: { $in: ['REPAIR', 'SERVICE', 'MAINTENANCE'] },
    })
      .sort({ expenseDate: -1 })
      .lean();

    // Fetch current ownership history
    const history = await OwnershipHistory.find({ productId })
      .sort({ startedAt: -1 })
      .lean();

    const currentHistory = history.find((h) => String(h.ownerUserId) === String(userId) && !h.endedAt);

    // Lifecycle stage calculation
    const stageInfo = this.calculateLifecycleStage(product, activeTransfer);

    // Age Calculations
    const originalStart = product.originalPurchaseDate || product.purchaseDate;
    const productAge = this.formatDuration(originalStart);
    const ownershipAge = this.formatDuration(currentHistory?.startedAt || product.purchaseDate);

    // Completeness Calculation
    const completeness = this.calculateCompleteness(product, documents);

    // Service activity metrics
    const repairCount = expenses.filter((e) => e.expenseType === 'REPAIR').length;
    const serviceCount = expenses.filter((e) => ['SERVICE', 'MAINTENANCE'].includes(e.expenseType)).length;
    const lastService = expenses.length > 0 ? expenses[0].expenseDate : null;

    // Recommended Actions
    const actions = [];
    if (stageInfo.stage === 'TRANSFER_PENDING') {
      actions.push({
        type: 'VIEW_TRANSFER',
        label: 'View Pending Transfer',
        description: `Waiting for ${activeTransfer.recipientEmail} to accept.`,
      });
    } else if (stageInfo.stage === 'RETURN_PERIOD') {
      actions.push({
        type: 'CHECK_RETURN',
        label: 'Check Return Policy',
        description: `Eligible for return until ${formatDateIN(product.returnInfo.returnEndDate)}.`,
      });
    } else if (stageInfo.stage === 'WARRANTY_ACTIVE') {
      actions.push({
        type: 'VIEW_WARRANTY',
        label: 'View Warranty Certificate',
        description: `Active coverage with ${product.warranty.warrantyProvider || 'manufacturer'}.`,
      });
    }

    if (completeness.missingFields.length > 0) {
      actions.push({
        type: 'COMPLETE_RECORD',
        label: 'Complete Ownership Record',
        description: `Add missing ${completeness.missingFields[0].label} to improve record integrity.`,
      });
    }

    return {
      product: {
        _id: product._id,
        productName: product.productName,
        category: product.category,
        brand: product.brand,
        model: product.model,
        serialNumber: product.serialNumber,
        status: product.status,
      },
      stage: stageInfo.stage,
      currentStage: stageInfo.stage,
      stageLabel: stageInfo.label,
      stageColor: stageInfo.badgeColor,
      stageDescription: stageInfo.description,
      age: {
        productAgeFormatted: productAge,
        ownershipAgeFormatted: ownershipAge,
        originalPurchaseDate: product.originalPurchaseDate || product.purchaseDate || null,
        ownershipStartDate: currentHistory?.startedAt || product.purchaseDate || null,
        isSecondHand: Boolean(product.transferredAt || product.originalPurchaseDate),
      },
      productAge,
      ownershipAge,
      isTransferred: Boolean(product.transferredAt),
      completeness,
      serviceStats: {
        totalServiceRecords: expenses.length,
        totalServiceCost: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
        repairCount,
        serviceCount,
        lastServiceDate: lastService ? formatDateIN(lastService) : null,
      },
      serviceActivity: {
        repairCount,
        serviceCount,
        totalEvents: expenses.length,
        lastServiceDate: lastService ? formatDateIN(lastService) : null,
      },
      activeTransfer: activeTransfer
        ? {
            _id: activeTransfer._id,
            recipientEmail: activeTransfer.recipientEmail,
            expiresAt: activeTransfer.expiresAt,
            initiatedAt: activeTransfer.initiatedAt,
          }
        : null,
      actions,
    };
  }

  /**
   * Portfolio-wide summary of product lifecycle stages for the authenticated user.
   */
  async getLifecycleSummary(userId) {
    const products = await Product.find({ userId })
      .select('productName category brand model purchaseDate purchasePrice warranty returnInfo status originalPurchaseDate')
      .lean();

    const productIds = products.map((p) => p._id);

    // Fetch active transfers
    const now = new Date();
    const activeTransfers = await OwnershipTransfer.find({
      productId: { $in: productIds },
      status: 'PENDING',
      expiresAt: { $gte: now },
    }).lean();

    const transferMap = new Map();
    for (const t of activeTransfers) {
      transferMap.set(String(t.productId), t);
    }

    // Fetch documents
    const documents = await Document.find({ productId: { $in: productIds }, userId })
      .select('productId documentType')
      .lean();

    const docMap = new Map();
    for (const d of documents) {
      const pIdStr = String(d.productId);
      if (!docMap.has(pIdStr)) docMap.set(pIdStr, []);
      docMap.get(pIdStr).push(d);
    }

    const stageCounts = {
      ACTIVE_OWNERSHIP: 0,
      WARRANTY_ACTIVE: 0,
      WARRANTY_EXPIRED: 0,
      RETURN_PERIOD: 0,
      TRANSFER_PENDING: 0,
      LONG_TERM_OWNERSHIP: 0,
      DISPOSED: 0,
      SOLD: 0,
    };

    let totalCompleteness = 0;
    const items = [];

    for (const prod of products) {
      const t = transferMap.get(String(prod._id)) || null;
      const docs = docMap.get(String(prod._id)) || [];
      const stageInfo = this.calculateLifecycleStage(prod, t);
      const completeness = this.calculateCompleteness(prod, docs);

      if (stageCounts[stageInfo.stage] !== undefined) {
        stageCounts[stageInfo.stage]++;
      }
      totalCompleteness += completeness.score;

      items.push({
        productId: prod._id,
        productName: prod.productName,
        category: prod.category,
        brand: prod.brand,
        stage: stageInfo.stage,
        stageLabel: stageInfo.label,
        stageColor: stageInfo.badgeColor,
        completenessScore: completeness.score,
        ownershipAge: this.formatDuration(prod.purchaseDate),
      });
    }

    const averageCompleteness =
      products.length > 0 ? Math.round(totalCompleteness / products.length) : 0;

    return {
      totalProducts: products.length,
      stages: stageCounts,
      stageCounts,
      averageCompleteness,
      incompleteRecordsCount: items.filter((i) => i.completenessScore < 70).length,
      items,
    };
  }
}

export default new LifecycleService();
