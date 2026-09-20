import api from './api';

export const serviceRecordService = {
  // Service Records
  async getServiceRecords(params = {}) {
    const response = await api.get('/services', { params });
    return response.data;
  },

  async getServiceRecordById(id) {
    const response = await api.get(`/services/${id}`);
    return response.data;
  },

  async createServiceRecord(data) {
    const response = await api.post('/services', data);
    return response.data;
  },

  async updateServiceRecord(id, data) {
    const response = await api.put(`/services/${id}`, data);
    return response.data;
  },

  async deleteServiceRecord(id) {
    const response = await api.delete(`/services/${id}`);
    return response.data;
  },

  async getServiceStats(productId = null) {
    const response = await api.get('/services/stats', {
      params: productId ? { productId } : {},
    });
    return response.data;
  },

  async getServiceHistoryAnalysis(productId = null) {
    const response = await api.get('/services/analysis', {
      params: productId ? { productId } : {},
    });
    return response.data;
  },

  // Warranty Claims
  async prepareWarrantyClaim(productId) {
    const response = await api.get(`/services/claims/prepare/${productId}`);
    return response.data;
  },

  async submitWarrantyClaim(data) {
    const response = await api.post('/services/claims', data);
    return response.data;
  },

  async getWarrantyClaims(params = {}) {
    const response = await api.get('/services/claims', { params });
    return response.data;
  },

  async getWarrantyClaimById(id) {
    const response = await api.get(`/services/claims/${id}`);
    return response.data;
  },

  async updateClaimStatus(id, data) {
    const response = await api.put(`/services/claims/${id}/status`, data);
    return response.data;
  },

  // Service Centers Directory
  async getServiceCenters(params = {}) {
    const response = await api.get('/services/centers', { params });
    return response.data;
  },
};

export default serviceRecordService;
