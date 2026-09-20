import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from backend/.env, root .env, or current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const defaultUploadDir = path.resolve(__dirname, '../../uploads');

const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifereceipt',
  JWT_SECRET: process.env.JWT_SECRET || 'lifereceipt_dev_secret_key_fallback_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: clientUrl,
  FRONTEND_URL: frontendUrl,
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`,
  ALLOWED_ORIGINS: (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  UPLOAD_DIR: process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : defaultUploadDir,
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB default
  AI_PROVIDER: (process.env.AI_PROVIDER || 'GEMINI').toUpperCase(),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'lifereceipt_token_encryption_key_2026',
  EMAIL_CLIENT_ID: process.env.EMAIL_CLIENT_ID || '',
  EMAIL_CLIENT_SECRET: process.env.EMAIL_CLIENT_SECRET || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.EMAIL_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || process.env.EMAIL_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || `${frontendUrl}/oauth/google/callback`,
  EXTERNAL_PRODUCT_API_KEY: process.env.EXTERNAL_PRODUCT_API_KEY || '',
  SEARCH_PROVIDER_API_KEY: process.env.SEARCH_PROVIDER_API_KEY || '',
  DOCUMENT_PROCESSING_TIMEOUT_MS: parseInt(process.env.DOCUMENT_PROCESSING_TIMEOUT_MS, 10) || 60000,
};

if (!process.env.JWT_SECRET && env.NODE_ENV === 'production') {
  console.error('[CRITICAL] JWT_SECRET must be set in production environment.');
  process.exit(1);
}

export default env;

