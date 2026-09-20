import express from 'express';
import {
  register,
  login,
  getMe,
  logout,
  getAuditLog,
  deleteAccount,
} from '../../controllers/authController.js';
import {
  registerValidationRules,
  loginValidationRules,
} from '../../middleware/validateMiddleware.js';
import protect from '../../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerValidationRules, register);
router.post('/login', loginValidationRules, login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.get('/audit-log', protect, getAuditLog);
router.delete('/account', protect, deleteAccount);

export default router;
