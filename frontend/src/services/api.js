import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const DOCUMENT_PROCESSING_TIMEOUT_MS =
  parseInt(import.meta.env.VITE_DOCUMENT_PROCESSING_TIMEOUT_MS, 10) || 60000;

const defaultTimeout = parseInt(import.meta.env.VITE_API_TIMEOUT_MS, 10) || 25000;

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: defaultTimeout,
});

// Request interceptor to inject Bearer JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lifereceipt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle unauthenticated responses
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      if (localStorage.getItem('lifereceipt_token')) {
        localStorage.removeItem('lifereceipt_token');
        localStorage.removeItem('lifereceipt_user');
        // Dispatch custom event for auth listeners
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
