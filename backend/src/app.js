import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import v1Routes from './routes/v1/index.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { sanitizeInputs } from './middleware/securityMiddleware.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
const allowedOriginsSet = new Set([
  ...(env.ALLOWED_ORIGINS || []),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000',
].map((o) => o.replace(/\/+$/, '')));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (
        allowedOriginsSet.has(normalizedOrigin) ||
        (env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1')))
      ) {
        return callback(null, true);
      }

      // Reject non-allowed origin cleanly without crashing the request pipeline
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL injection input sanitization
app.use(sanitizeInputs);

// Logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Global API rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again later.',
  },
});
app.use('/api/v1', globalLimiter);

// Specialized rate limiters for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});
app.use('/api/v1/auth', authLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'AI query limit reached. Please wait a moment before sending another message.',
  },
});
app.use('/api/v1/assistant', aiLimiter);

const ocrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Document extraction limit reached. Please try again in a few minutes.',
  },
});
app.use('/api/v1/documents/upload-and-extract', ocrLimiter);

const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Passport share generation limit reached. Please try again later.',
  },
});
app.use('/api/v1/passports/:productId/shares', shareLimiter);
app.use('/api/v1/passports/shares', shareLimiter);

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Email synchronization rate limit reached. Please wait before syncing again.',
  },
});
app.use('/api/v1/email-receipts/sync', syncLimiter);

// Base route for sanity
app.get('/', (req, res) => {
  res.json({
    platform: 'LIFERECEIPT',
    tagline: 'AI-Powered Digital Ownership Intelligence Platform',
    status: 'ACTIVE',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// Mount API v1 router
app.use('/api/v1', v1Routes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

export default app;
