import analyticsService from './analyticsService.js';
import Document from '../models/Document.js';
import { formatINR, formatDateIN } from '../utils/formatters.js';

class InsightService {
  /**
   * Generate factual, verified AI ownership insights for a specific product.
   * Consumes deterministic calculations from analyticsService.
   */
  async getProductInsights(userId, productId) {
    const costData = await analyticsService.calculateProductCost(userId, productId);
    const { product, purchaseCost, additionalCost, totalOwnershipCost, additionalCostPercentage, categoryBreakdown, expenses } = costData;

    const insights = [];

    // Check if any documents exist for this product
    const docs = await Document.find({ userId, productId }).select('documentType fileName').lean();
    const hasInvoice = docs.some((d) => ['RECEIPT', 'INVOICE'].includes(d.documentType));
    const hasServiceDoc = docs.some((d) => d.documentType === 'SERVICE_INVOICE');

    // 1. HIGH_ADDITIONAL_COST: >= 25% of purchase price
    if (purchaseCost > 0 && additionalCostPercentage >= 25) {
      insights.push({
        type: 'HIGH_ADDITIONAL_COST',
        title: 'High Additional Ownership Cost',
        icon: 'TrendingUp',
        level: 'WARNING',
        description: `This product has accumulated ${formatINR(additionalCost)} in additional recorded expenses, equal to ${additionalCostPercentage}% of its purchase price.`,
        metric: {
          purchaseCost: formatINR(purchaseCost),
          additionalCost: formatINR(additionalCost),
          percentage: `${additionalCostPercentage}%`,
        },
      });
    }

    // 2. REPEATED_REPAIR: >= 2 repair or service expenses
    const repairExpenses = expenses.filter((e) => ['REPAIR', 'SERVICE'].includes(e.expenseType));
    if (repairExpenses.length >= 2) {
      const repairTotal = repairExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      insights.push({
        type: 'REPEATED_REPAIR',
        title: 'Repeated Repair Pattern',
        icon: 'Wrench',
        level: 'WARNING',
        description: `This ${product.category?.toLowerCase() || 'product'} has ${repairExpenses.length} recorded repair expenses totaling ${formatINR(repairTotal)}.`,
        metric: {
          count: repairExpenses.length,
          total: formatINR(repairTotal),
        },
      });
    }

    // 3. WARRANTY_RELATED_EXPENSE: repair/service during active warranty period
    if (product.warranty?.hasWarranty && product.warranty?.warrantyStartDate && product.warranty?.warrantyEndDate) {
      const wStart = new Date(product.warranty.warrantyStartDate).getTime();
      const wEnd = new Date(product.warranty.warrantyEndDate).getTime();

      const inWarrantyExpenses = expenses.filter((e) => {
        if (!['REPAIR', 'SERVICE'].includes(e.expenseType)) return false;
        const eTime = new Date(e.expenseDate).getTime();
        return eTime >= wStart && eTime <= wEnd;
      });

      if (inWarrantyExpenses.length > 0) {
        const inWTotal = inWarrantyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        insights.push({
          type: 'WARRANTY_RELATED_EXPENSE',
          title: 'Warranty-Period Expense Recorded',
          icon: 'ShieldAlert',
          level: 'WARNING',
          description: `You recorded a ${formatINR(inWTotal)} repair expense while the product's stored warranty period was active. Check the warranty terms or service documentation to determine whether the expense was eligible for warranty coverage.`,
          metric: {
            inWarrantyAmount: formatINR(inWTotal),
            warrantyEndDate: formatDateIN(product.warranty.warrantyEndDate),
          },
        });
      }
    }

    // 4. MISSING_SERVICE_HISTORY: repairs/maintenance exist without linked documents
    const hasUnlinkedRepair = expenses.some(
      (e) => ['REPAIR', 'MAINTENANCE', 'SERVICE'].includes(e.expenseType) && !e.relatedDocumentId
    );
    if (hasUnlinkedRepair && !hasServiceDoc) {
      insights.push({
        type: 'MISSING_SERVICE_HISTORY',
        title: 'Missing Service Documentation',
        icon: 'FileQuestion',
        level: 'ACTION_REQUIRED',
        description: `Your ${product.productName} has recorded repair or service expenses, but no service document is currently linked to those expenses.`,
        action: 'Link or upload a service invoice',
      });
    }

    // 5. MISSING_DOCUMENTATION: product has price but no receipt/invoice document
    if (purchaseCost > 0 && !hasInvoice) {
      insights.push({
        type: 'MISSING_DOCUMENTATION',
        title: 'Missing Purchase Invoice',
        icon: 'FileText',
        level: 'ACTION_REQUIRED',
        description: `This product has a purchase price of ${formatINR(purchaseCost)}, but no invoice or receipt document has been uploaded to the vault.`,
        action: 'Upload purchase receipt',
      });
    }

    // 6. COST_CONCENTRATION: single category >= 60% of additional costs
    if (additionalCost > 0 && expenses.length >= 2) {
      for (const [cat, amt] of Object.entries(categoryBreakdown)) {
        if (amt / additionalCost >= 0.6) {
          const catName = cat.charAt(0) + cat.slice(1).toLowerCase();
          insights.push({
            type: 'COST_CONCENTRATION',
            title: 'Expense Category Concentration',
            icon: 'PieChart',
            level: 'INFO',
            description: `${catName} expenses account for the largest share (${Math.round((amt / additionalCost) * 100)}%) of this product's recorded additional ownership costs.`,
            metric: {
              category: catName,
              amount: formatINR(amt),
            },
          });
          break;
        }
      }
    }

    // 7. UNUSUAL_EXPENSE_PATTERN: single expense >= 50% of purchase price
    if (purchaseCost > 0) {
      const highExpense = expenses.find((e) => Number(e.amount) >= purchaseCost * 0.5);
      if (highExpense) {
        insights.push({
          type: 'UNUSUAL_EXPENSE_PATTERN',
          title: 'High Single-Expense Event',
          icon: 'AlertCircle',
          level: 'WARNING',
          description: `A single ${highExpense.expenseType.toLowerCase()} expense of ${formatINR(highExpense.amount)} was recorded, exceeding 50% of the initial purchase price.`,
          metric: {
            title: highExpense.title,
            amount: formatINR(highExpense.amount),
          },
        });
      }
    }

    // 8. INCOMPLETE_OWNERSHIP_RECORD: missing serial number
    if (!product.serialNumber || !product.serialNumber.trim()) {
      insights.push({
        type: 'INCOMPLETE_OWNERSHIP_RECORD',
        title: 'Incomplete Ownership Profile',
        icon: 'HelpCircle',
        level: 'INFO',
        description: 'This product record is missing a serial number, which may complicate future warranty claims or authorized service verification.',
      });
    }

    return {
      productId,
      productName: product.productName,
      hasInsights: insights.length > 0,
      totalInsights: insights.length,
      insights,
      emptyMessage:
        insights.length === 0
          ? "There isn't enough recorded ownership data to generate meaningful insights yet."
          : null,
    };
  }

  /**
   * Generate global ownership insights across the user's entire portfolio.
   */
  async getGlobalInsights(userId) {
    const globalCost = await analyticsService.calculateGlobalOwnershipCost(userId);
    const {
      totalProducts,
      totalPurchaseCost,
      additionalOwnershipCost,
      totalOwnershipCost,
      globalAdditionalPercentage,
      monthlyExpenses,
      productComparisons,
      categoryBreakdown,
    } = globalCost;

    const insights = [];

    // 1. RISING_SPENDING: check if recent month exceeds previous average
    if (monthlyExpenses.length >= 2) {
      const lastMonth = monthlyExpenses[monthlyExpenses.length - 1];
      const previousMonths = monthlyExpenses.slice(0, -1);
      const prevAvg =
        previousMonths.reduce((sum, m) => sum + m.totalAmount, 0) / previousMonths.length;

      if (lastMonth.totalAmount > prevAvg * 1.2 && lastMonth.totalAmount > 0) {
        insights.push({
          type: 'RISING_SPENDING',
          title: 'Rising Ownership Spending',
          icon: 'TrendingUp',
          level: 'INFO',
          description: `Recorded ownership spending increased in ${lastMonth.monthLabel} (${formatINR(lastMonth.totalAmount)}) compared with previous months.`,
          metric: {
            latestMonth: lastMonth.monthLabel,
            latestAmount: formatINR(lastMonth.totalAmount),
            previousAverage: formatINR(Math.round(prevAvg)),
          },
        });
      }
    }

    // 2. HIGH_ADDITIONAL_COST: global portfolio additional cost >= 20%
    if (totalPurchaseCost > 0 && globalAdditionalPercentage >= 20) {
      insights.push({
        type: 'HIGH_ADDITIONAL_COST',
        title: 'Substantial Additional Ownership Costs',
        icon: 'IndianRupee',
        level: 'WARNING',
        description: `Across your registered assets, additional ownership expenses of ${formatINR(additionalOwnershipCost)} represent ${globalAdditionalPercentage}% of total initial purchase costs.`,
        metric: {
          totalPurchaseCost: formatINR(totalPurchaseCost),
          additionalOwnershipCost: formatINR(additionalOwnershipCost),
          percentage: `${globalAdditionalPercentage}%`,
        },
      });
    }

    // 3. HIGH_OWNERSHIP_COST concentration in a single product
    if (totalOwnershipCost > 0 && productComparisons.length >= 2) {
      const topProduct = productComparisons[0];
      const share = (topProduct.totalOwnershipCost / totalOwnershipCost) * 100;
      if (share >= 40) {
        insights.push({
          type: 'HIGH_OWNERSHIP_COST',
          title: 'Asset Cost Concentration',
          icon: 'PieChart',
          level: 'INFO',
          description: `${topProduct.productName} represents ${Math.round(share)}% (${formatINR(topProduct.totalOwnershipCost)}) of your entire registered ownership investment.`,
          metric: {
            productName: topProduct.productName,
            amount: formatINR(topProduct.totalOwnershipCost),
            share: `${Math.round(share)}%`,
          },
        });
      }
    }

    // 4. Portfolio-level category concentration
    if (additionalOwnershipCost > 0) {
      for (const [cat, amt] of Object.entries(categoryBreakdown)) {
        if (amt / additionalOwnershipCost >= 0.5) {
          const catName = cat.charAt(0) + cat.slice(1).toLowerCase();
          insights.push({
            type: 'COST_CONCENTRATION',
            title: `High ${catName} Spending Across Portfolio`,
            icon: 'Wrench',
            level: 'INFO',
            description: `${catName} expenses represent the primary driver (${Math.round((amt / additionalOwnershipCost) * 100)}%) of your additional ownership costs across all products.`,
            metric: {
              category: catName,
              amount: formatINR(amt),
            },
          });
          break;
        }
      }
    }

    return {
      hasInsights: insights.length > 0,
      totalInsights: insights.length,
      insights,
      emptyMessage:
        insights.length === 0
          ? "There isn't enough recorded ownership data to generate meaningful insights yet."
          : null,
    };
  }
}

export default new InsightService();
