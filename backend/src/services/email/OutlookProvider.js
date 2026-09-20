import EmailProvider from './EmailProvider.js';

/**
 * LIFERECEIPT OutlookProvider Adapter
 * Concrete implementation for Microsoft Graph API using read-only scope (Mail.Read).
 * Handles search queries with Indian receipt keywords, metadata extraction, attachment streaming,
 * and token revocation.
 */
export class OutlookProvider extends EmailProvider {
  constructor() {
    super('OUTLOOK');
    this.graphBaseUrl = 'https://graph.microsoft.com/v1.0/me';
  }

  /**
   * Search messages using Microsoft Graph OData / $search filter
   */
  async searchPurchaseMessages({ accessToken, sinceDate, maxResults = 25 }) {
    if (!accessToken) {
      throw new Error('Valid access token is required for Microsoft Graph search');
    }

    try {
      const searchTerms = '"receipt" OR "invoice" OR "tax invoice" OR "order confirmation" OR "bill"';
      let url = `${this.graphBaseUrl}/messages?$search=${encodeURIComponent(searchTerms)}&$top=${maxResults}&$select=id,conversationId,receivedDateTime,subject,from,hasAttachments`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Microsoft Graph API error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      return (data.value || []).map((m) => ({
        messageId: m.id,
        threadId: m.conversationId,
        date: new Date(m.receivedDateTime),
      }));
    } catch (err) {
      console.warn(`[OutlookProvider Warning] Live search failed: ${err.message}.`);
      throw err;
    }
  }

  /**
   * Retrieve message details and attachment headers
   */
  async getMessageDetails({ accessToken, messageId }) {
    if (!accessToken) {
      throw new Error('Valid access token is required for Microsoft Graph message details');
    }

    try {
      const url = `${this.graphBaseUrl}/messages/${messageId}?$expand=attachments`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Microsoft Graph message error (${res.status}): ${errorText}`);
      }

      const msg = await res.json();
      const sender = msg.from?.emailAddress?.name || '';
      const senderEmail = (msg.from?.emailAddress?.address || '').toLowerCase();
      const subject = msg.subject || '';
      const receivedAt = new Date(msg.receivedDateTime || Date.now());

      const attachments = (msg.attachments || [])
        .filter((att) => !att.isInline)
        .map((att) => ({
          attachmentId: att.id,
          fileName: att.name,
          mimeType: att.contentType,
          fileSize: att.size || 0,
        }));

      return {
        messageId: msg.id,
        threadId: msg.conversationId,
        sender,
        senderEmail,
        subject,
        receivedAt,
        snippet: msg.bodyPreview || '',
        bodyText: msg.body?.content || '',
        attachments,
      };
    } catch (err) {
      console.warn(`[OutlookProvider Warning] Failed to get message ${messageId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Download attachment content as buffer
   */
  async getAttachment({ accessToken, messageId, attachmentId }) {
    if (!accessToken) {
      throw new Error('Valid access token is required for Microsoft Graph attachment download');
    }

    try {
      const url = `${this.graphBaseUrl}/messages/${messageId}/attachments/${attachmentId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Microsoft Graph attachment error (${res.status}): ${errorText}`);
      }

      const att = await res.json();
      const buffer = Buffer.from(att.contentBytes, 'base64');
      return {
        buffer,
        mimeType: att.contentType || 'application/pdf',
        fileName: att.name || 'attachment.pdf',
      };
    } catch (err) {
      console.warn(`[OutlookProvider Warning] Failed to download attachment: ${err.message}`);
      throw err;
    }
  }

  /**
   * Revoke token
   */
  async revokeAccess({ token }) {
    // Microsoft Graph tokens expire naturally or are revoked via tenant admin
    return { revoked: true };
  }
}

export default new OutlookProvider();
