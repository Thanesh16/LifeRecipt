import productIntelligenceService from '../services/intelligence/productIntelligenceService.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const getProductIntelligence = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { refresh } = req.query;
    const data = await productIntelligenceService.getProductIntelligence({
      userId: req.user._id,
      productId,
      forceRefresh: refresh === 'true',
    });
    sendSuccess(res, data, 'Product intelligence retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const refreshProductIntelligence = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const data = await productIntelligenceService.refreshProductIntelligence(
      req.user._id,
      productId
    );
    sendSuccess(res, data, 'Product intelligence refreshed successfully');
  } catch (err) {
    next(err);
  }
};

export const lookupProductIntelligence = async (req, res, next) => {
  try {
    const { brand, model, category } = req.query;
    if (!brand && !model) {
      return res.status(400).json({
        success: false,
        message: 'Brand or model parameter is required for intelligence lookup',
      });
    }
    const data = await productIntelligenceService.lookupIntelligence({ brand, model, category });
    sendSuccess(res, data, 'Product intelligence lookup successful');
  } catch (err) {
    next(err);
  }
};
