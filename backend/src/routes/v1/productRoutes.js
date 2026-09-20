import express from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../../controllers/productController.js';
import {
  getProductTimeline,
  createProductTimelineNote,
  updateProductTimelineNote,
  deleteProductTimelineNote,
} from '../../controllers/timelineController.js';
import protect from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All product endpoints require active JWT authentication
router.use(protect);

router.route('/')
  .post(createProduct)
  .get(getProducts);

router.route('/:id')
  .get(validateObjectIdParam('id'), getProductById)
  .put(validateObjectIdParam('id'), updateProduct)
  .delete(validateObjectIdParam('id'), deleteProduct);

// Product Ownership Timeline endpoints
router.route('/:productId/timeline')
  .get(validateObjectIdParam('productId'), getProductTimeline)
  .post(validateObjectIdParam('productId'), createProductTimelineNote);

router.route('/:productId/timeline/:eventId')
  .patch(validateObjectIdParam('productId', 'eventId'), updateProductTimelineNote)
  .delete(validateObjectIdParam('productId', 'eventId'), deleteProductTimelineNote);

export default router;
