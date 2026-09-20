import expenseService from '../services/expenseService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const createExpense = async (req, res, next) => {
  try {
    const expense = await expenseService.createExpense(req.user._id, req.body);
    sendSuccess(res, expense, 'Expense recorded successfully', 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getExpenses = async (req, res, next) => {
  try {
    const result = await expenseService.getExpenses(req.user._id, req.query);
    sendSuccess(res, result, 'Expenses retrieved successfully');
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getExpenseById = async (req, res, next) => {
  try {
    const expense = await expenseService.getExpenseById(req.user._id, req.params.id);
    sendSuccess(res, expense, 'Expense details retrieved successfully');
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const updateExpense = async (req, res, next) => {
  try {
    const updated = await expenseService.updateExpense(req.user._id, req.params.id, req.body);
    sendSuccess(res, updated, 'Expense updated successfully');
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const result = await expenseService.deleteExpense(req.user._id, req.params.id);
    sendSuccess(res, result, 'Expense deleted successfully');
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getProductExpenses = async (req, res, next) => {
  try {
    const result = await expenseService.getExpenses(req.user._id, {
      ...req.query,
      productId: req.params.productId,
    });
    sendSuccess(res, result, 'Product expenses retrieved successfully');
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};
