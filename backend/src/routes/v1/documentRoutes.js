import express from 'express';
import {
  uploadAndExtract,
  confirmAndCreateProduct,
  getDocuments,
  getDocumentById,
  downloadDocumentFile,
  deleteDocument,
  reprocessDocument,
  linkProduct,
  updateExtractedData,
} from '../../controllers/documentController.js';
import protect from '../../middleware/authMiddleware.js';
import uploadSingleDocument from '../../middleware/uploadMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All document routes require active JWT authentication
router.use(protect);

router.post(
  '/upload-and-extract',
  uploadSingleDocument('document'),
  uploadAndExtract
);

router.post('/confirm-product', confirmAndCreateProduct);

router.get('/', getDocuments);
router.get('/:id', validateObjectIdParam('id'), getDocumentById);
router.get('/:id/file', validateObjectIdParam('id'), downloadDocumentFile);
router.delete('/:id', validateObjectIdParam('id'), deleteDocument);

// Phase 16 Document Intelligence routes
router.post('/:id/reprocess', validateObjectIdParam('id'), reprocessDocument);
router.post('/:id/link-product', validateObjectIdParam('id'), linkProduct);
router.patch('/:id/extracted-data', validateObjectIdParam('id'), updateExtractedData);

export default router;
