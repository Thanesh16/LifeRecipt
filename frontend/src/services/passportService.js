import api from './api';

export const passportService = {
  // Master Passport
  async getPassport(productId) {
    const response = await api.get(`/passports/${productId}`);
    return response.data;
  },

  // Direct PDF Download URL
  getPassportPDFUrl(productId) {
    const baseURL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api/v1';
    return `${baseURL}/passports/${productId}/pdf`;
  },

  // Share tokens
  async createShareToken(productId, data = {}) {
    const response = await api.post(`/passports/${productId}/shares`, data);
    return response.data;
  },

  async getShareTokens(productId) {
    const response = await api.get(`/passports/${productId}/shares`);
    return response.data;
  },

  async getUserShares() {
    const response = await api.get('/passports/user/shares');
    return response.data;
  },

  async revokeShareToken(shareId) {
    const response = await api.delete(`/passports/shares/${shareId}`);
    return response.data;
  },

  // Public Passport View (Unauthenticated)
  async getPublicPassport(token) {
    const response = await api.get(`/passports/public/${token}`);
    return response.data;
  },
};

export default passportService;
