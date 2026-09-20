import crypto from 'crypto';
import env from '../config/env.js';

/**
 * LIFERECEIPT Cryptographic Token Storage Utility
 * Uses AES-256-GCM for authenticated encryption of sensitive OAuth credentials.
 * Ensures zero plaintext token exposure in database records or server logs.
 */

// Derive a fixed 32-byte key from secret
const getDerivedKey = () => {
  const secret = env.TOKEN_ENCRYPTION_KEY || env.JWT_SECRET || 'lifereceipt_fallback_secret_key_2026';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts sensitive string payload (access token, refresh token)
 * Output format: ivHex:authTagHex:encryptedHex
 */
export const encryptToken = (plainText) => {
  if (!plainText || typeof plainText !== 'string') return null;

  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Crypto Error] Failed to encrypt token:', err.message);
    throw new Error('Cryptographic token encryption failed');
  }
};

/**
 * Decrypts encrypted token payload
 */
export const decryptToken = (encryptedPayload) => {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') return null;

  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[Crypto Error] Failed to decrypt token:', err.message);
    return null;
  }
};

export default {
  encryptToken,
  decryptToken,
};
