import api from './api';

export const alertService = {
  async getAlerts(params = {}) {
    const response = await api.get('/alerts', { params });
    return response.data;
  },

  async getUnreadCount() {
    const response = await api.get('/alerts/unread-count');
    return response.data;
  },

  async markAsRead(id) {
    const response = await api.patch(`/alerts/${id}/read`);
    return response.data;
  },

  async markAllAsRead() {
    const response = await api.patch('/alerts/read-all');
    return response.data;
  },
};

export default alertService;
