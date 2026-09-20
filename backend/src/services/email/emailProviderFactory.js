import gmailProvider from './GmailProvider.js';
import outlookProvider from './OutlookProvider.js';

/**
 * LIFERECEIPT Email Provider Factory
 * Resolves modular email provider instances by name.
 */
class EmailProviderFactory {
  constructor() {
    this.providers = new Map();
    this.register('GMAIL', gmailProvider);
    this.register('OUTLOOK', outlookProvider);
  }

  register(name, providerInstance) {
    this.providers.set(name.toUpperCase(), providerInstance);
  }

  getProvider(providerName) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }
    const normalized = providerName.toUpperCase();
    const provider = this.providers.get(normalized);
    if (!provider) {
      throw new Error(`Unsupported email provider: ${providerName}. Supported: GMAIL, OUTLOOK.`);
    }
    return provider;
  }
}

export default new EmailProviderFactory();
