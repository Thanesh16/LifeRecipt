import api from './api';

export const authService = {
  async register(name, email, password) {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },

  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort logout on backend; always clean up client tokens
    } finally {
      localStorage.removeItem('lifereceipt_token');
      localStorage.removeItem('lifereceipt_user');
    }
  },

  async getAuditLog(params = {}) {
    const response = await api.get('/auth/audit-log', { params });
    return response.data;
  },

  async deleteAccount(password) {
    const response = await api.delete('/auth/account', {
      data: { password },
    });
    return response.data;
  },
};

export default authService;
