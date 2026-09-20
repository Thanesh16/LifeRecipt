import api from './api';

/**
 * LIFERECEIPT Product Intelligence API Client
 * Retrieves external specifications, manuals, support URLs, and official warranty data.
 */
const productIntelligenceService = {
  /**
   * Fetch cached or fresh intelligence for a product
   */
  getProductIntelligence: async (productId, refresh = false) => {
    const query = refresh ? '?refresh=true' : '';
    const res = await api.get(`/product-intelligence/products/${productId}${query}`);
    return res.data;
  },

  /**
   * Refresh product intelligence on-demand
   */
  refreshProductIntelligence: async (productId) => {
    const res = await api.post(`/product-intelligence/products/${productId}/refresh`);
    return res.data;
  },
};

export default productIntelligenceService;
