import analyticsService from '../services/analyticsService.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const getGlobalOwnershipCost = async (req, res, next) => {
  try {
    const data = await analyticsService.calculateGlobalOwnershipCost(req.user._id);
    sendSuccess(res, data, 'Global ownership cost analytics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getProductCost = async (req, res, next) => {
  try {
    const data = await analyticsService.calculateProductCost(req.user._id, req.params.productId);
    sendSuccess(res, data, 'Product ownership cost breakdown retrieved successfully');
  } catch (err) {
    next(err);
  }
};
