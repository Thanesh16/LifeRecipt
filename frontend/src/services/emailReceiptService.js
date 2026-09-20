import api from './api';

/**
 * LIFERECEIPT Email Receipt API Client
 * Manages email account connections, sync triggers, purchase candidates, and user reviews.
 */
const emailReceiptService = {
  /**
   * Connect third-party email provider
   */
  connectProvider: async (payload) => {
    const res = await api.post('/email-receipts/connect', payload);
    return res.data;
  },

  /**
   * Get list of user connected email accounts
   */
  getConnectedAccounts: async () => {
    const res = await api.get('/email-receipts/connections');
    return res.data;
  },

  /**
   * Disconnect email provider
   */
  disconnectAccount: async (id) => {
    const res = await api.post(`/email-receipts/connections/${id}/disconnect`);
    return res.data;
  },

  /**
   * Trigger manual sync for connected account
   */
  syncAccount: async (id) => {
    const res = await api.post(`/email-receipts/connections/${id}/sync`);
    return res.data;
  },

  /**
   * Fetch discovered email receipt candidates
   */
  getCandidates: async ({ tab = 'all', page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams();
    if (tab) params.append('tab', tab);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);

    const res = await api.get(`/email-receipts?${params.toString()}`);
    return res.data;
  },

  /**
   * Fetch single candidate details
   */
  getCandidateById: async (id) => {
    const res = await api.get(`/email-receipts/${id}`);
    return res.data;
  },

  /**
   * User reviews and confirms candidate
   */
  confirmCandidate: async (id, { modifiedFields = {}, linkToExistingProductId = null } = {}) => {
    const res = await api.post(`/email-receipts/${id}/confirm`, {
      modifiedFields,
      linkToExistingProductId,
    });
    return res.data;
  },

  /**
   * User rejects candidate
   */
  rejectCandidate: async (id, reason = '') => {
    const res = await api.post(`/email-receipts/${id}/reject`, { reason });
    return res.data;
  },

  /**
   * Get Google OAuth 2.0 authorization URL
   */
  getGoogleAuthUrl: async (redirectUri) => {
    const query = redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : '';
    const res = await api.get(`/email-receipts/auth/google/url${query}`);
    const data = res.data?.data || res.data || {};
    return {
      success: res.data?.success ?? true,
      configured: data.configured ?? res.data?.configured ?? false,
      authUrl: data.authUrl || res.data?.authUrl || '',
      data,
      message: res.data?.message || '',
    };
  },

  /**
   * Exchange Google OAuth 2.0 authorization code for credentials
   */
  exchangeGoogleCode: async (code, redirectUri) => {
    const res = await api.post('/email-receipts/auth/google/callback', {
      code,
      redirectUri,
    });
    return res.data;
  },
};

export default emailReceiptService;
