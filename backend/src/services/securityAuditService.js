import SecurityAudit from '../models/SecurityAudit.js';

/**
 * LIFERECEIPT Security Audit Service
 * Centralized logging and retrieval of security-sensitive operations.
 */
class SecurityAuditService {
  /**
   * Log a security event safely without storing sensitive payload data.
   */
  async logEvent({
    userId = null,
    email = null,
    action,
    status = 'SUCCESS',
    ipAddress = 'unknown',
    userAgent = 'unknown',
    details = {},
  }) {
    try {
      // Sanitize details: strip any password, token, or secret keys
      const sanitizedDetails = { ...details };
      const forbiddenKeys = ['password', 'token', 'secret', 'refreshToken', 'accessToken', 'apiKey'];
      forbiddenKeys.forEach((k) => delete sanitizedDetails[k]);

      return await SecurityAudit.create({
        userId,
        email: email ? email.toLowerCase().trim() : null,
        action,
        status,
        ipAddress: ipAddress || 'unknown',
        userAgent: (userAgent || 'unknown').slice(0, 255),
        details: sanitizedDetails,
      });
    } catch (err) {
      // Failure to write audit event should not crash primary application flow, but should be logged
      console.error(`[SecurityAudit Error] Failed to record event ${action}:`, err.message);
      return null;
    }
  }

  /**
   * Retrieve chronological security audit trail for authenticated user.
   */
  async getUserAuditLog(userId, { limit = 20, page = 1 } = {}) {
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const pg = Math.max(1, Number(page) || 1);
    const skip = (pg - 1) * lim;

    const [events, total] = await Promise.all([
      SecurityAudit.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      SecurityAudit.countDocuments({ userId }),
    ]);

    return {
      events,
      logs: events,
      pagination: {
        total,
        page: pg,
        pages: Math.ceil(total / lim) || 1,
        limit: lim,
      },
    };
  }
}

export default new SecurityAuditService();
