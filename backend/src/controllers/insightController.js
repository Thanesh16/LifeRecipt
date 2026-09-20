import insightService from '../services/insightService.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const getGlobalInsights = async (req, res, next) => {
  try {
    const data = await insightService.getGlobalInsights(req.user._id);
    sendSuccess(res, data, 'Global ownership insights retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getProductInsights = async (req, res, next) => {
  try {
    const data = await insightService.getProductInsights(req.user._id, req.params.productId);
    sendSuccess(res, data, 'Product ownership insights retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const refreshInsights = async (req, res, next) => {
  try {
    const { productId } = req.body || {};
    let data;
    if (productId) {
      data = await insightService.getProductInsights(req.user._id, productId);
    } else {
      data = await insightService.getGlobalInsights(req.user._id);
    }
    sendSuccess(res, data, 'Ownership insights refreshed successfully');
  } catch (err) {
    next(err);
  }
};
