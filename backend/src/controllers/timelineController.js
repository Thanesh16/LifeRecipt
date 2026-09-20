import timelineService from '../services/timelineService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * @desc    Get chronological timeline for a specific product
 * @route   GET /api/v1/products/:productId/timeline
 * @access  Private
 */
export const getProductTimeline = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.params.id;
    const userId = req.user._id;

    const result = await timelineService.getProductTimeline({ userId, productId });
    return sendSuccess(res, result, 'Product timeline retrieved successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Add a manual note event to a product timeline
 * @route   POST /api/v1/products/:productId/timeline
 * @access  Private
 */
export const createProductTimelineNote = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.params.id;
    const userId = req.user._id;
    const { title, description, eventDate } = req.body;

    const event = await timelineService.createManualNote({
      userId,
      productId,
      title,
      description,
      eventDate,
    });

    return sendSuccess(res, event, 'Note added to timeline successfully', 201);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Update a manual note on product timeline
 * @route   PATCH /api/v1/products/:productId/timeline/:eventId
 * @access  Private
 * 
 * SECURITY: System-generated events cannot be modified (returns 403)
 */
export const updateProductTimelineNote = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.params.id;
    const eventId = req.params.eventId;
    const userId = req.user._id;
    const { title, description, eventDate } = req.body;

    const event = await timelineService.updateManualNote({
      userId,
      productId,
      eventId,
      title,
      description,
      eventDate,
    });

    return sendSuccess(res, event, 'Timeline note updated successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Delete a manual note from product timeline
 * @route   DELETE /api/v1/products/:productId/timeline/:eventId
 * @access  Private
 * 
 * SECURITY: System-generated events cannot be deleted (returns 403)
 */
export const deleteProductTimelineNote = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.params.id;
    const eventId = req.params.eventId;
    const userId = req.user._id;

    const result = await timelineService.deleteManualNote({
      userId,
      productId,
      eventId,
    });

    return sendSuccess(res, result, 'Timeline note deleted successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Get global chronological timeline across all products owned by user
 * @route   GET /api/v1/timeline
 * @access  Private
 */
export const getGlobalTimeline = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page, limit, eventType, productId } = req.query;

    const result = await timelineService.getGlobalTimeline({
      userId,
      page,
      limit,
      eventType,
      productId,
    });

    return sendSuccess(res, result, 'Global timeline activity retrieved successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};
