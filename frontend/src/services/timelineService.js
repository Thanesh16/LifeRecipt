import api from './api';

export const timelineService = {
  /**
   * Fetch chronological timeline events for a product
   */
  async getProductTimeline(productId) {
    const response = await api.get(`/products/${productId}/timeline`);
    return response.data;
  },

  /**
   * Add a manual user note event to a product's timeline
   */
  async createProductNote(productId, noteData) {
    const response = await api.post(`/products/${productId}/timeline`, noteData);
    return response.data;
  },

  /**
   * Update an existing manual note event
   */
  async updateProductNote(productId, eventId, noteData) {
    const response = await api.patch(`/products/${productId}/timeline/${eventId}`, noteData);
    return response.data;
  },

  /**
   * Delete a manual note event
   */
  async deleteProductNote(productId, eventId) {
    const response = await api.delete(`/products/${productId}/timeline/${eventId}`);
    return response.data;
  },

  /**
   * Fetch global timeline activity feed across all assets
   */
  async getGlobalTimeline(params = {}) {
    const response = await api.get('/timeline', { params });
    return response.data;
  },
};

export default timelineService;
