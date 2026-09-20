import passportService from '../services/passportService.js';
import securityAuditService from '../services/securityAuditService.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const getPassport = async (req, res, next) => {
  try {
    const data = await passportService.getPassport(req.params.productId, req.user._id);
    sendSuccess(res, data, 'Digital Ownership Passport retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const generatePassportPDF = async (req, res, next) => {
  try {
    await passportService.generatePassportPDF(req.params.productId, req.user._id, res);
  } catch (err) {
    next(err);
  }
};

export const createShareToken = async (req, res, next) => {
  try {
    const { permissionLevel, expiresDays } = req.body;
    const data = await passportService.createShareToken(req.params.productId, req.user._id, {
      permissionLevel,
      expiresDays,
    });

    await securityAuditService.logEvent({
      userId: req.user._id,
      email: req.user.email,
      action: 'PASSPORT_SHARE_CREATE',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        productId: req.params.productId,
        permissionLevel: data.permissionLevel || data.share?.permissionLevel,
        expiresAt: data.expiresAt || data.share?.expiresAt,
      },
    });

    sendSuccess(res, data, 'Passport share link generated successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getShareTokens = async (req, res, next) => {
  try {
    const data = await passportService.getShareTokens(req.params.productId, req.user._id);
    sendSuccess(res, data, 'Passport share links retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getUserShares = async (req, res, next) => {
  try {
    const data = await passportService.getUserShares(req.user._id);
    sendSuccess(res, data, 'User passport shares retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const revokeShareToken = async (req, res, next) => {
  try {
    const data = await passportService.revokeShareToken(req.user._id, req.params.shareId);

    await securityAuditService.logEvent({
      userId: req.user._id,
      email: req.user.email,
      action: 'PASSPORT_SHARE_REVOKE',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        shareId: req.params.shareId,
      },
    });

    sendSuccess(res, data, 'Passport share link revoked successfully');
  } catch (err) {
    next(err);
  }
};

export const getPublicPassport = async (req, res, next) => {
  try {
    const data = await passportService.getPublicPassport(req.params.token);
    sendSuccess(res, data, 'Public digital passport retrieved successfully');
  } catch (err) {
    next(err);
  }
};
