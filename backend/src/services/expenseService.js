import Expense from '../models/Expense.js';
import Product from '../models/Product.js';
import Document from '../models/Document.js';
import timelineService from './timelineService.js';

class ExpenseService {
  /**
   * Create a new ownership expense record with strict user isolation
   * and automatic timeline integration.
   */
  async createExpense(userId, data) {
    const {
      productId,
      expenseType,
      amount,
      currency = 'INR',
      expenseDate = new Date(),
      title,
      description = '',
      vendorName = '',
      relatedDocumentId = null,
      notes = '',
    } = data;

    if (!productId) {
      const err = new Error('Product ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!title || !title.trim()) {
      const err = new Error('Expense title is required');
      err.statusCode = 400;
      throw err;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      const err = new Error('Expense amount must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    // Verify product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // Verify document ownership if document is attached
    if (relatedDocumentId) {
      const doc = await Document.findOne({ _id: relatedDocumentId, userId });
      if (!doc) {
        const err = new Error('Linked document not found or access denied');
        err.statusCode = 404;
        throw err;
      }
    }

    const expense = await Expense.create({
      userId,
      productId,
      expenseType,
      amount: numericAmount,
      currency: currency.toUpperCase(),
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      title: title.trim(),
      description: description.trim(),
      vendorName: vendorName.trim(),
      relatedDocumentId: relatedDocumentId || null,
      source: 'MANUAL',
      notes: notes.trim(),
    });

    // Automatically record an ownership timeline event
    try {
      await timelineService.recordExpenseEvent(expense, product);
    } catch (timelineErr) {
      console.warn('[Timeline Warning] Failed to record timeline event for expense:', timelineErr.message);
    }

    return await Expense.findById(expense._id)
      .populate('productId', 'productName brand model category purchasePrice currency')
      .populate('relatedDocumentId', 'fileName fileSize mimeType documentType')
      .lean();
  }

  /**
   * Retrieve expenses for the authenticated user with optional filters.
   */
  async getExpenses(userId, query = {}) {
    const {
      productId,
      expenseType,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page = 1,
      limit = 50,
      search,
    } = query;

    const filter = { userId };

    if (productId) {
      filter.productId = productId;
    }

    if (expenseType && expenseType !== 'ALL') {
      filter.expenseType = expenseType;
    }

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      filter.amount = {};
      if (minAmount !== undefined && !isNaN(parseFloat(minAmount))) {
        filter.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount !== undefined && !isNaN(parseFloat(maxAmount))) {
        filter.amount.$lte = parseFloat(maxAmount);
      }
    }

    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { vendorName: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .populate('productId', 'productName brand model category purchasePrice currency')
        .populate('relatedDocumentId', 'fileName fileSize mimeType documentType')
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Expense.countDocuments(filter),
    ]);

    return {
      expenses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Get single expense by ID with user isolation.
   */
  async getExpenseById(userId, expenseId) {
    const expense = await Expense.findOne({ _id: expenseId, userId })
      .populate('productId', 'productName brand model category purchasePrice currency')
      .populate('relatedDocumentId', 'fileName fileSize mimeType documentType')
      .lean();

    if (!expense) {
      const err = new Error('Expense record not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    return expense;
  }

  /**
   * Update manual expense record and sync timeline event.
   */
  async updateExpense(userId, expenseId, data) {
    const expense = await Expense.findOne({ _id: expenseId, userId });
    if (!expense) {
      const err = new Error('Expense record not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // Verify linked document ownership if updated
    if (data.relatedDocumentId && data.relatedDocumentId !== String(expense.relatedDocumentId)) {
      const doc = await Document.findOne({ _id: data.relatedDocumentId, userId });
      if (!doc) {
        const err = new Error('Linked document not found or access denied');
        err.statusCode = 404;
        throw err;
      }
      expense.relatedDocumentId = data.relatedDocumentId;
    } else if (data.relatedDocumentId === null) {
      expense.relatedDocumentId = null;
    }

    if (data.title !== undefined) expense.title = data.title.trim();
    if (data.description !== undefined) expense.description = data.description.trim();
    if (data.vendorName !== undefined) expense.vendorName = data.vendorName.trim();
    if (data.notes !== undefined) expense.notes = data.notes.trim();

    if (data.amount !== undefined) {
      const numericAmount = parseFloat(data.amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        const err = new Error('Expense amount must be a positive number');
        err.statusCode = 400;
        throw err;
      }
      expense.amount = numericAmount;
    }

    if (data.expenseType !== undefined) {
      expense.expenseType = data.expenseType;
    }

    if (data.expenseDate !== undefined) {
      expense.expenseDate = new Date(data.expenseDate);
    }

    await expense.save();

    // Update associated timeline event
    try {
      await timelineService.updateExpenseEvent(expense);
    } catch (timelineErr) {
      console.warn('[Timeline Warning] Failed to update timeline event for expense:', timelineErr.message);
    }

    return await Expense.findById(expense._id)
      .populate('productId', 'productName brand model category purchasePrice currency')
      .populate('relatedDocumentId', 'fileName fileSize mimeType documentType')
      .lean();
  }

  /**
   * Delete expense record and clean up associated timeline event.
   */
  async deleteExpense(userId, expenseId) {
    const expense = await Expense.findOne({ _id: expenseId, userId });
    if (!expense) {
      const err = new Error('Expense record not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    await Expense.deleteOne({ _id: expenseId, userId });

    // Clean up timeline event
    try {
      await timelineService.deleteExpenseEvent(expenseId);
    } catch (timelineErr) {
      console.warn('[Timeline Warning] Failed to delete timeline event for expense:', timelineErr.message);
    }

    return { deleted: true, expenseId };
  }
}

export default new ExpenseService();
