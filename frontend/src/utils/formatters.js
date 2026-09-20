/**
 * LifeReceipt Formatting Utilities
 * Regional Focus: India-First (INR, en-IN)
 */

import { REGIONAL_CONFIG } from '../config/thresholds';

/**
 * Format a numeric amount into an Indian locale currency string.
 * Example outputs:
 *   formatCurrency(72999) => "₹72,999"
 *   formatCurrency(8500) => "₹8,500"
 *   formatCurrency(125000) => "₹1,25,000"
 *   formatCurrency(241890) => "₹2,41,890"
 *   formatCurrency(1000000) => "₹10,00,000"
 * 
 * @param {number|string} amount - Monetary amount
 * @param {string} [currency='INR'] - Currency code
 * @param {string} [locale='en-IN'] - Locale identifier
 * @returns {string} Formatted currency string
 */
export function formatCurrency(
  amount,
  currency = REGIONAL_CONFIG.DEFAULT_CURRENCY,
  locale = REGIONAL_CONFIG.DEFAULT_LOCALE
) {
  const numericAmount = Number(amount);
  if (amount === null || amount === undefined || isNaN(numericAmount)) {
    return `${REGIONAL_CONFIG.DEFAULT_CURRENCY_SYMBOL}0`;
  }

  // Strictly normalize any 'USD' or empty currency to 'INR' for consistent India-First ₹ display
  const targetCurrency = (!currency || currency === 'USD') ? 'INR' : currency;
  const targetLocale = locale || REGIONAL_CONFIG.DEFAULT_LOCALE;
  const hasDecimals = numericAmount % 1 !== 0;

  try {
    const formatter = new Intl.NumberFormat(targetLocale, {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    });
    return formatter.format(numericAmount);
  } catch (error) {
    // Fallback in case Intl fails
    const parts = numericAmount.toFixed(hasDecimals ? 2 : 0).split('.');
    let intPart = parts[0];
    const decPart = parts[1] ? `.${parts[1]}` : '';
    
    // Indian Numbering System regex: 3 digits from right, then groups of 2
    const lastThree = intPart.substring(intPart.length - 3);
    const otherNumbers = intPart.substring(0, intPart.length - 3);
    if (otherNumbers !== '') {
      intPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    }
    return `${REGIONAL_CONFIG.DEFAULT_CURRENCY_SYMBOL}${intPart}${decPart}`;
  }
}

/**
 * Format date in standard display format (e.g., "15 Oct 2024" or "Oct 15, 2024")
 * @param {string|Date} dateVal 
 * @param {Object} [options] 
 * @returns {string}
 */
export function formatDate(dateVal, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return new Intl.DateTimeFormat(REGIONAL_CONFIG.DEFAULT_LOCALE, options).format(d);
  } catch (err) {
    return 'N/A';
  }
}

/**
 * Format Indian number grouping without currency symbol
 * @param {number|string} value 
 * @returns {string}
 */
export function formatIndianNumber(value) {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat(REGIONAL_CONFIG.DEFAULT_LOCALE).format(num);
}
