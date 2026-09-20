import api from './api';

export const dashboardService = {
  async getDashboardSummary() {
    const response = await api.get('/dashboard/summary');
    return response.data;
  },

  async getHealth() {
    const response = await api.get('/health');
    return response.data;
  },
};

export default dashboardService;
