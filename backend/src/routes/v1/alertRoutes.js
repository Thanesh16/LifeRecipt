import express from 'express';
import {
  getAlerts,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../../controllers/alertController.js';
import protect from '../../middleware/authMiddleware.js';

const router = express.Router();

// All alert endpoints require authentication
router.use(protect);

router.get('/', getAlerts);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;
