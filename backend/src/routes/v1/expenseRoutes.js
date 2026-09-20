import express from 'express';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getProductExpenses,
} from '../../controllers/expenseController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All expense routes require authentication
router.use(protect);

router.route('/')
  .post(createExpense)
  .get(getExpenses);

router.get('/products/:productId', validateObjectIdParam('productId'), getProductExpenses);

router.route('/:id')
  .get(validateObjectIdParam('id'), getExpenseById)
  .patch(validateObjectIdParam('id'), updateExpense)
  .delete(validateObjectIdParam('id'), deleteExpense);

export default router;
