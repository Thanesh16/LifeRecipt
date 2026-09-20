import api from './api';

export const assistantService = {
  /**
   * Send question to AI Ownership Assistant
   */
  async sendMessage(message, sessionId = null, productId = null) {
    const response = await api.post('/assistant/chat', {
      message,
      sessionId,
      productId,
    });
    return response.data;
  },

  /**
   * Retrieve conversation history for active session
   */
  async getHistory(sessionId = null) {
    const params = sessionId ? { sessionId } : {};
    const response = await api.get('/assistant/history', { params });
    return response.data;
  },

  /**
   * Clear active conversation session
   */
  async clearHistory(sessionId = null) {
    const params = sessionId ? { sessionId } : {};
    const response = await api.delete('/assistant/history', { params });
    return response.data;
  },
};

export default assistantService;
