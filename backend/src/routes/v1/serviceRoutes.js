import express from 'express';
import {
  getServiceRecords,
  getServiceRecordById,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
  getServiceStats,
  getServiceHistoryAnalysis,
  prepareWarrantyClaim,
  submitWarrantyClaim,
  getWarrantyClaims,
  getWarrantyClaimById,
  updateClaimStatus,
  getServiceCenters,
} from '../../controllers/serviceController.js';
import protect from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All service routes require authentication
router.use(protect);

// Service Centers Lookup
router.get('/centers', getServiceCenters);

// Service Analytics & Pattern Analysis
router.get('/stats', getServiceStats);
router.get('/analysis', getServiceHistoryAnalysis);

// Warranty Claim endpoints
router.get('/claims/prepare/:productId', validateObjectIdParam('productId'), prepareWarrantyClaim);
router.post('/claims', submitWarrantyClaim);
router.get('/claims', getWarrantyClaims);
router.get('/claims/:id', validateObjectIdParam('id'), getWarrantyClaimById);
router.put('/claims/:id/status', validateObjectIdParam('id'), updateClaimStatus);

// Service Record CRUD
router.route('/')
  .get(getServiceRecords)
  .post(createServiceRecord);

router.route('/:id')
  .get(validateObjectIdParam('id'), getServiceRecordById)
  .put(validateObjectIdParam('id'), updateServiceRecord)
  .delete(validateObjectIdParam('id'), deleteServiceRecord);

export default router;
