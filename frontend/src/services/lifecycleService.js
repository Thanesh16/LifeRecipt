import api from './api';

export const lifecycleService = {
  async getSummary() {
    const response = await api.get('/lifecycle/summary');
    return response.data;
  },

  async getProductLifecycle(productId) {
    const response = await api.get(`/lifecycle/products/${productId}`);
    return response.data;
  },
};

export default lifecycleService;
