import OwnershipEvent from '../models/OwnershipEvent.js';
import Product from '../models/Product.js';
import { formatINR, formatDateIN } from '../utils/formatters.js';

class TimelineService {
  /**
   * Record an ownership timeline event with strict idempotency protection.
   */
  async recordEvent({
    userId,
    productId,
    eventType,
    title,
    description = '',
    eventDate = new Date(),
    source = 'SYSTEM',
    relatedDocumentId = null,
    metadata = {},
  }) {
    if (!userId || !productId || !eventType || !title) {
      return null;
    }

    // Idempotency Checks
    if (eventType === 'PURCHASED') {
      const existing = await OwnershipEvent.findOne({
        productId,
        eventType: 'PURCHASED',
      });
      if (existing) return existing;
    }

    if (eventType === 'DOCUMENT_ADDED' && relatedDocumentId) {
      const existing = await OwnershipEvent.findOne({
        productId,
        relatedDocumentId,
        eventType: 'DOCUMENT_ADDED',
      });
      if (existing) return existing;
    }

    if (eventType === 'WARRANTY_INFO_ADDED' && metadata?.warrantyEndDate) {
      const existing = await OwnershipEvent.findOne({
        productId,
        eventType: 'WARRANTY_INFO_ADDED',
        'metadata.warrantyEndDate': new Date(metadata.warrantyEndDate).toISOString(),
      });
      if (existing) return existing;
    }

    if (eventType === 'RETURN_INFO_ADDED' && metadata?.returnEndDate) {
      const existing = await OwnershipEvent.findOne({
        productId,
        eventType: 'RETURN_INFO_ADDED',
        'metadata.returnEndDate': new Date(metadata.returnEndDate).toISOString(),
      });
      if (existing) return existing;
    }

    if (metadata?.expenseId) {
      const expIdStr = String(metadata.expenseId);
      const existing = await OwnershipEvent.findOne({
        productId,
        $or: [
          { 'metadata.expenseId': metadata.expenseId },
          { 'metadata.expenseId': expIdStr },
        ],
      });
      if (existing) return existing;
    }

    const event = await OwnershipEvent.create({
      userId,
      productId,
      eventType,
      title: title.trim(),
      description: description?.trim() || '',
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      source,
      relatedDocumentId: relatedDocumentId || null,
      metadata: metadata || {},
    });

    return event;
  }

  /**
   * Record automatic events for a newly created or confirmed product.
   */
  async recordProductCreationEvents(product, relatedDoc = null) {
    if (!product || !product._id || !product.userId) return;

    // 1. PURCHASED Event
    const priceFormatted = formatINR(product.purchasePrice);
    let purchaseDesc = product.sellerName
      ? `Purchased from ${product.sellerName} for ${priceFormatted}`
      : `Acquired for ${priceFormatted}`;
    if (product.serialNumber) {
      purchaseDesc += ` (S/N: ${product.serialNumber})`;
    }

    await this.recordEvent({
      userId: product.userId,
      productId: product._id,
      eventType: 'PURCHASED',
      title: 'Product Purchased',
      description: purchaseDesc,
      eventDate: product.purchaseDate || product.createdAt || new Date(),
      source: 'SYSTEM',
      metadata: {
        price: product.purchasePrice,
        currency: product.currency || 'INR',
        seller: product.sellerName,
        serialNumber: product.serialNumber,
      },
    });

    // 2. DOCUMENT_ADDED if document linked
    if (relatedDoc) {
      const docTypeLabel =
        relatedDoc.documentType === 'INVOICE'
          ? 'Purchase Invoice'
          : relatedDoc.documentType === 'RECEIPT'
          ? 'Purchase Receipt'
          : relatedDoc.documentType === 'WARRANTY'
          ? 'Warranty Certificate'
          : 'Document';

      await this.recordEvent({
        userId: product.userId,
        productId: product._id,
        eventType: 'DOCUMENT_ADDED',
        title: 'Document Added',
        description: `${docTypeLabel} added: ${relatedDoc.fileName}`,
        eventDate: relatedDoc.createdAt || new Date(),
        source: 'SYSTEM',
        relatedDocumentId: relatedDoc._id,
        metadata: {
          fileName: relatedDoc.fileName,
          fileSize: relatedDoc.fileSize,
          documentType: relatedDoc.documentType,
        },
      });
    }

    // 3. WARRANTY_INFO_ADDED if warranty exists
    if (product.warranty?.hasWarranty && product.warranty?.warrantyEndDate) {
      const endFormatted = formatDateIN(product.warranty.warrantyEndDate);
      const providerStr = product.warranty.warrantyProvider
        ? ` with ${product.warranty.warrantyProvider}`
        : '';

      await this.recordEvent({
        userId: product.userId,
        productId: product._id,
        eventType: 'WARRANTY_INFO_ADDED',
        title: 'Warranty Added',
        description: `Warranty valid until ${endFormatted}${providerStr}`,
        eventDate: product.warranty.warrantyStartDate || product.createdAt || new Date(),
        source: 'SYSTEM',
        metadata: {
          warrantyEndDate: new Date(product.warranty.warrantyEndDate).toISOString(),
          warrantyProvider: product.warranty.warrantyProvider,
          warrantyType: product.warranty.warrantyType,
        },
      });
    }

    // 4. RETURN_INFO_ADDED if return window exists
    if (product.returnInfo?.returnEligible && product.returnInfo?.returnEndDate) {
      const returnEndFormatted = formatDateIN(product.returnInfo.returnEndDate);

      await this.recordEvent({
        userId: product.userId,
        productId: product._id,
        eventType: 'RETURN_INFO_ADDED',
        title: 'Return Window Active',
        description: `Return period ends on ${returnEndFormatted}`,
        eventDate: product.returnInfo.returnStartDate || product.createdAt || new Date(),
        source: 'SYSTEM',
        metadata: {
          returnEndDate: new Date(product.returnInfo.returnEndDate).toISOString(),
          returnPolicyNotes: product.returnInfo.returnPolicyNotes,
        },
      });
    }
  }

  /**
   * Check and record updated warranty/return events on product update.
   */
  async recordProductUpdateEvents(product) {
    if (!product || !product._id || !product.userId) return;

    // Check Warranty
    if (product.warranty?.hasWarranty && product.warranty?.warrantyEndDate) {
      const endISO = new Date(product.warranty.warrantyEndDate).toISOString();
      const existing = await OwnershipEvent.findOne({
        productId: product._id,
        eventType: 'WARRANTY_INFO_ADDED',
        'metadata.warrantyEndDate': endISO,
      });

      if (!existing) {
        const endFormatted = formatDateIN(product.warranty.warrantyEndDate);
        const providerStr = product.warranty.warrantyProvider
          ? ` with ${product.warranty.warrantyProvider}`
          : '';

        await this.recordEvent({
          userId: product.userId,
          productId: product._id,
          eventType: 'WARRANTY_INFO_ADDED',
          title: 'Warranty Information Updated',
          description: `Warranty coverage updated: valid until ${endFormatted}${providerStr}`,
          eventDate: new Date(),
          source: 'SYSTEM',
          metadata: {
            warrantyEndDate: endISO,
            warrantyProvider: product.warranty.warrantyProvider,
            warrantyType: product.warranty.warrantyType,
          },
        });
      }
    }

    // Check Return
    if (product.returnInfo?.returnEligible && product.returnInfo?.returnEndDate) {
      const returnISO = new Date(product.returnInfo.returnEndDate).toISOString();
      const existing = await OwnershipEvent.findOne({
        productId: product._id,
        eventType: 'RETURN_INFO_ADDED',
        'metadata.returnEndDate': returnISO,
      });

      if (!existing) {
        const returnEndFormatted = formatDateIN(product.returnInfo.returnEndDate);

        await this.recordEvent({
          userId: product.userId,
          productId: product._id,
          eventType: 'RETURN_INFO_ADDED',
          title: 'Return Window Updated',
          description: `Return deadline updated: ends on ${returnEndFormatted}`,
          eventDate: new Date(),
          source: 'SYSTEM',
          metadata: {
            returnEndDate: returnISO,
            returnPolicyNotes: product.returnInfo.returnPolicyNotes,
          },
        });
      }
    }
  }

  /**
   * Get chronological timeline for a specific product.
   */
  async getProductTimeline({ userId, productId }) {
    // 1. Validate product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 2. Fetch timeline events
    const events = await OwnershipEvent.find({ productId, userId })
      .populate('relatedDocumentId', 'fileName fileSize mimeType documentType')
      .sort({ eventDate: -1, createdAt: -1 })
      .lean();

    return {
      product: {
        _id: product._id,
        productName: product.productName,
        category: product.category,
        brand: product.brand,
        model: product.model,
      },
      count: events.length,
      events,
    };
  }

  /**
   * Add a manual note to the product timeline.
   */
  async createManualNote({ userId, productId, title, description = '', eventDate }) {
    // 1. Validate product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 2. Input validation
    if (!title || !title.trim()) {
      const err = new Error('Note title is required');
      err.statusCode = 400;
      throw err;
    }

    if (title.trim().length > 100) {
      const err = new Error('Title cannot exceed 100 characters');
      err.statusCode = 400;
      throw err;
    }

    if (description && description.length > 1000) {
      const err = new Error('Description cannot exceed 1000 characters');
      err.statusCode = 400;
      throw err;
    }

    const event = await OwnershipEvent.create({
      userId,
      productId,
      eventType: 'NOTE_ADDED',
      title: title.trim(),
      description: description?.trim() || '',
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      source: 'USER',
      metadata: {},
    });

    return event;
  }

  /**
   * Update an existing manual user note.
   * System-generated events are strictly protected from modification.
   */
  async updateManualNote({ userId, productId, eventId, title, description, eventDate }) {
    // 1. Validate product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 2. Find event
    const event = await OwnershipEvent.findOne({
      _id: eventId,
      productId,
      userId,
    });

    if (!event) {
      const err = new Error('Timeline event not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 3. Strict immutability for system events
    if (event.source !== 'USER' || event.eventType !== 'NOTE_ADDED') {
      const err = new Error('System-generated ownership events cannot be edited or deleted');
      err.statusCode = 403;
      throw err;
    }

    // 4. Update fields
    if (title !== undefined) {
      if (!title || !title.trim()) {
        const err = new Error('Note title cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      if (title.trim().length > 100) {
        const err = new Error('Title cannot exceed 100 characters');
        err.statusCode = 400;
        throw err;
      }
      event.title = title.trim();
    }

    if (description !== undefined) {
      if (description && description.length > 1000) {
        const err = new Error('Description cannot exceed 1000 characters');
        err.statusCode = 400;
        throw err;
      }
      event.description = description ? description.trim() : '';
    }

    if (eventDate) {
      const parsedDate = new Date(eventDate);
      if (isNaN(parsedDate.getTime())) {
        const err = new Error('Invalid event date provided');
        err.statusCode = 400;
        throw err;
      }
      event.eventDate = parsedDate;
    }

    await event.save();
    return event;
  }

  /**
   * Delete a manual user note.
   * System-generated events are strictly protected from deletion.
   */
  async deleteManualNote({ userId, productId, eventId }) {
    // 1. Validate product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 2. Find event
    const event = await OwnershipEvent.findOne({
      _id: eventId,
      productId,
      userId,
    });

    if (!event) {
      const err = new Error('Timeline event not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 3. Strict immutability for system events
    if (event.source !== 'USER' || event.eventType !== 'NOTE_ADDED') {
      const err = new Error('System-generated ownership events cannot be edited or deleted');
      err.statusCode = 403;
      throw err;
    }

    await OwnershipEvent.findByIdAndDelete(eventId);
    return { id: eventId };
  }

  /**
   * Get global timeline across all products owned by user.
   */
  async getGlobalTimeline({ userId, page = 1, limit = 20, eventType, productId }) {
    const filter = { userId };

    if (eventType && eventType !== 'ALL') {
      filter.eventType = eventType;
    }

    if (productId) {
      filter.productId = productId;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      OwnershipEvent.find(filter)
        .populate('productId', 'productName category brand model purchasePrice currency')
        .populate('relatedDocumentId', 'fileName fileSize mimeType documentType')
        .sort({ eventDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      OwnershipEvent.countDocuments(filter),
    ]);

    return {
      events,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Record automatic timeline event for an expense.
   */
  async recordExpenseEvent(expense, product) {
    if (!expense || !expense.productId || !expense.userId) return null;

    let eventType = 'EXPENSE_ADDED';
    if (['REPAIR', 'SERVICE', 'MAINTENANCE', 'ACCESSORY', 'REPLACEMENT'].includes(expense.expenseType)) {
      eventType = expense.expenseType;
    }

    const priceFormatted = formatINR(expense.amount);
    let desc = `${priceFormatted} ${expense.expenseType.toLowerCase()} expense recorded`;
    if (expense.vendorName) {
      desc += ` at ${expense.vendorName}`;
    }
    if (expense.description) {
      desc += `: ${expense.description}`;
    }

    return await this.recordEvent({
      userId: expense.userId,
      productId: expense.productId,
      eventType,
      title: expense.title || `${expense.expenseType} Expense`,
      description: desc,
      eventDate: expense.expenseDate || new Date(),
      source: 'USER',
      relatedDocumentId: expense.relatedDocumentId || null,
      metadata: {
        expenseId: String(expense._id),
        amount: expense.amount,
        currency: expense.currency || 'INR',
        expenseType: expense.expenseType,
        vendorName: expense.vendorName || '',
      },
    });
  }

  /**
   * Update corresponding timeline event when an expense is modified.
   */
  async updateExpenseEvent(expense) {
    if (!expense || !expense._id) return null;

    const expIdStr = String(expense._id);
    const event = await OwnershipEvent.findOne({
      $or: [
        { 'metadata.expenseId': expense._id },
        { 'metadata.expenseId': expIdStr },
      ],
    });

    if (!event) return null;

    let eventType = 'EXPENSE_ADDED';
    if (['REPAIR', 'SERVICE', 'MAINTENANCE', 'ACCESSORY', 'REPLACEMENT'].includes(expense.expenseType)) {
      eventType = expense.expenseType;
    }

    const priceFormatted = formatINR(expense.amount);
    let desc = `${priceFormatted} ${expense.expenseType.toLowerCase()} expense recorded`;
    if (expense.vendorName) {
      desc += ` at ${expense.vendorName}`;
    }
    if (expense.description) {
      desc += `: ${expense.description}`;
    }

    event.eventType = eventType;
    event.title = expense.title || `${expense.expenseType} Expense`;
    event.description = desc;
    event.eventDate = expense.expenseDate || event.eventDate;
    event.relatedDocumentId = expense.relatedDocumentId || null;
    event.metadata = {
      ...event.metadata,
      amount: expense.amount,
      currency: expense.currency || 'INR',
      expenseType: expense.expenseType,
      vendorName: expense.vendorName || '',
    };

    return await event.save();
  }

  /**
   * Delete corresponding timeline event when an expense is deleted.
   */
  async deleteExpenseEvent(expenseId) {
    if (!expenseId) return null;
    const expIdStr = String(expenseId);
    return await OwnershipEvent.deleteMany({
      $or: [
        { 'metadata.expenseId': expenseId },
        { 'metadata.expenseId': expIdStr },
      ],
    });
  }
}

export default new TimelineService();
