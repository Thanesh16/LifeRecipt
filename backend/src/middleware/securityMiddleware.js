import mongoose from 'mongoose';
import { sendError } from '../utils/responseHandler.js';

/**
 * LIFERECEIPT Security Middleware
 * Phase 15: Privacy & Security
 * 
 * Provides:
 * 1. ObjectId parameter validation (rejects malformed IDs before database queries)
 * 2. NoSQL injection input sanitization (removes keys starting with '$' or containing '.')
 */

/**
 * Validate that specified route parameter(s) are valid 24-character hexadecimal ObjectIds.
 * Returns HTTP 400 immediately if invalid.
 */
export const validateObjectIdParam = (...paramNames) => {
  return (req, res, next) => {
    for (const param of paramNames) {
      const val = req.params[param];
      if (val !== undefined && val !== null) {
        if (!mongoose.Types.ObjectId.isValid(val) || String(new mongoose.Types.ObjectId(val)) !== String(val)) {
          return sendError(res, `Invalid resource identifier format for parameter: ${param}`, 400);
        }
      }
    }
    next();
  };
};

/**
 * Recursively sanitize an object to strip NoSQL operator injection keys (starting with $)
 */
const sanitizeObject = (target) => {
  if (!target || typeof target !== 'object') return target;

  if (Array.isArray(target)) {
    return target.map(sanitizeObject);
  }

  const clean = {};
  for (const [key, value] of Object.entries(target)) {
    // Strip leading '$' or embedded '.' from keys to neutralize NoSQL injection
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeObject(value);
  }
  return clean;
};

/**
 * Express middleware to sanitize req.body, req.query, and req.params from NoSQL injections.
 */
export const sanitizeInputs = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
};

export default {
  validateObjectIdParam,
  sanitizeInputs,
};
