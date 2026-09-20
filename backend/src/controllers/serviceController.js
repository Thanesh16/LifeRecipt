import serviceRecordService from '../services/serviceRecordService.js';
import warrantyClaimService from '../services/warrantyClaimService.js';
import serviceCenterService from '../services/serviceCenterService.js';
import { sendSuccess } from '../utils/responseHandler.js';

// ================= SERVICE RECORDS =================

export const getServiceRecords = async (req, res, next) => {
  try {
    const { productId, status, serviceType, search, page, limit } = req.query;
    const data = await serviceRecordService.getServiceRecords({
      userId: req.user._id,
      productId,
      status,
      serviceType,
      search,
      page,
      limit,
    });
    sendSuccess(res, data, 'Service records retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getServiceRecordById = async (req, res, next) => {
  try {
    const data = await serviceRecordService.getServiceRecordById(req.params.id, req.user._id);
    sendSuccess(res, data, 'Service record retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createServiceRecord = async (req, res, next) => {
  try {
    const data = await serviceRecordService.createServiceRecord({
      userId: req.user._id,
      ...req.body,
    });
    sendSuccess(res, data, 'Service record created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateServiceRecord = async (req, res, next) => {
  try {
    const data = await serviceRecordService.updateServiceRecord(
      req.params.id,
      req.user._id,
      req.body
    );
    sendSuccess(res, data, 'Service record updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteServiceRecord = async (req, res, next) => {
  try {
    const data = await serviceRecordService.deleteServiceRecord(req.params.id, req.user._id);
    sendSuccess(res, data, 'Service record deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const getServiceStats = async (req, res, next) => {
  try {
    const { productId } = req.query;
    const data = await serviceRecordService.getServiceStats(req.user._id, productId);
    sendSuccess(res, data, 'Service analytics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getServiceHistoryAnalysis = async (req, res, next) => {
  try {
    const { productId } = req.query;
    const data = await serviceRecordService.getServiceHistoryAnalysis(req.user._id, productId);
    sendSuccess(res, data, 'Service history pattern analysis retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// ================= WARRANTY CLAIMS =================

export const prepareWarrantyClaim = async (req, res, next) => {
  try {
    const data = await warrantyClaimService.prepareWarrantyClaim(
      req.params.productId,
      req.user._id
    );
    sendSuccess(res, data, 'Warranty claim preparation checklist retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const submitWarrantyClaim = async (req, res, next) => {
  try {
    const data = await warrantyClaimService.submitWarrantyClaim({
      userId: req.user._id,
      ...req.body,
    });
    sendSuccess(res, data, 'Warranty claim submitted successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getWarrantyClaims = async (req, res, next) => {
  try {
    const { productId, status } = req.query;
    const data = await warrantyClaimService.getWarrantyClaims({
      userId: req.user._id,
      productId,
      status,
    });
    sendSuccess(res, data, 'Warranty claims retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getWarrantyClaimById = async (req, res, next) => {
  try {
    const data = await warrantyClaimService.getWarrantyClaimById(req.params.id, req.user._id);
    sendSuccess(res, data, 'Warranty claim retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateClaimStatus = async (req, res, next) => {
  try {
    const { status, notes, resolution } = req.body;
    const data = await warrantyClaimService.updateClaimStatus(
      req.params.id,
      req.user._id,
      status,
      { notes, resolution }
    );
    sendSuccess(res, data, 'Warranty claim status updated successfully');
  } catch (err) {
    next(err);
  }
};

// ================= SERVICE CENTERS =================

export const getServiceCenters = async (req, res, next) => {
  try {
    const { brand, city, state, postalCode } = req.query;
    const data = serviceCenterService.getServiceCenters({
      brand,
      city,
      state,
      postalCode,
    });
    sendSuccess(res, data, 'Verified service centers retrieved successfully');
  } catch (err) {
    next(err);
  }
};
