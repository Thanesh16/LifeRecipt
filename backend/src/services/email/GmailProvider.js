import EmailProvider from './EmailProvider.js';

/**
 * LIFERECEIPT GmailProvider Adapter
 * Concrete implementation for Google Gmail API using read-only scope (gmail.readonly).
 * Handles search queries with Indian receipt keywords, metadata extraction, attachment streaming,
 * and token revocation.
 */
export class GmailProvider extends EmailProvider {
  constructor() {
    super('GMAIL');
    this.baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';
  }

  /**
   * Search messages using Gmail query operators
   */
  async searchPurchaseMessages({ accessToken, sinceDate, maxResults = 25 }) {
    if (!accessToken) {
      throw new Error('Valid Google OAuth access token is required for Gmail search');
    }

    try {
      // Gmail search query syntax for purchase/receipt emails
      const keywords = [
        'receipt',
        'invoice',
        '"tax invoice"',
        '"order confirmation"',
        '"bill"',
        'GSTIN',
      ];
      let query = `(${keywords.join(' OR ')})`;
      if (sinceDate && !isNaN(new Date(sinceDate).getTime())) {
        const epochSeconds = Math.floor(new Date(sinceDate).getTime() / 1000);
        query += ` after:${epochSeconds}`;
      }

      const url = `${this.baseUrl}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gmail API error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      return (data.messages || []).map((m) => ({
        messageId: m.id,
        threadId: m.threadId,
      }));
    } catch (err) {
      console.warn(`[GmailProvider Warning] Live search failed: ${err.message}.`);
      throw err;
    }
  }

  /**
   * Fetch full message details including headers, snippet, and attachment metadata
   */
  async getMessageDetails({ accessToken, messageId }) {
    if (!accessToken) {
      throw new Error('Valid Google OAuth access token is required for Gmail message details');
    }

    try {
      const url = `${this.baseUrl}/messages/${messageId}?format=full`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gmail API message error (${res.status}): ${errorText}`);
      }

      const message = await res.json();
      const headers = message.payload?.headers || [];
      const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const sender = getHeader('From');
      const subject = getHeader('Subject');
      const dateHeader = getHeader('Date');
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date(parseInt(message.internalDate, 10));

      const senderEmailMatch = sender.match(/<([^>]+)>/) || [null, sender];
      const senderEmail = (senderEmailMatch[1] || sender).trim().toLowerCase();

      // Extract attachments
      const attachments = [];
      const parts = this._flattenParts(message.payload);

      let bodyText = '';
      let htmlText = '';
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            attachmentId: part.body.attachmentId,
            fileName: part.filename,
            mimeType: part.mimeType,
            fileSize: part.body.size || 0,
          });
        } else if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText += Buffer.from(part.body.data, 'base64url').toString('utf8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlText += Buffer.from(part.body.data, 'base64url').toString('utf8');
        }
      }

      if (!bodyText && htmlText) {
        bodyText = htmlText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      }

      return {
        messageId: message.id,
        threadId: message.threadId,
        sender,
        senderEmail,
        subject,
        receivedAt,
        snippet: message.snippet || '',
        bodyText,
        attachments,
      };
    } catch (err) {
      console.warn(`[GmailProvider Warning] Failed to get message ${messageId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Fetch attachment binary buffer
   */
  async getAttachment({ accessToken, messageId, attachmentId }) {
    if (!accessToken) {
      throw new Error('Valid Google OAuth access token is required for Gmail attachment download');
    }

    try {
      const url = `${this.baseUrl}/messages/${messageId}/attachments/${attachmentId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gmail API attachment error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const buffer = Buffer.from(data.data, 'base64url');
      return {
        buffer,
        mimeType: 'application/pdf',
        fileName: 'attachment.pdf',
      };
    } catch (err) {
      console.warn(`[GmailProvider Warning] Failed to download attachment: ${err.message}`);
      throw err;
    }
  }

  /**
   * Revoke token grant
   */
  async revokeAccess({ token }) {
    if (!token) {
      return { revoked: true };
    }

    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return { revoked: true };
    } catch (err) {
      console.warn(`[GmailProvider Warning] Revocation error: ${err.message}`);
      return { revoked: false };
    }
  }

  // --- Internal Helper Methods ---
  _flattenParts(payload) {
    let list = [];
    if (!payload) return list;
    if (payload.parts && payload.parts.length > 0) {
      for (const p of payload.parts) {
        list = list.concat(this._flattenParts(p));
      }
    } else {
      list.push(payload);
    }
    return list;
  }
}

export default new GmailProvider();
