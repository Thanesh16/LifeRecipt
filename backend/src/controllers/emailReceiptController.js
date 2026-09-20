import emailIntelligenceService from '../services/email/emailIntelligenceService.js';
import { sendSuccess } from '../utils/responseHandler.js';
import env from '../config/env.js';

export const connectEmailProvider = async (req, res, next) => {
  try {
    const { provider, emailAddress, accessToken, refreshToken, tokenExpiry, scopes } = req.body;
    const connection = await emailIntelligenceService.connectProvider({
      userId: req.user._id,
      provider,
      emailAddress,
      accessToken,
      refreshToken,
      tokenExpiry,
      scopes,
    });
    sendSuccess(res, connection, `${provider} connected successfully`, 201);
  } catch (err) {
    next(err);
  }
};

export const getConnectedAccounts = async (req, res, next) => {
  try {
    const connections = await emailIntelligenceService.getUserConnections(req.user._id);
    sendSuccess(res, connections, 'Connected email accounts retrieved');
  } catch (err) {
    next(err);
  }
};

export const disconnectAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await emailIntelligenceService.disconnectProvider(req.user._id, id);
    sendSuccess(res, result, 'Email account disconnected successfully');
  } catch (err) {
    next(err);
  }
};

export const syncEmailAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await emailIntelligenceService.syncMailbox(req.user._id, id, { manual: true });
    sendSuccess(res, result, 'Email sync completed successfully');
  } catch (err) {
    next(err);
  }
};

export const getEmailCandidates = async (req, res, next) => {
  try {
    const { tab, page, limit } = req.query;
    const data = await emailIntelligenceService.getCandidates({
      userId: req.user._id,
      tab,
      page,
      limit,
    });
    sendSuccess(res, data, 'Email purchase candidates retrieved');
  } catch (err) {
    next(err);
  }
};

export const getEmailCandidateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const candidate = await emailIntelligenceService.getCandidateById(req.user._id, id);
    sendSuccess(res, candidate, 'Candidate details retrieved');
  } catch (err) {
    next(err);
  }
};

export const confirmEmailCandidate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { modifiedFields, linkToExistingProductId } = req.body;
    const result = await emailIntelligenceService.confirmCandidate({
      userId: req.user._id,
      candidateId: id,
      modifiedFields,
      linkToExistingProductId,
    });
    sendSuccess(res, result, 'Receipt confirmed and added to ownership records', 201);
  } catch (err) {
    next(err);
  }
};

export const rejectEmailCandidate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await emailIntelligenceService.rejectCandidate(req.user._id, id, reason);
    sendSuccess(res, result, 'Email receipt candidate rejected');
  } catch (err) {
    next(err);
  }
};

export const updateConnectionSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scanPeriodDays, syncFrequencyHours, autoEnrich } = req.body;
    const updated = await emailIntelligenceService.updateConnectionSettings(req.user._id, id, {
      scanPeriodDays,
      syncFrequencyHours,
      autoEnrich,
    });
    sendSuccess(res, updated, 'Email sync settings updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Generate genuine Google OAuth 2.0 Authorization URL
 */
export const getGoogleAuthUrl = async (req, res, next) => {
  try {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri = req.query.redirectUri || env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Gmail OAuth configuration required. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.',
      });
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'openid',
      'email',
      'profile',
    ].join(' ');

    const state = req.user._id.toString();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(state)}`;

    return res.status(200).json({
      success: true,
      configured: true,
      authUrl,
      data: { configured: true, authUrl },
      message: 'Google OAuth URL generated',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle OAuth 2.0 callback and token exchange from Google
 */
export const handleGoogleCallback = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is required' });
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const effectiveRedirectUri = redirectUri || env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Gmail OAuth configuration required. GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured.',
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: effectiveRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      return res.status(400).json({ success: false, message: `Failed to exchange Google OAuth code: ${errBody}` });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Fetch user profile from Google to get genuine Google email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return res.status(400).json({ success: false, message: 'Failed to fetch Google profile information' });
    }

    const profile = await userInfoRes.json();
    const realEmail = profile.email;

    if (!realEmail) {
      return res.status(400).json({ success: false, message: 'Could not retrieve email from Google profile' });
    }

    // Connect provider with genuine tokens and real email
    const connection = await emailIntelligenceService.connectProvider({
      userId: req.user._id,
      provider: 'GMAIL',
      emailAddress: realEmail,
      accessToken,
      refreshToken,
      tokenExpiry: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      providerAccountId: profile.id,
    });

    return sendSuccess(
      res,
      { connection, emailAddress: realEmail },
      `Gmail account (${realEmail}) connected successfully`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Handle direct GET callback from Google OAuth redirect (Server-Side flow)
 */
export const handleGoogleServerRedirectCallback = async (req, res, next) => {
  const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
  try {
    const { code, state, error } = req.query;

    if (error) {
      const isAccessDenied = error === 'access_denied';
      const msg = isAccessDenied
        ? 'Google access blocked (403 access_denied): Your Google account is not added under Test Users in Google Cloud Console OAuth consent screen.'
        : `Google authorization was denied: ${error}`;
      return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent(msg)}`);
    }

    if (!code) {
      return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent('No authorization code was received from Google.')}`);
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/email-receipts/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent('Gmail OAuth configuration required. GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured.')}`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent(`Failed to exchange Google OAuth code: ${errBody}`)}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Fetch user profile from Google to get genuine Google email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent('Failed to fetch Google profile information')}`);
    }

    const profile = await userInfoRes.json();
    const realEmail = profile.email;

    if (!realEmail) {
      return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent('Could not retrieve email from Google profile')}`);
    }

    // Connect provider with genuine tokens and real email
    const userId = state;
    if (!userId) {
      return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent('Invalid OAuth state: missing user association')}`);
    }

    await emailIntelligenceService.connectProvider({
      userId,
      provider: 'GMAIL',
      emailAddress: realEmail,
      accessToken,
      refreshToken,
      tokenExpiry: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      providerAccountId: profile.id,
    });

    return res.redirect(`${clientUrl}/email-receipts?status=success&email=${encodeURIComponent(realEmail)}`);
  } catch (err) {
    return res.redirect(`${clientUrl}/email-receipts?status=error&message=${encodeURIComponent(err.message || 'OAuth error')}`);
  }
};
