import Product from '../models/Product.js';
import OwnershipEvent from '../models/OwnershipEvent.js';
import timelineService from '../services/timelineService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * @desc    Create a new product record
 * @route   POST /api/v1/products
 * @access  Private
 * 
 * SECURITY: Never trust userId from req.body; always use req.user._id.
 */
export const createProduct = async (req, res, next) => {
  try {
    const {
      productName,
      category,
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchasePrice,
      currency,
      sellerName,
      sellerContact,
      warranty,
      returnInfo,
      notes,
      status,
    } = req.body;

    if (!productName || !productName.trim()) {
      return sendError(res, 'Product name is required.', 400);
    }

    const newProduct = await Product.create({
      userId: req.user._id, // Enforce authenticated user identity
      productName: productName.trim(),
      productDescription: req.body.productDescription?.trim() || '',
      category: category || 'Other',
      brand: brand?.trim() || '',
      model: model?.trim() || '',
      serialNumber: serialNumber?.trim() || '',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : Date.now(),
      purchasePrice: typeof purchasePrice === 'number' ? Math.max(0, purchasePrice) : Number(purchasePrice) || 0,
      currency: currency?.trim() || req.user.preferences?.currency || 'INR',
      sellerName: sellerName?.trim() || '',
      sellerContact: sellerContact?.trim() || '',
      warranty: {
        hasWarranty: Boolean(warranty?.hasWarranty),
        warrantyStartDate: warranty?.warrantyStartDate ? new Date(warranty.warrantyStartDate) : undefined,
        warrantyEndDate: warranty?.warrantyEndDate ? new Date(warranty.warrantyEndDate) : undefined,
        warrantyProvider: warranty?.warrantyProvider?.trim() || '',
        warrantyType: warranty?.warrantyType || 'None',
      },
      returnInfo: {
        returnEligible: Boolean(returnInfo?.returnEligible),
        returnStartDate: returnInfo?.returnStartDate ? new Date(returnInfo.returnStartDate) : undefined,
        returnEndDate: returnInfo?.returnEndDate ? new Date(returnInfo.returnEndDate) : undefined,
        returnPolicyNotes: returnInfo?.returnPolicyNotes?.trim() || '',
      },
      notes: notes?.trim() || '',
      status: status || 'Active',
    });

    // Record automatic Phase 5 ownership timeline events
    try {
      await timelineService.recordProductCreationEvents(newProduct);
    } catch (timelineErr) {
      console.error('[Timeline Event Error] Failed to record product creation events:', timelineErr);
    }

    return sendSuccess(res, newProduct, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all products owned by authenticated user with filtering and search
 * @route   GET /api/v1/products
 * @access  Private
 */
export const getProducts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { category, search, status, warrantyStatus, returnStatus, sort } = req.query;

    const filter = { userId };
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Category filter
    if (category && category !== 'All') {
      filter.category = category;
    }

    // Status filter
    if (status && status !== 'All') {
      filter.status = status;
    }

    // Warranty status filter
    if (warrantyStatus) {
      if (warrantyStatus === 'active') {
        filter['warranty.hasWarranty'] = true;
        filter['warranty.warrantyEndDate'] = { $gte: now };
      } else if (warrantyStatus === 'expiring') {
        filter['warranty.hasWarranty'] = true;
        filter['warranty.warrantyEndDate'] = { $gte: now, $lte: thirtyDaysFromNow };
      } else if (warrantyStatus === 'expired') {
        filter['warranty.hasWarranty'] = true;
        filter['warranty.warrantyEndDate'] = { $lt: now };
      } else if (warrantyStatus === 'none') {
        filter['warranty.hasWarranty'] = false;
      }
    }

    // Return status filter
    if (returnStatus) {
      if (returnStatus === 'eligible') {
        filter['returnInfo.returnEligible'] = true;
        filter['returnInfo.returnEndDate'] = { $gte: now };
      } else if (returnStatus === 'expired') {
        filter['returnInfo.returnEligible'] = true;
        filter['returnInfo.returnEndDate'] = { $lt: now };
      } else if (returnStatus === 'ineligible') {
        filter['returnInfo.returnEligible'] = false;
      }
    }

    // Search filter across multiple text fields
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { productName: searchRegex },
        { brand: searchRegex },
        { model: searchRegex },
        { serialNumber: searchRegex },
        { sellerName: searchRegex },
      ];
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'price-high') {
      sortOption = { purchasePrice: -1 };
    } else if (sort === 'price-low') {
      sortOption = { purchasePrice: 1 };
    } else if (sort === 'purchase-recent') {
      sortOption = { purchaseDate: -1 };
    } else if (sort === 'purchase-oldest') {
      sortOption = { purchaseDate: 1 };
    }

    const products = await Product.find(filter).sort(sortOption).lean();

    return sendSuccess(
      res,
      {
        count: products.length,
        products,
      },
      'Products retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by ID
 * @route   GET /api/v1/products/:id
 * @access  Private
 * 
 * SECURITY: Enforce userId === req.user._id
 */
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id, // Strict user isolation
    });

    if (!product) {
      return sendError(res, 'Product not found or access denied.', 404);
    }

    return sendSuccess(res, product, 'Product retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product by ID
 * @route   PUT /api/v1/products/:id
 * @access  Private
 * 
 * SECURITY: Disallows changing userId. Enforce userId === req.user._id
 */
export const updateProduct = async (req, res, next) => {
  try {
    const existing = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!existing) {
      return sendError(res, 'Product not found or access denied.', 404);
    }

    const allowedUpdates = [
      'productName',
      'productDescription',
      'category',
      'brand',
      'model',
      'serialNumber',
      'purchaseDate',
      'purchasePrice',
      'currency',
      'sellerName',
      'sellerContact',
      'warranty',
      'returnInfo',
      'notes',
      'status',
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'purchasePrice') {
          existing[field] = Math.max(0, Number(req.body[field]) || 0);
        } else if (field === 'warranty' && typeof req.body.warranty === 'object') {
          existing.warranty = {
            hasWarranty: Boolean(req.body.warranty.hasWarranty),
            warrantyStartDate: req.body.warranty.warrantyStartDate ? new Date(req.body.warranty.warrantyStartDate) : undefined,
            warrantyEndDate: req.body.warranty.warrantyEndDate ? new Date(req.body.warranty.warrantyEndDate) : undefined,
            warrantyProvider: req.body.warranty.warrantyProvider?.trim() || '',
            warrantyType: req.body.warranty.warrantyType || 'None',
          };
        } else if (field === 'returnInfo' && typeof req.body.returnInfo === 'object') {
          existing.returnInfo = {
            returnEligible: Boolean(req.body.returnInfo.returnEligible),
            returnStartDate: req.body.returnInfo.returnStartDate ? new Date(req.body.returnInfo.returnStartDate) : undefined,
            returnEndDate: req.body.returnInfo.returnEndDate ? new Date(req.body.returnInfo.returnEndDate) : undefined,
            returnPolicyNotes: req.body.returnInfo.returnPolicyNotes?.trim() || '',
          };
        } else {
          existing[field] = req.body[field];
        }
      }
    });

    await existing.save();

    // Record automatic Phase 5 ownership timeline events for updates
    try {
      await timelineService.recordProductUpdateEvents(existing);
    } catch (timelineErr) {
      console.error('[Timeline Event Error] Failed to record product update events:', timelineErr);
    }

    return sendSuccess(res, existing, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete product by ID
 * @route   DELETE /api/v1/products/:id
 * @access  Private
 * 
 * SECURITY: Enforce userId === req.user._id
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!product) {
      return sendError(res, 'Product not found or access denied.', 404);
    }

    // Clean up associated ownership timeline events
    try {
      await OwnershipEvent.deleteMany({ productId: req.params.id, userId: req.user._id });
    } catch (cleanErr) {
      console.warn('[Timeline Cleanup Warning] Failed to delete associated timeline events:', cleanErr.message);
    }

    return sendSuccess(res, { id: req.params.id }, 'Product deleted successfully');
  } catch (error) {
    next(error);
  }
};
