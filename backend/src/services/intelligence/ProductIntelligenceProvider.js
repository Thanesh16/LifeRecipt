/**
 * LIFERECEIPT ProductIntelligenceProvider (Abstract Base Class)
 * Defines the contract for all modular external product intelligence providers.
 */
export class ProductIntelligenceProvider {
  constructor(providerName) {
    if (new.target === ProductIntelligenceProvider) {
      throw new TypeError('Cannot construct ProductIntelligenceProvider abstract instances directly.');
    }
    this.providerName = providerName;
  }

  /**
   * Fetch technical specifications, support portals, manuals, and official warranty data
   * @param {Object} params
   * @param {string} params.brand
   * @param {string} params.model
   * @param {string} params.productName
   * @param {string} params.category
   * @returns {Promise<Object|null>}
   */
  async fetchProductIntelligence({ brand, model, productName, category }) {
    throw new Error('Method fetchProductIntelligence() must be implemented by subclass.');
  }
}

export default ProductIntelligenceProvider;
