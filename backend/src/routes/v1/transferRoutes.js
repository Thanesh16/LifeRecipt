import express from 'express';
import {
  initiateTransfer,
  getIncomingTransfers,
  getOutgoingTransfers,
  getTransferHistory,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
} from '../../controllers/transferController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../../middleware/securityMiddleware.js';

const router = express.Router();

// All transfer routes require authentication
router.use(protect);

router.post('/', initiateTransfer);
router.post('/initiate', initiateTransfer);
router.get('/incoming', getIncomingTransfers);
router.get('/outgoing', getOutgoingTransfers);
router.get('/history', getTransferHistory);
router.post('/:transferId/accept', validateObjectIdParam('transferId'), acceptTransfer);
router.post('/:transferId/reject', validateObjectIdParam('transferId'), rejectTransfer);
router.post('/:transferId/cancel', validateObjectIdParam('transferId'), cancelTransfer);

export default router;
