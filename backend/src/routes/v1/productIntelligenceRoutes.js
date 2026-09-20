import express from 'express';
import {
  getProductIntelligence,
  refreshProductIntelligence,
  lookupProductIntelligence,
} from '../../controllers/productIntelligenceController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// All product intelligence routes require authentication
router.use(protect);

router.get('/lookup', lookupProductIntelligence);
router.get('/products/:productId', getProductIntelligence);
router.post('/products/:productId/refresh', refreshProductIntelligence);

export default router;
