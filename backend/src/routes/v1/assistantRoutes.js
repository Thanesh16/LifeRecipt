import express from 'express';
import {
  chatWithAssistant,
  getAssistantHistory,
  clearAssistantHistory,
} from '../../controllers/assistantController.js';
import protect from '../../middleware/authMiddleware.js';

const router = express.Router();

// Require active JWT authentication for all assistant interactions
router.use(protect);

router.post('/chat', chatWithAssistant);
router.post('/', chatWithAssistant);
router.get('/history', getAssistantHistory);
router.delete('/history', clearAssistantHistory);

export default router;
