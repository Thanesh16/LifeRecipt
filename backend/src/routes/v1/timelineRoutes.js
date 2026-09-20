import express from 'express';
import { getGlobalTimeline } from '../../controllers/timelineController.js';
import protect from '../../middleware/authMiddleware.js';

const router = express.Router();

// Enforce JWT authentication
router.use(protect);

// Global user timeline
router.get('/', getGlobalTimeline);

export default router;
