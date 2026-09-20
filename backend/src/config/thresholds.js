/**
 * Centralized Thresholds & Regional Configuration for LifeReceipt Backend
 * 
 * Regional Settings: India-First
 * Currency: INR (₹)
 * Locale: en-IN
 */

export const THRESHOLDS = {
  WARRANTY_EXPIRING_SOON_DAYS: 30,
  WARRANTY_CRITICAL_DAYS: 7,
  RETURN_EXPIRING_SOON_DAYS: 7,
  RETURN_CRITICAL_DAYS: 3,
};

export const REGIONAL_CONFIG = {
  DEFAULT_COUNTRY: 'IN',
  DEFAULT_CURRENCY: 'INR',
  DEFAULT_CURRENCY_SYMBOL: '₹',
  DEFAULT_LOCALE: 'en-IN',
};

export default {
  THRESHOLDS,
  REGIONAL_CONFIG,
};
