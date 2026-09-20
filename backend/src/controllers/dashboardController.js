import Product from '../models/Product.js';
import { sendSuccess } from '../utils/responseHandler.js';
import { THRESHOLDS, REGIONAL_CONFIG } from '../config/thresholds.js';

/**
 * @desc    Get dashboard metrics, recent purchases, and upcoming deadlines
 * @route   GET /api/v1/dashboard/summary
 * @access  Private
 * 
 * STRICT DATA OWNERSHIP: All queries filter strictly by req.user._id.
 * No mock or fake data is generated.
 */
export const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const warrantyThresholdDate = new Date(now.getTime() + THRESHOLDS.WARRANTY_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
    const returnThresholdDate = new Date(now.getTime() + THRESHOLDS.RETURN_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

    // 1. Total Products owned by this user
    const totalProducts = await Product.countDocuments({ userId });

    // 2. Active Warranties (hasWarranty: true and warrantyEndDate >= now)
    const activeWarranties = await Product.countDocuments({
      userId,
      'warranty.hasWarranty': true,
      'warranty.warrantyEndDate': { $gte: now },
    });

    // 3. Warranties Expiring Soon (hasWarranty: true and warrantyEndDate between now and 30 days)
    const expiringSoon = await Product.countDocuments({
      userId,
      'warranty.hasWarranty': true,
      'warranty.warrantyEndDate': { $gte: now, $lte: warrantyThresholdDate },
    });

    // 4. Return Periods Currently Active (returnEligible: true and returnEndDate >= now)
    const activeReturns = await Product.countDocuments({
      userId,
      'returnInfo.returnEligible': true,
      'returnInfo.returnEndDate': { $gte: now },
    });

    // 5. Total Tracked Value calculation (sum of purchase prices)
    const valueAggregation = await Product.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalValue: { $sum: '$purchasePrice' } } },
    ]);
    const totalTrackedValue = valueAggregation.length > 0 ? valueAggregation[0].totalValue : 0;

    // 6. Recent purchases owned by this user (limited to 5)
    const recentPurchases = await Product.find({ userId })
      .sort({ purchaseDate: -1, createdAt: -1 })
      .limit(5)
      .lean();

    // 7. Upcoming actions (warranties expiring soon or return windows closing soon)
    const upcomingActions = await Product.find({
      userId,
      $or: [
        {
          'warranty.hasWarranty': true,
          'warranty.warrantyEndDate': { $gte: now, $lte: warrantyThresholdDate },
        },
        {
          'returnInfo.returnEligible': true,
          'returnInfo.returnEndDate': { $gte: now, $lte: returnThresholdDate },
        },
      ],
    })
      .sort({ 'warranty.warrantyEndDate': 1, 'returnInfo.returnEndDate': 1 })
      .limit(6)
      .lean();

    return sendSuccess(
      res,
      {
        metrics: {
          totalProducts,
          activeWarranties,
          expiringSoon,
          activeReturns,
          totalTrackedValue,
          currency: req.user.preferences?.currency || REGIONAL_CONFIG.DEFAULT_CURRENCY,
        },
        recentPurchases,
        recentActivity: [], // Real activity log placeholder for future audit events
        upcomingActions,
      },
      'Dashboard metrics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};
