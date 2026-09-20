import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Document from '../models/Document.js';
import Expense from '../models/Expense.js';
import ServiceRecord from '../models/ServiceRecord.js';
import WarrantyClaim from '../models/WarrantyClaim.js';
import Alert from '../models/Alert.js';
import OwnershipEvent from '../models/OwnershipEvent.js';
import PassportShare from '../models/PassportShare.js';
import EmailConnection from '../models/EmailConnection.js';
import OwnershipTransfer from '../models/OwnershipTransfer.js';
import Conversation from '../models/Conversation.js';
import securityAuditService from '../services/securityAuditService.js';
import generateToken from '../utils/generateToken.js';
import env from '../config/env.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * @desc    Register a new user account
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      await securityAuditService.logEvent({
        email,
        action: 'REGISTER',
        status: 'FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Email already exists' },
      });
      return sendError(res, 'An account with this email already exists.', 409);
    }

    // Create new user (password is automatically hashed via pre-save hook)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
    });

    // Generate JWT
    const token = generateToken(user._id);

    await securityAuditService.logEvent({
      userId: user._id,
      email: user.email,
      action: 'REGISTER',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          preferences: user.preferences,
          createdAt: user.createdAt,
        },
        token,
      },
      'User registered successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & return JWT token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Retrieve user including the password field which is select: false by default
    const user = await User.findOne({ email: email ? email.toLowerCase() : '' }).select('+password');

    if (!user) {
      await securityAuditService.logEvent({
        email,
        action: 'FAILED_LOGIN',
        status: 'FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'User not found' },
      });
      return sendError(res, 'Invalid email or password.', 401);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await securityAuditService.logEvent({
        userId: user._id,
        email: user.email,
        action: 'FAILED_LOGIN',
        status: 'FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Invalid password' },
      });
      return sendError(res, 'Invalid email or password.', 401);
    }

    const token = generateToken(user._id);

    await securityAuditService.logEvent({
      userId: user._id,
      email: user.email,
      action: 'LOGIN',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          preferences: user.preferences,
          createdAt: user.createdAt,
        },
        token,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Retrieve current authenticated user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    return sendSuccess(
      res,
      {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          preferences: req.user.preferences,
          createdAt: req.user.createdAt,
          updatedAt: req.user.updatedAt,
        },
      },
      'Current user profile retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / invalidate session client-side
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = async (req, res, next) => {
  try {
    await securityAuditService.logEvent({
      userId: req.user._id,
      email: req.user.email,
      action: 'LOGOUT',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(
      res,
      null,
      'Logged out successfully. Please clear authentication tokens.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Retrieve authenticated user security audit log
 * @route   GET /api/v1/auth/audit-log
 * @access  Private
 */
export const getAuditLog = async (req, res, next) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const data = await securityAuditService.getUserAuditLog(req.user._id, { limit, page });
    return sendSuccess(res, data, 'Security audit log retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete account and all private user data
 * @route   DELETE /api/v1/auth/account
 * @access  Private
 */
export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return sendError(res, 'Password confirmation is required to delete account.', 400);
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return sendError(res, 'User account not found.', 404);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await securityAuditService.logEvent({
        userId: user._id,
        email: user.email,
        action: 'ACCOUNT_DELETE',
        status: 'FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Password confirmation failed' },
      });
      return sendError(res, 'Incorrect password. Account deletion aborted.', 401);
    }

    const userId = user._id;

    // 1. Clean up user's physical documents on disk
    try {
      const userDir = path.join(env.UPLOAD_DIR, userId.toString());
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
      }
    } catch (fsErr) {
      console.warn(`[Account Deletion Warning] Failed to delete disk files: ${fsErr.message}`);
    }

    // 2. Cascade delete all private records owned by user
    await Promise.all([
      Product.deleteMany({ userId }),
      Document.deleteMany({ userId }),
      Expense.deleteMany({ userId }),
      ServiceRecord.deleteMany({ userId }),
      WarrantyClaim.deleteMany({ userId }),
      Alert.deleteMany({ userId }),
      OwnershipEvent.deleteMany({ userId }),
      PassportShare.deleteMany({ userId }),
      EmailConnection.deleteMany({ userId }),
      Conversation.deleteMany({ userId }),
      OwnershipTransfer.updateMany({ fromUserId: userId, status: 'PENDING' }, { status: 'CANCELLED' }),
    ]);

    // 3. Log security event before deleting user record
    await securityAuditService.logEvent({
      userId,
      email: user.email,
      action: 'ACCOUNT_DELETE',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { accountDeleted: true },
    });

    // 4. Delete user record
    await User.findByIdAndDelete(userId);

    return sendSuccess(res, null, 'Account and associated data deleted successfully');
  } catch (error) {
    next(error);
  }
};
