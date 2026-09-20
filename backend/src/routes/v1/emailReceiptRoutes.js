import express from 'express';
import {
  connectEmailProvider,
  getConnectedAccounts,
  disconnectAccount,
  syncEmailAccount,
  getEmailCandidates,
  getEmailCandidateById,
  confirmEmailCandidate,
  rejectEmailCandidate,
  updateConnectionSettings,
  getGoogleAuthUrl,
  handleGoogleCallback,
  handleGoogleServerRedirectCallback,
} from '../../controllers/emailReceiptController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public callback endpoint for direct server-side Google OAuth redirects
router.get('/auth/google/callback', handleGoogleServerRedirectCallback);

// All subsequent email receipt endpoints require authentication
router.use(protect);

// Genuine Google OAuth 2.0 routes (SPA initiation and callback)
router.get('/auth/google/url', getGoogleAuthUrl);
router.post('/auth/google/callback', handleGoogleCallback);

// Account connection & sync routes
router.post('/connect', connectEmailProvider);
router.get('/connections', getConnectedAccounts);
router.put('/connections/:id/settings', updateConnectionSettings);
router.post('/connections/:id/sync', syncEmailAccount);
router.post('/connections/:id/disconnect', disconnectAccount);
router.delete('/connections/:id', disconnectAccount);

// Candidate management & review routes
router.get('/', getEmailCandidates);
router.get('/candidates', getEmailCandidates); // alias for clarity
router.get('/:id', getEmailCandidateById);
router.post('/:id/confirm', confirmEmailCandidate);
router.post('/:id/reject', rejectEmailCandidate);

export default router;
