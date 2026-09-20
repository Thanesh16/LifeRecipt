import lifecycleService from '../services/lifecycleService.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const getProductLifecycle = async (req, res, next) => {
  try {
    const data = await lifecycleService.getProductLifecycle(req.params.productId, req.user._id);
    sendSuccess(res, data, 'Product lifecycle details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getLifecycleSummary = async (req, res, next) => {
  try {
    const data = await lifecycleService.getLifecycleSummary(req.user._id);
    sendSuccess(res, data, 'Lifecycle portfolio summary retrieved successfully');
  } catch (err) {
    next(err);
  }
};
