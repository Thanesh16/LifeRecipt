import api from './api';

export const expenseService = {
  async getExpenses(params = {}) {
    const response = await api.get('/expenses', { params });
    return response.data;
  },

  async getExpenseById(id) {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },

  async getProductExpenses(productId, params = {}) {
    const response = await api.get(`/expenses/products/${productId}`, { params });
    return response.data;
  },

  async createExpense(data) {
    const response = await api.post('/expenses', data);
    return response.data;
  },

  async updateExpense(id, data) {
    const response = await api.patch(`/expenses/${id}`, data);
    return response.data;
  },

  async deleteExpense(id) {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },
};

export default expenseService;
