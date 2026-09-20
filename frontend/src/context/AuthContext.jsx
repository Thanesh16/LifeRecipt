import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lifereceipt_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('lifereceipt_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync auth state with localStorage & verify session
  const verifySession = useCallback(async () => {
    const storedToken = localStorage.getItem('lifereceipt_token');
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('lifereceipt_user', JSON.stringify(response.data.user));
      }
    } catch (err) {
      console.warn('Session verification failed, logging out:', err.response?.data?.message || err.message);
      setUser(null);
      setToken(null);
      localStorage.removeItem('lifereceipt_token');
      localStorage.removeItem('lifereceipt_user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();

    // Listen to 401 events dispatched from axios interceptor
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [verifySession]);

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await authService.login(email, password);
      if (response.success && response.data) {
        const { user: userData, token: jwtToken } = response.data;
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem('lifereceipt_token', jwtToken);
        localStorage.setItem('lifereceipt_user', JSON.stringify(userData));
        return { success: true, user: userData };
      }
      throw new Error(response.message || 'Login failed');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Login failed';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const register = async (name, email, password) => {
    setError(null);
    try {
      const response = await authService.register(name, email, password);
      if (response.success && response.data) {
        const { user: userData, token: jwtToken } = response.data;
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem('lifereceipt_token', jwtToken);
        localStorage.setItem('lifereceipt_user', JSON.stringify(userData));
        return { success: true, user: userData };
      }
      throw new Error(response.message || 'Registration failed');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Registration failed';
      const errors = err.response?.data?.errors;
      setError(errMsg);
      return { success: false, error: errMsg, errors };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('lifereceipt_token');
      localStorage.removeItem('lifereceipt_user');
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    verifySession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
