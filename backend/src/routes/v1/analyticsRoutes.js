import express from 'express';
import {
  getGlobalOwnershipCost,
  getProductCost,
} from '../../controllers/analyticsController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All analytics routes require authentication
router.use(protect);

router.get('/ownership-cost', getGlobalOwnershipCost);
router.get('/products/:productId/cost', validateObjectIdParam('productId'), getProductCost);

export default router;
