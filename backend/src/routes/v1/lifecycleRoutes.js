import express from 'express';
import {
  getProductLifecycle,
  getLifecycleSummary,
} from '../../controllers/lifecycleController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All lifecycle routes require authentication
router.use(protect);

router.get('/summary', getLifecycleSummary);
router.get('/products/:productId', validateObjectIdParam('productId'), getProductLifecycle);

export default router;
