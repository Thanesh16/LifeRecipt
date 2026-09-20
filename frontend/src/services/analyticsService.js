import api from './api';

export const analyticsService = {
  async getGlobalOwnershipCost() {
    const response = await api.get('/analytics/ownership-cost');
    return response.data;
  },

  async getProductCost(productId) {
    const response = await api.get(`/analytics/products/${productId}/cost`);
    return response.data;
  },

  async getGlobalInsights() {
    const response = await api.get('/insights/ownership');
    return response.data;
  },

  async getProductInsights(productId) {
    const response = await api.get(`/insights/products/${productId}`);
    return response.data;
  },

  async refreshInsights(productId = null) {
    const response = await api.post('/insights/refresh', { productId });
    return response.data;
  },
};

export default analyticsService;
