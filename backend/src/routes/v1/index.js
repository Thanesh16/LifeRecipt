import express from 'express';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import productRoutes from './productRoutes.js';
import documentRoutes from './documentRoutes.js';
import alertRoutes from './alertRoutes.js';
import timelineRoutes from './timelineRoutes.js';
import assistantRoutes from './assistantRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import insightRoutes from './insightRoutes.js';
import lifecycleRoutes from './lifecycleRoutes.js';
import transferRoutes from './transferRoutes.js';
import emailReceiptRoutes from './emailReceiptRoutes.js';
import productIntelligenceRoutes from './productIntelligenceRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import passportRoutes from './passportRoutes.js';
import { checkDBHealth } from '../../config/db.js';
import { sendSuccess } from '../../utils/responseHandler.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const dbConnected = checkDBHealth();
  sendSuccess(res, {
    status: 'ONLINE',
    service: 'LIFERECEIPT API',
    version: '1.0.0',
    database: dbConnected ? 'CONNECTED' : 'DISCONNECTED',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }, 'System status verified');
});

// Mount domain routes
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/products', productRoutes);
router.use('/documents', documentRoutes);
router.use('/alerts', alertRoutes);
router.use('/timeline', timelineRoutes);
router.use('/assistant', assistantRoutes);
router.use('/expenses', expenseRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/insights', insightRoutes);
router.use('/lifecycle', lifecycleRoutes);
router.use('/transfers', transferRoutes);
router.use('/email-receipts', emailReceiptRoutes);
router.use('/product-intelligence', productIntelligenceRoutes);
router.use('/services', serviceRoutes);
router.use('/passports', passportRoutes);

export default router;
