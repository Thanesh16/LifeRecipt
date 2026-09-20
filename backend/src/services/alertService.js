import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import { calculateWarrantyStatus, calculateReturnStatus } from '../utils/statusCalculator.js';
import { THRESHOLDS } from '../config/thresholds.js';

/**
 * Evaluates all products belonging to a user and generates / updates alerts idempotently.
 * 
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {Promise<void>}
 */
export async function evaluateProductAlerts(userId) {
  try {
    const products = await Product.find({ userId, status: { $ne: 'Archived' } });

    for (const product of products) {
      // 1. Evaluate Warranty
      const warrantyStatus = calculateWarrantyStatus(product.warranty);
      
      if (warrantyStatus.status === 'EXPIRING_SOON') {
        const priority = warrantyStatus.isCritical ? 'HIGH' : 'MEDIUM';
        const days = warrantyStatus.daysRemaining;
        const dayText = days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`;
        const title = `Warranty Expiring: ${product.productName}`;
        const message = `The warranty for ${product.productName}${product.brand ? ` (${product.brand})` : ''} expires ${dayText}. Consider inspecting the item or filing any pending warranty claims.`;
        
        // Idempotency check: see if an unread alert already exists for this event
        const existingAlert = await Alert.findOne({
          userId,
          productId: product._id,
          type: 'WARRANTY_EXPIRING',
          isRead: false,
        });

        if (existingAlert) {
          // Update priority and message if urgency escalated
          if (existingAlert.priority !== priority || existingAlert.metadata?.daysRemaining !== days) {
            existingAlert.priority = priority;
            existingAlert.message = message;
            existingAlert.metadata = { daysRemaining: days, warrantyEndDate: product.warranty.warrantyEndDate };
            await existingAlert.save();
          }
        } else {
          // Check if already acknowledged for the exact same expiry date
          const previouslyRead = await Alert.findOne({
            userId,
            productId: product._id,
            type: 'WARRANTY_EXPIRING',
            relevantDate: product.warranty.warrantyEndDate,
            isRead: true,
          });

          // Only create if never created or if newly escalated to critical from a non-critical read alert
          const shouldEscalate = previouslyRead && previouslyRead.priority !== 'HIGH' && warrantyStatus.isCritical;
          if (!previouslyRead || shouldEscalate) {
            await Alert.create({
              userId,
              productId: product._id,
              type: 'WARRANTY_EXPIRING',
              title,
              message,
              priority,
              relevantDate: product.warranty.warrantyEndDate,
              metadata: { daysRemaining: days, warrantyEndDate: product.warranty.warrantyEndDate },
            });
          }
        }
      } else if (warrantyStatus.status === 'EXPIRED') {
        // Expired alert
        const existingExpiredAlert = await Alert.findOne({
          userId,
          productId: product._id,
          type: 'WARRANTY_EXPIRED',
        });

        if (!existingExpiredAlert) {
          await Alert.create({
            userId,
            productId: product._id,
            type: 'WARRANTY_EXPIRED',
            title: `Warranty Expired: ${product.productName}`,
            message: `The warranty for ${product.productName} has expired. Look into third-party maintenance or protection plans if desired.`,
            priority: 'LOW',
            relevantDate: product.warranty.warrantyEndDate,
            metadata: { warrantyEndDate: product.warranty.warrantyEndDate },
          });
        }
      }

      // 2. Evaluate Return Window
      const returnStatus = calculateReturnStatus(product.returnInfo);

      if (returnStatus.status === 'RETURN_EXPIRING_SOON') {
        const priority = returnStatus.isCritical ? 'HIGH' : 'MEDIUM';
        const days = returnStatus.daysRemaining;
        const dayText = days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`;
        const title = `Return Window Closing: ${product.productName}`;
        const message = `Return window for ${product.productName} closes ${dayText}. If you intend to return or exchange this item, initiate it before the deadline.`;

        const existingAlert = await Alert.findOne({
          userId,
          productId: product._id,
          type: 'RETURN_EXPIRING',
          isRead: false,
        });

        if (existingAlert) {
          if (existingAlert.priority !== priority || existingAlert.metadata?.daysRemaining !== days) {
            existingAlert.priority = priority;
            existingAlert.message = message;
            existingAlert.metadata = { daysRemaining: days, returnEndDate: product.returnInfo.returnEndDate };
            await existingAlert.save();
          }
        } else {
          const previouslyRead = await Alert.findOne({
            userId,
            productId: product._id,
            type: 'RETURN_EXPIRING',
            relevantDate: product.returnInfo.returnEndDate,
            isRead: true,
          });

          const shouldEscalate = previouslyRead && previouslyRead.priority !== 'HIGH' && returnStatus.isCritical;
          if (!previouslyRead || shouldEscalate) {
            await Alert.create({
              userId,
              productId: product._id,
              type: 'RETURN_EXPIRING',
              title,
              message,
              priority,
              relevantDate: product.returnInfo.returnEndDate,
              metadata: { daysRemaining: days, returnEndDate: product.returnInfo.returnEndDate },
            });
          }
        }
      } else if (returnStatus.status === 'RETURN_EXPIRED') {
        const existingExpiredAlert = await Alert.findOne({
          userId,
          productId: product._id,
          type: 'RETURN_EXPIRED',
        });

        if (!existingExpiredAlert) {
          await Alert.create({
            userId,
            productId: product._id,
            type: 'RETURN_EXPIRED',
            title: `Return Window Closed: ${product.productName}`,
            message: `The return eligibility window for ${product.productName} has passed.`,
            priority: 'INFO',
            relevantDate: product.returnInfo.returnEndDate,
            metadata: { returnEndDate: product.returnInfo.returnEndDate },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error evaluating product alerts:', error);
  }
}

/**
 * Fetch alerts for a user with optional filtering and pagination.
 */
export async function getUserAlerts(userId, filters = {}) {
  // Sync live alerts before reading
  await evaluateProductAlerts(userId);

  const query = { userId };

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.priority) {
    query.priority = filters.priority;
  }

  if (filters.isRead !== undefined && filters.isRead !== '') {
    query.isRead = filters.isRead === 'true' || filters.isRead === true;
  }

  // Category filter (Warranty, Return, Other)
  if (filters.category === 'warranty') {
    query.type = { $in: ['WARRANTY_EXPIRING', 'WARRANTY_EXPIRED'] };
  } else if (filters.category === 'return') {
    query.type = { $in: ['RETURN_EXPIRING', 'RETURN_EXPIRED'] };
  } else if (filters.category === 'other') {
    query.type = { $nin: ['WARRANTY_EXPIRING', 'WARRANTY_EXPIRED', 'RETURN_EXPIRING', 'RETURN_EXPIRED'] };
  }

  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [alerts, total, unreadCount] = await Promise.all([
    Alert.find(query)
      .sort({ isRead: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('productId', 'productName brand category model purchasePrice currency'),
    Alert.countDocuments(query),
    Alert.countDocuments({ userId, isRead: false }),
  ]);

  return {
    alerts,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
    unreadCount,
  };
}

/**
 * Get count of unread alerts for badge display
 */
export async function getUnreadAlertCount(userId) {
  // Sync alerts first
  await evaluateProductAlerts(userId);
  const unreadCount = await Alert.countDocuments({ userId, isRead: false });
  return { unreadCount };
}

/**
 * Mark a specific alert as read (strict user isolation)
 */
export async function markAlertAsRead(userId, alertId) {
  const alert = await Alert.findOneAndUpdate(
    { _id: alertId, userId },
    { isRead: true },
    { new: true }
  ).populate('productId', 'productName brand category model');

  return alert;
}

/**
 * Mark all alerts as read for a user
 */
export async function markAllAlertsAsRead(userId) {
  const result = await Alert.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );

  return { modifiedCount: result.modifiedCount };
}

export default {
  evaluateProductAlerts,
  getUserAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
  markAllAlertsAsRead,
};
