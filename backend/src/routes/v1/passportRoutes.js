import express from 'express';
import {
  getPassport,
  generatePassportPDF,
  createShareToken,
  getShareTokens,
  getUserShares,
  revokeShareToken,
  getPublicPassport,
} from '../../controllers/passportController.js';
import protect from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// Public endpoint - unauthenticated access via cryptographic share token
router.get('/public/:token', getPublicPassport);

// Authenticated owner endpoints
router.use(protect);

router.get('/user/shares', getUserShares);
router.delete('/shares/:shareId', validateObjectIdParam('shareId'), revokeShareToken);

router.get('/:productId', validateObjectIdParam('productId'), getPassport);
router.get('/:productId/pdf', validateObjectIdParam('productId'), generatePassportPDF);
router.post('/:productId/shares', validateObjectIdParam('productId'), createShareToken);
router.get('/:productId/shares', validateObjectIdParam('productId'), getShareTokens);

export default router;
