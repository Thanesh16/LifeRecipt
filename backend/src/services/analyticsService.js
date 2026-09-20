import Product from '../models/Product.js';
import Expense from '../models/Expense.js';

class AnalyticsService {
  /**
   * Deterministic calculation of ownership cost for a single product.
   * Single source of truth: Product.purchasePrice is authoritative.
   * Additional costs include only valid non-purchase expenses.
   */
  async calculateProductCost(userId, productId) {
    const product = await Product.findOne({ _id: productId, userId })
      .select('productName category brand model serialNumber purchaseDate purchasePrice currency warranty returnInfo')
      .lean();

    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // Authoritative purchase cost
    const purchaseCost = Number(product.purchasePrice) || 0;

    // Fetch all non-purchase expenses for this product
    const expenses = await Expense.find({
      userId,
      productId,
      expenseType: { $ne: 'PURCHASE' },
    })
      .sort({ expenseDate: -1 })
      .populate('relatedDocumentId', 'fileName fileSize mimeType documentType')
      .lean();

    const categoryBreakdown = {
      REPAIR: 0,
      SERVICE: 0,
      MAINTENANCE: 0,
      ACCESSORY: 0,
      REPLACEMENT: 0,
      OTHER: 0,
    };

    let additionalCost = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      additionalCost += amt;
      const type = exp.expenseType || 'OTHER';
      if (categoryBreakdown[type] !== undefined) {
        categoryBreakdown[type] += amt;
      } else {
        categoryBreakdown.OTHER += amt;
      }
    }

    const totalOwnershipCost = purchaseCost + additionalCost;
    const additionalCostPercentage =
      purchaseCost > 0 ? Number(((additionalCost / purchaseCost) * 100).toFixed(2)) : 0;

    return {
      product: {
        _id: product._id,
        productName: product.productName,
        category: product.category,
        brand: product.brand,
        model: product.model,
        serialNumber: product.serialNumber,
        purchaseDate: product.purchaseDate,
        currency: product.currency || 'INR',
        warranty: product.warranty,
        returnInfo: product.returnInfo,
      },
      purchaseCost,
      additionalCost,
      totalOwnershipCost,
      additionalCostPercentage,
      categoryBreakdown,
      expenseCount: expenses.length,
      expenses,
    };
  }

  /**
   * Deterministic calculation of global ownership metrics for the authenticated user.
   */
  async calculateGlobalOwnershipCost(userId) {
    // 1. Fetch user's registered products
    const products = await Product.find({ userId })
      .select('productName category brand model purchaseDate purchasePrice currency warranty returnInfo')
      .lean();

    // 2. Fetch all user's non-purchase ownership expenses
    const expenses = await Expense.find({
      userId,
      expenseType: { $ne: 'PURCHASE' },
    })
      .sort({ expenseDate: 1 })
      .lean();

    const totalProducts = products.length;
    let totalPurchaseCost = 0;

    // Map of productId -> product expense totals and categories
    const productExpenseMap = new Map();
    for (const p of products) {
      totalPurchaseCost += Number(p.purchasePrice) || 0;
      productExpenseMap.set(String(p._id), {
        additionalCost: 0,
        count: 0,
        categories: {
          REPAIR: 0,
          SERVICE: 0,
          MAINTENANCE: 0,
          ACCESSORY: 0,
          REPLACEMENT: 0,
          OTHER: 0,
        },
      });
    }

    let additionalOwnershipCost = 0;
    const categoryBreakdown = {
      REPAIR: 0,
      SERVICE: 0,
      MAINTENANCE: 0,
      ACCESSORY: 0,
      REPLACEMENT: 0,
      OTHER: 0,
    };

    // Monthly aggregation map: 'YYYY-MM' -> amount
    const monthlyMap = new Map();

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      additionalOwnershipCost += amt;

      const type = exp.expenseType || 'OTHER';
      if (categoryBreakdown[type] !== undefined) {
        categoryBreakdown[type] += amt;
      } else {
        categoryBreakdown.OTHER += amt;
      }

      // Per-product tracking
      const pIdStr = String(exp.productId);
      if (productExpenseMap.has(pIdStr)) {
        const pData = productExpenseMap.get(pIdStr);
        pData.additionalCost += amt;
        pData.count += 1;
        if (pData.categories[type] !== undefined) {
          pData.categories[type] += amt;
        } else {
          pData.categories.OTHER += amt;
        }
      }

      // Monthly aggregation
      const expDate = exp.expenseDate ? new Date(exp.expenseDate) : new Date();
      if (!isNaN(expDate.getTime())) {
        const year = expDate.getFullYear();
        const month = String(expDate.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            monthKey,
            year,
            month: expDate.getMonth() + 1,
            totalAmount: 0,
            count: 0,
          });
        }
        const mObj = monthlyMap.get(monthKey);
        mObj.totalAmount += amt;
        mObj.count += 1;
      }
    }

    const totalOwnershipCost = totalPurchaseCost + additionalOwnershipCost;
    const globalAdditionalPercentage =
      totalPurchaseCost > 0
        ? Number(((additionalOwnershipCost / totalPurchaseCost) * 100).toFixed(2))
        : 0;

    // Format monthly expenses timeline
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const monthlyExpenses = Array.from(monthlyMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((m) => ({
        month: m.monthKey,
        monthLabel: `${monthNames[m.month - 1]} ${m.year}`,
        totalAmount: m.totalAmount,
        expenseCount: m.count,
      }));

    // Product comparisons
    const productComparisons = products.map((p) => {
      const pIdStr = String(p._id);
      const expenseData = productExpenseMap.get(pIdStr) || {
        additionalCost: 0,
        count: 0,
        categories: {},
      };
      const purchaseCost = Number(p.purchasePrice) || 0;
      const additionalCost = expenseData.additionalCost;
      const totalCost = purchaseCost + additionalCost;
      const additionalCostPct =
        purchaseCost > 0 ? Number(((additionalCost / purchaseCost) * 100).toFixed(2)) : 0;

      return {
        productId: p._id,
        productName: p.productName,
        brand: p.brand || '',
        model: p.model || '',
        category: p.category,
        purchaseCost,
        additionalCost,
        totalOwnershipCost: totalCost,
        additionalCostPercentage: additionalCostPct,
        expenseCount: expenseData.count,
        categoryBreakdown: expenseData.categories,
      };
    });

    // Sort by total ownership cost descending
    productComparisons.sort((a, b) => b.totalOwnershipCost - a.totalOwnershipCost);

    return {
      totalProducts,
      totalPurchaseCost,
      additionalOwnershipCost,
      totalAdditionalCost: additionalOwnershipCost,
      totalOwnershipCost,
      globalAdditionalPercentage,
      currency: 'INR',
      categoryBreakdown,
      monthlyExpenses,
      productComparisons,
    };
  }
}

export default new AnalyticsService();
