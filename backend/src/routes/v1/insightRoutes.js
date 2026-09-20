import express from 'express';
import {
  getGlobalInsights,
  getProductInsights,
  refreshInsights,
} from '../../controllers/insightController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All insight routes require authentication
router.use(protect);

router.get('/ownership', getGlobalInsights);
router.get('/products/:productId', validateObjectIdParam('productId'), getProductInsights);
router.post('/refresh', refreshInsights);

export default router;
