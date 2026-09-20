/**
 * LIFERECEIPT EmailProvider (Abstract Base Class)
 * Defines the contract for all modular third-party email provider integrations.
 * Prohibits hardcoding provider-specific logic in domain services.
 */
export class EmailProvider {
  constructor(providerName) {
    if (new.target === EmailProvider) {
      throw new TypeError('Cannot construct EmailProvider abstract instances directly.');
    }
    this.providerName = providerName;
  }

  /**
   * Search mailbox for purchase/receipt emails
   * @param {Object} params
   * @param {string} params.accessToken Decrypted provider access token
   * @param {Date} params.sinceDate Incremental search cutoff
   * @param {number} params.maxResults Max messages to retrieve per sync
   * @returns {Promise<Array<{ messageId: string, threadId: string, date: Date }>>}
   */
  async searchPurchaseMessages({ accessToken, sinceDate, maxResults = 25 }) {
    throw new Error('Method searchPurchaseMessages() must be implemented by subclass.');
  }

  /**
   * Retrieve message metadata, body snippet, and attachment descriptors
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.messageId
   * @returns {Promise<{ messageId: string, threadId: string, sender: string, senderEmail: string, subject: string, receivedAt: Date, snippet: string, bodyText: string, attachments: Array<{ attachmentId: string, fileName: string, mimeType: string, fileSize: number }> }>}
   */
  async getMessageDetails({ accessToken, messageId }) {
    throw new Error('Method getMessageDetails() must be implemented by subclass.');
  }

  /**
   * Download specific attachment content as buffer
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.messageId
   * @param {string} params.attachmentId
   * @returns {Promise<{ buffer: Buffer, mimeType: string, fileName: string }>}
   */
  async getAttachment({ accessToken, messageId, attachmentId }) {
    throw new Error('Method getAttachment() must be implemented by subclass.');
  }

  /**
   * Revoke third-party provider grant on disconnection
   * @param {Object} params
   * @param {string} params.token Access or refresh token to revoke
   */
  async revokeAccess({ token }) {
    throw new Error('Method revokeAccess() must be implemented by subclass.');
  }
}

export default EmailProvider;
