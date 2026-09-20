/**
 * Backend Formatting Utilities
 * Regional Focus: India-First (INR, en-IN)
 */

export function formatINR(amount) {
  const numeric = Number(amount);
  if (isNaN(numeric) || numeric === 0) return '₹0';
  return `₹${Math.round(numeric).toLocaleString('en-IN')}`;
}

export function formatDateIN(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const formatted = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return formatted.replace(/\bSept\b/g, 'Sep');
}
