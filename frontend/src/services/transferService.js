import api from './api';

export const transferService = {
  async initiateTransfer({ productId, recipientEmail, notes }) {
    const response = await api.post('/transfers/initiate', { productId, recipientEmail, notes });
    return response.data;
  },

  async getIncomingTransfers() {
    const response = await api.get('/transfers/incoming');
    return response.data;
  },

  async getOutgoingTransfers() {
    const response = await api.get('/transfers/outgoing');
    return response.data;
  },

  async getTransferHistory() {
    const response = await api.get('/transfers/history');
    return response.data;
  },

  async acceptTransfer(transferId, transferToken) {
    const response = await api.post(`/transfers/${transferId}/accept`, { transferToken });
    return response.data;
  },

  async rejectTransfer(transferId, reason) {
    const response = await api.post(`/transfers/${transferId}/reject`, { reason });
    return response.data;
  },

  async cancelTransfer(transferId) {
    const response = await api.post(`/transfers/${transferId}/cancel`);
    return response.data;
  },
};

export default transferService;
