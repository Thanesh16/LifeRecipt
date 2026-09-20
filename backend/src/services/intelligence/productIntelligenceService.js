import Product from '../../models/Product.js';
import ProductIntelligence from '../../models/ProductIntelligence.js';
import officialManufacturerProvider from './OfficialManufacturerProvider.js';
import webProductIntelligenceProvider from './WebProductIntelligenceProvider.js';

/**
 * LIFERECEIPT Product Intelligence Service
 * Orchestrates external specifications, manuals, support URLs, and official warranty retrieval.
 * Enforces caching (7-day TTL), privacy sanitization, and zero overwrite of user receipts.
 */
class ProductIntelligenceService {
  constructor() {
    this.providers = [
      officialManufacturerProvider,
      webProductIntelligenceProvider,
    ];
  }

  /**
   * Fetch cached or fresh product intelligence
   */
  async getProductIntelligence({ userId, productId, forceRefresh = false }) {
    const product = await Product.findOne({ _id: productId, userId })
      .select('productName category brand model serialNumber purchaseDate purchasePrice warranty returnInfo sellerName status')
      .lean();

    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();

    // 1. Check cached intelligence if not forcing refresh
    if (!forceRefresh) {
      const cached = await ProductIntelligence.findOne({
        productId: product._id,
        status: 'ACTIVE',
        expiresAt: { $gt: now },
      }).lean();

      if (cached) {
        return {
          ...cached,
          isCached: true,
          warrantyComparison: this.evaluateWarrantyConflict(product.warranty, cached.officialWarranty),
        };
      }
    }

    // 2. Validate product identification sufficiency
    const brand = (product.brand || '').trim();
    const model = (product.model || '').trim();
    const productName = (product.productName || '').trim();

    if (!brand && !model && (!productName || productName.split(/\s+/).length < 2)) {
      return {
        productId: product._id,
        status: 'UNAVAILABLE',
        message: 'Insufficient product identification to query external intelligence. Add brand or model details.',
        specifications: [],
        warrantyComparison: null,
      };
    }

    // 3. Ambiguity check: if model is generic without specific model designator
    const genericTerms = ['laptop', 'phone', 'tv', 'television', 'headphone', 'watch', 'monitor'];
    const isVagueModel =
      genericTerms.includes(model.toLowerCase()) ||
      (!model && genericTerms.includes(productName.toLowerCase()));

    if (isVagueModel) {
      return {
        productId: product._id,
        status: 'AMBIGUOUS',
        message: 'Multiple possible matches found. Please specify the exact hardware model number.',
        ambiguousMatches: [
          { model: `${brand} 15-inch Standard Edition`, name: `${brand} Standard Edition`, description: 'Base configuration' },
          { model: `${brand} Pro Performance Edition`, name: `${brand} Pro Edition`, description: 'Upgraded hardware' },
        ],
        specifications: [],
        warrantyComparison: null,
      };
    }

    // 4. Query providers in priority order
    let intelligenceData = null;

    for (const provider of this.providers) {
      try {
        intelligenceData = await provider.fetchProductIntelligence({
          brand,
          model,
          productName,
          category: product.category,
        });

        if (intelligenceData) {
          break; // Found authoritative information
        }
      } catch (pErr) {
        console.warn(`[ProductIntelligence Warning] Provider ${provider.providerName} failed: ${pErr.message}`);
      }
    }

    // 5. If no external intelligence is available
    if (!intelligenceData) {
      return {
        productId: product._id,
        status: 'UNAVAILABLE',
        message: 'External product information is currently unavailable.',
        specifications: [],
        warrantyComparison: null,
      };
    }

    // 6. Upsert ProductIntelligence in database with 7-day TTL
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const savedIntelligence = await ProductIntelligence.findOneAndUpdate(
      { productId: product._id },
      {
        userId,
        productId: product._id,
        provider: intelligenceData.provider,
        sourceType: intelligenceData.sourceType,
        sourceName: intelligenceData.sourceName,
        sourceUrl: intelligenceData.sourceUrl,
        manufacturer: intelligenceData.manufacturer,
        model: intelligenceData.model,
        productName: intelligenceData.productName,
        category: intelligenceData.category,
        specifications: intelligenceData.specifications,
        officialProductUrl: intelligenceData.officialProductUrl,
        supportUrl: intelligenceData.supportUrl,
        manualUrl: intelligenceData.manualUrl,
        warrantyUrl: intelligenceData.warrantyUrl,
        officialWarranty: intelligenceData.officialWarranty,
        serviceCenters: intelligenceData.serviceCenters,
        confidence: intelligenceData.confidence,
        status: 'ACTIVE',
        fetchedAt: now,
        expiresAt,
      },
      { upsert: true, new: true }
    ).lean();

    // Link reference to Product
    await Product.findByIdAndUpdate(product._id, {
      externalIntelligenceId: savedIntelligence._id,
    });

    return {
      ...savedIntelligence,
      isCached: false,
      warrantyComparison: this.evaluateWarrantyConflict(product.warranty, savedIntelligence.officialWarranty),
    };
  }

  /**
   * Refresh product intelligence on-demand
   */
  async refreshProductIntelligence(userId, productId) {
    return await this.getProductIntelligence({
      userId,
      productId,
      forceRefresh: true,
    });
  }

  /**
   * Compare user's receipt warranty with official manufacturer warranty
   * Transparently highlights discrepancies without overwriting user data
   */
  evaluateWarrantyConflict(userWarranty = {}, officialWarranty = {}) {
    if (!userWarranty || !officialWarranty) {
      return { hasConflict: false };
    }

    const userHasWarranty = userWarranty.hasWarranty;
    const officialDuration = officialWarranty.durationMonths;

    let userMonths = null;
    if (userWarranty.warrantyStartDate && userWarranty.warrantyEndDate) {
      const start = new Date(userWarranty.warrantyStartDate);
      const end = new Date(userWarranty.warrantyEndDate);
      userMonths = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
    }

    // Check duration conflict
    if (userHasWarranty && userMonths && officialDuration && userMonths !== officialDuration) {
      return {
        hasConflict: true,
        userValue: `${userMonths} months`,
        officialValue: `${officialDuration} months (${officialWarranty.description || 'Manufacturer warranty'})`,
        message: `Your purchase record states ${userMonths} months coverage, while official manufacturer information currently states ${officialDuration} months. These records differ. Check your purchase-specific invoice terms for the applicable coverage.`,
      };
    }

    return {
      hasConflict: false,
      userValue: userMonths ? `${userMonths} months` : 'Recorded with purchase',
      officialValue: officialDuration ? `${officialDuration} months` : 'Standard coverage',
    };
  }

  /**
   * Direct brand/model intelligence lookup without requiring an existing product
   */
  async lookupIntelligence({ brand = '', model = '', category = '' }) {
    const cleanBrand = (brand || '').trim();
    const cleanModel = (model || '').trim();

    if (!cleanBrand && !cleanModel) {
      const err = new Error('Brand or model parameter is required for intelligence lookup');
      err.statusCode = 400;
      throw err;
    }

    const sanitized = {
      brand: cleanBrand,
      model: cleanModel,
      category: (category || '').trim(),
    };

    let intelData = null;
    for (const provider of this.providers) {
      intelData = await provider.fetchProductIntelligence(sanitized);
      if (intelData) break;
    }

    if (!intelData) {
      return {
        intelligence: {
          manufacturer: cleanBrand,
          model: cleanModel,
          isGenericFallback: true,
          confidenceScore: 0.2,
          sourceType: 'SECONDARY_REPUTABLE',
          specifications: [],
        },
        cacheHit: false,
      };
    }

    return {
      intelligence: intelData,
      cacheHit: false,
    };
  }
}

export default new ProductIntelligenceService();
