import alertService from '../services/alertService.js';

/**
 * LIFERECEIPT Alert Controller
 * Phase 4 Implementation
 */

/**
 * @desc    Get user alerts with optional filtering and pagination
 * @route   GET /api/v1/alerts
 * @access  Private
 */
export async function getAlerts(req, res, next) {
  try {
    const result = await alertService.getUserAlerts(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get unread alert count for badge display
 * @route   GET /api/v1/alerts/unread-count
 * @access  Private
 */
export async function getUnreadCount(req, res, next) {
  try {
    const result = await alertService.getUnreadAlertCount(req.user._id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Mark single alert as read
 * @route   PATCH /api/v1/alerts/:id/read
 * @access  Private
 */
export async function markAsRead(req, res, next) {
  try {
    const alert = await alertService.markAlertAsRead(req.user._id, req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or unauthorized',
      });
    }

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Mark all user alerts as read
 * @route   PATCH /api/v1/alerts/read-all
 * @access  Private
 */
export async function markAllAsRead(req, res, next) {
  try {
    const result = await alertService.markAllAlertsAsRead(req.user._id);
    res.status(200).json({
      success: true,
      message: 'All alerts marked as read',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getAlerts,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
