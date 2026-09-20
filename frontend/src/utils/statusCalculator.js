/**
 * Centralized Dynamic Warranty & Return Status Calculator (Frontend)
 * 
 * Computes live statuses without permanently storing static days-remaining values.
 */

import { THRESHOLDS } from '../config/thresholds';

/**
 * Calculates dynamic warranty status from product warranty object.
 * 
 * @param {Object} warranty - { hasWarranty, warrantyStartDate, warrantyEndDate, warrantyProvider, warrantyType }
 * @param {Date|string} [referenceDate=new Date()] - Date to evaluate against (defaults to now)
 * @returns {Object} { status, label, daysRemaining, isExpiringSoon, isExpired, isCritical, badgeVariant }
 */
export function calculateWarrantyStatus(warranty, referenceDate = new Date()) {
  if (!warranty || !warranty.hasWarranty) {
    return {
      status: 'NO_WARRANTY',
      label: 'No Warranty',
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false,
      isCritical: false,
      badgeVariant: 'neutral',
    };
  }

  if (!warranty.warrantyEndDate) {
    return {
      status: 'UNKNOWN',
      label: 'Warranty Active (End date unknown)',
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false,
      isCritical: false,
      badgeVariant: 'neutral',
    };
  }

  const end = new Date(warranty.warrantyEndDate);
  if (isNaN(end.getTime())) {
    return {
      status: 'UNKNOWN',
      label: 'Invalid Date',
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false,
      isCritical: false,
      badgeVariant: 'neutral',
    };
  }

  const ref = new Date(referenceDate);
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const refMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffTime = endMidnight.getTime() - refMidnight.getTime();
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      status: 'EXPIRED',
      label: 'Warranty Expired',
      daysRemaining,
      isExpiringSoon: false,
      isExpired: true,
      isCritical: false,
      badgeVariant: 'danger',
    };
  }

  if (daysRemaining <= THRESHOLDS.WARRANTY_EXPIRING_SOON_DAYS) {
    const isCritical = daysRemaining <= THRESHOLDS.WARRANTY_CRITICAL_DAYS;
    return {
      status: 'EXPIRING_SOON',
      label: daysRemaining === 0 ? 'Expires Today' : `Expires in ${daysRemaining}d`,
      daysRemaining,
      isExpiringSoon: true,
      isExpired: false,
      isCritical,
      badgeVariant: isCritical ? 'danger' : 'warning',
    };
  }

  return {
    status: 'ACTIVE',
    label: 'Warranty Active',
    daysRemaining,
    isExpiringSoon: false,
    isExpired: false,
    isCritical: false,
    badgeVariant: 'success',
  };
}

/**
 * Calculates dynamic return period status from product returnInfo object.
 * 
 * @param {Object} returnInfo - { returnEligible, returnStartDate, returnEndDate, returnPolicyNotes }
 * @param {Date|string} [referenceDate=new Date()] - Date to evaluate against (defaults to now)
 * @returns {Object} { status, label, daysRemaining, isExpiringSoon, isExpired, isCritical, badgeVariant }
 */
export function calculateReturnStatus(returnInfo, referenceDate = new Date()) {
  if (!returnInfo || !returnInfo.returnEligible) {
    return {
      status: 'NOT_ELIGIBLE',
      label: 'Not Returnable',
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false,
      isCritical: false,
      badgeVariant: 'neutral',
    };
  }

  if (!returnInfo.returnEndDate) {
    return {
      status: 'UNKNOWN',
      label: 'Return Eligible (End date unknown)',
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false,
      isCritical: false,
      badgeVariant: 'neutral',
    };
  }

  const end = new Date(returnInfo.returnEndDate);
  if (isNaN(end.getTime())) {
    return {
      status: 'UNKNOWN',
      label: 'Invalid Date',
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false,
      isCritical: false,
      badgeVariant: 'neutral',
    };
  }

  const ref = new Date(referenceDate);
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const refMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffTime = endMidnight.getTime() - refMidnight.getTime();
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      status: 'RETURN_EXPIRED',
      label: 'Return Closed',
      daysRemaining,
      isExpiringSoon: false,
      isExpired: true,
      isCritical: false,
      badgeVariant: 'neutral',
    };
  }

  if (daysRemaining <= THRESHOLDS.RETURN_EXPIRING_SOON_DAYS) {
    const isCritical = daysRemaining <= THRESHOLDS.RETURN_CRITICAL_DAYS;
    return {
      status: 'RETURN_EXPIRING_SOON',
      label: daysRemaining === 0 ? 'Last Day for Return' : `${daysRemaining}d to Return`,
      daysRemaining,
      isExpiringSoon: true,
      isExpired: false,
      isCritical,
      badgeVariant: isCritical ? 'danger' : 'warning',
    };
  }

  return {
    status: 'RETURN_ACTIVE',
    label: 'Return Eligible',
    daysRemaining,
    isExpiringSoon: false,
    isExpired: false,
    isCritical: false,
    badgeVariant: 'success',
  };
}

export default {
  calculateWarrantyStatus,
  calculateReturnStatus,
};
