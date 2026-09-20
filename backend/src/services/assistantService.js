import User from '../models/User.js';
import Product from '../models/Product.js';
import Document from '../models/Document.js';
import OwnershipEvent from '../models/OwnershipEvent.js';
import OwnershipTransfer from '../models/OwnershipTransfer.js';
import OwnershipHistory from '../models/OwnershipHistory.js';
import Conversation from '../models/Conversation.js';
import ServiceRecord from '../models/ServiceRecord.js';
import WarrantyClaim from '../models/WarrantyClaim.js';
import Expense from '../models/Expense.js';
import Alert from '../models/Alert.js';
import EmailReceipt from '../models/EmailReceipt.js';
import webSearchService, { CONSUMER_GRIEVANCE_RESOURCES } from './webSearchService.js';
import lifecycleService from './lifecycleService.js';
import productIntelligenceService from './intelligence/productIntelligenceService.js';
import serviceRecordService from './serviceRecordService.js';
import warrantyClaimService from './warrantyClaimService.js';
import serviceCenterService from './serviceCenterService.js';
import passportService from './passportService.js';
import { formatINR, formatDateIN } from '../utils/formatters.js';
import { calculateWarrantyStatus, calculateReturnStatus } from '../utils/statusCalculator.js';
import env from '../config/env.js';

const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest'];

/**
 * Call Gemini model cascade for grounded semantic synthesis
 */
async function callGeminiAssistant({ apiKey, systemPrompt, userMessage, contextData }) {
  if (!apiKey || !apiKey.trim()) return null;
  const timeoutMs = 12000;
  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\nAUTHENTICATED USER LIFERECEIPT RECORDS & ANALYTICS:\n${JSON.stringify(contextData, null, 2)}\n\nUSER QUESTION:\n${userMessage}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1200,
          },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err) {
      console.warn(`[Gemini Assistant Warning] Model ${model} failed: ${err.message}`);
    }
  }
  return null;
}

/**
 * LIFERECEIPT LifeReceipt-Wide AI Ownership Assistant Service
 * Comprehensive intelligence layer analyzing authenticated user products, purchases,
 * warranties, return periods, service records, claims, documents, expenses, and transfers.
 */
class AssistantService {
  /**
   * Main conversational pipeline
   */
  async processUserMessage({ userId, message, sessionId, productId }) {
    if (!userId) {
      const err = new Error('User authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!message || !message.trim()) {
      const err = new Error('Message cannot be empty');
      err.statusCode = 400;
      throw err;
    }

    const trimmedMsg = message.trim();
    const effectiveSessionId = sessionId || `session_${Date.now()}`;

    // 1. Load active conversation or create new
    let conversation = await Conversation.findOne({
      userId,
      sessionId: effectiveSessionId,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        userId,
        sessionId: effectiveSessionId,
        title: trimmedMsg.substring(0, 40) + (trimmedMsg.length > 40 ? '...' : ''),
        messages: [],
      });
    }

    // 2. Off-Topic Query Detection (Polite Redirection)
    if (this.isOffTopic(trimmedMsg)) {
      const redirectContent =
        'I can help with your LifeReceipt products, purchases, warranties, receipts, services, ownership history, and related information. What would you like to know about your products?';
      const redirectResponse = {
        role: 'assistant',
        content: redirectContent,
        productContext: null,
        sources: [],
        conflicts: [],
        webSearched: false,
        retrievalDate: null,
      };

      conversation.messages.push({ role: 'user', content: trimmedMsg });
      conversation.messages.push(redirectResponse);
      await conversation.save();

      return {
        sessionId: effectiveSessionId,
        response: redirectContent,
        productContext: null,
        sources: [],
        conflicts: [],
        webSearched: false,
        retrievalDate: null,
      };
    }

    // 3. Multi-Module Scoped Data Retrieval (strictly user-isolated)
    const currentUser = await User.findById(userId).lean();
    const userEmail = (currentUser?.email || '').toLowerCase();

    const [
      userProducts,
      userDocuments,
      userServiceRecords,
      userWarrantyClaims,
      userExpenses,
      userTransfers,
      userEmailReceipts,
      userAlerts,
    ] = await Promise.all([
      Product.find({ userId }).sort({ purchaseDate: -1, createdAt: -1 }).lean(),
      Document.find({ userId }).sort({ createdAt: -1 }).lean(),
      ServiceRecord.find({ userId }).sort({ serviceDate: -1, reportedDate: -1 }).lean(),
      WarrantyClaim.find({ userId }).sort({ claimDate: -1, createdAt: -1 }).lean(),
      Expense.find({ userId }).sort({ expenseDate: -1 }).lean(),
      OwnershipTransfer.find({
        $or: [{ fromUserId: userId }, { recipientEmail: userEmail }],
      })
        .populate('productId fromUserId')
        .sort({ createdAt: -1 })
        .lean(),
      EmailReceipt.find({ userId }).sort({ receivedAt: -1 }).lean(),
      Alert.find({ userId }).sort({ createdAt: -1 }).lean(),
    ]);

    // 4. Compute Dynamic Ownership Analytics (using dynamic current date)
    const now = new Date();
    const analytics = this.computeAnalytics({
      products: userProducts,
      documents: userDocuments,
      serviceRecords: userServiceRecords,
      warrantyClaims: userWarrantyClaims,
      expenses: userExpenses,
      transfers: userTransfers,
      emailReceipts: userEmailReceipts,
      alerts: userAlerts,
      now,
    });

    // 5. Resolve Product Context (specific single item vs aggregate account-wide)
    const resolution = this.resolveProductContext({
      message: trimmedMsg,
      userProducts,
      conversationMessages: conversation.messages,
      explicitProductId: productId,
    });

    // Ambiguity handling if user named a generic product (e.g. "my laptop") and owns multiple
    if (resolution.isAmbiguous) {
      const clarifyResponse = {
        role: 'assistant',
        content: this.formatAmbiguityMessage(resolution.matchedProducts, resolution.searchTerm),
        productContext: null,
        sources: [
          {
            type: 'DATABASE',
            title: 'LifeReceipt Product Catalog',
            detail: `Found ${resolution.matchedProducts.length} matching products in your account`,
            verified: true,
          },
        ],
        conflicts: [],
        webSearched: false,
        retrievalDate: null,
      };

      conversation.messages.push({ role: 'user', content: trimmedMsg });
      conversation.messages.push(clarifyResponse);
      await conversation.save();

      return {
        sessionId: effectiveSessionId,
        response: clarifyResponse.content,
        productContext: null,
        sources: clarifyResponse.sources,
        conflicts: [],
        webSearched: false,
        retrievalDate: null,
      };
    }

    const resolvedProduct = resolution.product;

    // 6. Gather product-specific documents and timeline if resolved
    let productDocuments = [];
    let productTimelineEvents = [];
    if (resolvedProduct) {
      productDocuments = userDocuments.filter(
        (d) => d.productId && d.productId.toString() === resolvedProduct._id.toString()
      );
      productTimelineEvents = await OwnershipEvent.find({
        userId,
        productId: resolvedProduct._id,
      })
        .sort({ eventDate: -1 })
        .lean();
    } else {
      productDocuments = userDocuments.slice(0, 10);
    }

    // 7. Detect Intent & Web Search requirement
    const intentAnalysis = this.analyzeIntentAndSufficiency({
      message: trimmedMsg,
      product: resolvedProduct,
      userProducts,
      documents: productDocuments,
      timelineEvents: productTimelineEvents,
    });

    let webSearchResults = null;
    let webSearched = false;
    let retrievalDate = null;

    if (intentAnalysis.needsWebSearch) {
      const searchOptions = {
        brand: resolvedProduct?.brand || intentAnalysis.detectedBrand || '',
        city: intentAnalysis.detectedCity || '',
        category: resolvedProduct?.category || '',
      };

      const searchQuery = intentAnalysis.webSearchQuery;
      webSearchResults = await webSearchService.searchWeb(searchQuery, searchOptions);
      webSearched = true;
      retrievalDate = webSearchResults.retrievalDate;
    }

    // 8. Synthesize LifeReceipt-Wide Grounded Answer
    const synthesis = await this.synthesizeLifeReceiptAnswer({
      userMessage: trimmedMsg,
      product: resolvedProduct,
      userProducts,
      documents: userDocuments,
      productDocuments,
      timelineEvents: productTimelineEvents,
      serviceRecords: userServiceRecords,
      warrantyClaims: userWarrantyClaims,
      expenses: userExpenses,
      transfers: userTransfers,
      emailReceipts: userEmailReceipts,
      alerts: userAlerts,
      analytics,
      intentAnalysis,
      webSearchResults,
      userId,
      userEmail,
    });

    // 9. Persist messages to Conversation History
    const userMessageEntry = {
      role: 'user',
      content: trimmedMsg,
      productContext: resolvedProduct
        ? {
            productId: resolvedProduct._id,
            productName: resolvedProduct.productName,
            brand: resolvedProduct.brand,
            model: resolvedProduct.model,
          }
        : null,
    };

    const assistantMessageEntry = {
      role: 'assistant',
      content: synthesis.answer,
      productContext: resolvedProduct
        ? {
            productId: resolvedProduct._id,
            productName: resolvedProduct.productName,
            brand: resolvedProduct.brand,
            model: resolvedProduct.model,
          }
        : null,
      sources: synthesis.sources,
      conflicts: synthesis.conflicts,
      webSearched,
      retrievalDate,
    };

    conversation.messages.push(userMessageEntry);
    conversation.messages.push(assistantMessageEntry);
    await conversation.save();

    return {
      sessionId: effectiveSessionId,
      response: synthesis.answer,
      productContext: resolvedProduct
        ? {
            _id: resolvedProduct._id,
            productName: resolvedProduct.productName,
            brand: resolvedProduct.brand,
            model: resolvedProduct.model,
            category: resolvedProduct.category,
          }
        : null,
      sources: synthesis.sources,
      conflicts: synthesis.conflicts,
      webSearched,
      retrievalDate,
    };
  }

  /**
   * Determine if user message is off-topic (general trivia, poems, unrelated chit-chat)
   */
  isOffTopic(message) {
    const lower = (message || '').toLowerCase().trim();

    // Explicit non-LifeReceipt creative tasks & jokes
    const isExplicitCreative =
      /^write a poem/i.test(lower) ||
      /^tell me a joke/i.test(lower) ||
      /^write a story/i.test(lower) ||
      /^write code in/i.test(lower) ||
      /^solve \d+/i.test(lower);

    if (isExplicitCreative) {
      return true;
    }

    // Explicit trivia patterns
    const offTopicPatterns = [
      /^what is the capital of/i,
      /^who is the president of/i,
      /^who is the prime minister/i,
      /^who won the/i,
      /^how tall is/i,
      /^what is the weather/i,
      /^translate .* to/i,
      /^who directed/i,
      /^who played .* in/i,
    ];

    for (const pattern of offTopicPatterns) {
      if (pattern.test(lower)) {
        return true;
      }
    }

    // If query asks about user's personal items or records ("my ...", "mine", "i own", "i bought"), it is definitely on-topic
    if (lower.includes('my ') || lower.includes('mine') || lower.includes('i own') || lower.includes('i bought') || lower.includes('i purchased')) {
      return false;
    }

    // Domain keywords that confirm query is relevant to LifeReceipt
    const domainKeywords = [
      'product', 'item', 'device', 'purchase', 'buy', 'bought', 'cost', 'spend', 'spent',
      'price', 'warranty', 'guarantee', 'expire', 'expiry', 'validity', 'coverage',
      'receipt', 'invoice', 'bill', 'document', 'ocr', 'serial', 'model', 'brand',
      'return', 'refund', 'service', 'repair', 'fix', 'defect', 'maintenance',
      'claim', 'center', 'centre', 'support', 'care', 'helpline', 'grievance',
      'transfer', 'ownership', 'timeline', 'passport', 'alert', 'notification',
      'email', 'gmail', 'catalog', 'inventory', 'asset', 'expense', 'seller', 'merchant',
      'imei', 'spec', 'specifications', 'manual', 'tco', 'ledger',
      'laptop', 'phone', 'mobile', 'tv', 'television', 'headphone', 'earphone', 'camera',
      'ac', 'refrigerator', 'fridge', 'appliances', 'electronics', 'furniture', 'watch',
      'avirox', 'bird', 'house', 'nest', 'boat', 'rockerz',
      'amazon', 'flipkart', 'croma', 'reliance', 'apple', 'samsung', 'hp', 'sony', 'lenovo', 'dell',
      'how many', 'how much', 'what do i own', 'list', 'show', 'tell me', 'which', 'mine',
      'expensive', 'cheapest', 'highest', 'lowest', 'annual', 'history', 'checklist'
    ];

    const hasDomainKeyword = domainKeywords.some((kw) => lower.includes(kw));
    if (!hasDomainKeyword) {
      if (
        lower.startsWith('who is ') ||
        lower.startsWith('what is ') ||
        lower.startsWith('where is ') ||
        lower.startsWith('why is ') ||
        lower.startsWith('can you write ') ||
        lower.startsWith('tell me about the history of ')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Pre-compute comprehensive ownership analytics with dynamic current date
   */
  computeAnalytics({ products, documents, serviceRecords, warrantyClaims, expenses, transfers, emailReceipts, alerts, now }) {
    const expiredWarranties = [];
    const activeWarranties = [];
    const expiringSoonWarranties = [];
    const missingWarranties = [];

    for (const p of products) {
      const hasW = Boolean(p.warranty?.hasWarranty);
      const end = p.warranty?.warrantyEndDate ? new Date(p.warranty.warrantyEndDate) : null;
      if (hasW && end && !isNaN(end.getTime())) {
        const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const record = {
          productId: p._id,
          productName: p.productName,
          brand: p.brand || '',
          model: p.model || '',
          category: p.category || 'General',
          purchaseDate: p.purchaseDate,
          purchasePrice: p.purchasePrice,
          warrantyEndDate: end,
          daysRemaining: diffDays,
          provider: p.warranty?.warrantyProvider || 'Manufacturer',
        };
        if (diffDays < 0) {
          expiredWarranties.push(record);
        } else {
          activeWarranties.push(record);
          if (diffDays <= 30) {
            expiringSoonWarranties.push(record);
          }
        }
      } else {
        missingWarranties.push({
          productId: p._id,
          productName: p.productName,
          brand: p.brand || '',
          model: p.model || '',
          hasWarranty: hasW,
        });
      }
    }

    const activeReturns = [];
    const expiredReturns = [];
    for (const p of products) {
      const isEligible = Boolean(p.returnInfo?.returnEligible);
      const retEnd = p.returnInfo?.returnEndDate ? new Date(p.returnInfo.returnEndDate) : null;
      if (isEligible && retEnd && !isNaN(retEnd.getTime())) {
        const diffDays = Math.ceil((retEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const record = {
          productId: p._id,
          productName: p.productName,
          brand: p.brand || '',
          returnEndDate: retEnd,
          daysRemaining: diffDays,
          policyNotes: p.returnInfo?.returnPolicyNotes || '',
        };
        if (diffDays >= 0) {
          activeReturns.push(record);
        } else {
          expiredReturns.push(record);
        }
      }
    }

    let totalSpend = 0;
    const categorySpend = {};
    let highestProduct = null;
    let lowestProduct = null;
    const thisYearPurchases = [];
    const merchantPurchases = {};
    const currentYear = now.getFullYear();

    for (const p of products) {
      const price = Number(p.purchasePrice) || 0;
      totalSpend += price;

      const cat = p.category || 'Other';
      categorySpend[cat] = (categorySpend[cat] || 0) + price;

      if (!highestProduct || price > (Number(highestProduct.purchasePrice) || 0)) {
        highestProduct = p;
      }
      if (price > 0 && (!lowestProduct || price < (Number(lowestProduct.purchasePrice) || Infinity))) {
        lowestProduct = p;
      }

      if (p.purchaseDate) {
        const pDate = new Date(p.purchaseDate);
        if (!isNaN(pDate.getTime()) && pDate.getFullYear() === currentYear) {
          thisYearPurchases.push(p);
        }
      }

      if (p.sellerName) {
        const seller = p.sellerName.trim();
        merchantPurchases[seller] = (merchantPurchases[seller] || 0) + 1;
      }
    }

    let totalRepairSpend = 0;
    for (const s of serviceRecords) {
      totalRepairSpend += Number(s.actualCost || s.estimatedCost || 0);
    }
    for (const e of expenses) {
      if (e.expenseType === 'REPAIR') {
        // avoid double counting if synced
      }
    }

    return {
      now,
      currentYear,
      totalProducts: products.length,
      warranties: {
        expired: expiredWarranties,
        active: activeWarranties,
        expiringSoon: expiringSoonWarranties,
        missing: missingWarranties,
      },
      returns: {
        active: activeReturns,
        expired: expiredReturns,
      },
      finances: {
        totalSpend,
        categorySpend,
        highestProduct,
        lowestProduct,
        thisYearPurchases,
        merchantPurchases,
        totalRepairSpend,
      },
      services: {
        totalRecords: serviceRecords.length,
        repairSpend: totalRepairSpend,
        records: serviceRecords,
      },
      claims: warrantyClaims,
      documents,
      transfers,
      emailReceipts,
      alerts,
    };
  }

  /**
   * Resolves whether the user message targets a specific product
   */
  resolveProductContext({ message, userProducts, conversationMessages = [], explicitProductId }) {
    if (!userProducts || userProducts.length === 0) {
      return { product: null, isAmbiguous: false, matchedProducts: [] };
    }

    if (explicitProductId) {
      const found = userProducts.find((p) => p._id.toString() === explicitProductId.toString());
      if (found) return { product: found, isAmbiguous: false, matchedProducts: [found] };
    }

    const lower = message.toLowerCase();

    // Broad account-wide questions must NOT force single product context
    const isBroadQuestion =
      lower.includes('what products do i own') ||
      lower.includes('list my products') ||
      lower.includes('show all my products') ||
      lower.includes('how many products') ||
      lower.includes('how much did i spend') ||
      lower.includes('how much have i spent') ||
      lower.includes('total spend') ||
      lower.includes('which of my products') ||
      lower.includes('what products of mine') ||
      lower.includes('which products') ||
      lower.includes('which warranties') ||
      lower.includes('warranties expire') ||
      lower.includes('purchase history') ||
      lower.includes('purchased this year') ||
      lower.includes('most expensive');

    if (isBroadQuestion) {
      return { product: null, isAmbiguous: false, matchedProducts: userProducts, isCatalogQuery: true };
    }

    // Match candidates by brand, model, product name, or category keywords
    const matches = [];
    for (const p of userProducts) {
      const pName = (p.productName || '').toLowerCase();
      const pBrand = (p.brand || '').toLowerCase();
      const pModel = (p.model || '').toLowerCase();
      const pCat = (p.category || '').toLowerCase();

      let matched = false;
      if (pBrand && lower.includes(pBrand)) matched = true;
      if (pModel && lower.includes(pModel)) matched = true;
      if (pName && lower.includes(pName)) matched = true;

      // Category / device aliases
      if (pCat.includes('computing') || pName.includes('laptop') || pName.includes('macbook') || pModel.includes('laptop')) {
        if (lower.includes('laptop') || lower.includes('notebook') || lower.includes('computer')) matched = true;
      }
      if (pName.includes('phone') || pModel.includes('phone') || pName.includes('iphone') || pName.includes('galaxy') || pName.includes('pixel')) {
        if (lower.includes('phone') || lower.includes('mobile') || lower.includes('smartphone')) matched = true;
      }
      if (pName.includes('headphone') || pName.includes('wh-1000') || pName.includes('airpods') || pName.includes('earbuds') || pName.includes('earphones') || pName.includes('rockerz')) {
        if (lower.includes('headphone') || lower.includes('earphone') || lower.includes('audio') || lower.includes('earbuds')) matched = true;
      }
      if (pName.includes('tv') || pName.includes('television') || pName.includes('bravia')) {
        if (lower.includes('tv') || lower.includes('television')) matched = true;
      }
      if (pName.includes('bird') || pName.includes('nest') || pName.includes('avirox')) {
        if (lower.includes('bird') || lower.includes('nest') || lower.includes('avirox')) matched = true;
      }

      if (matched && !matches.some((m) => m._id.toString() === p._id.toString())) {
        matches.push(p);
      }
    }

    if (matches.length > 1) {
      const exactBrandMatches = matches.filter((p) => p.brand && lower.includes(p.brand.toLowerCase()));
      if (exactBrandMatches.length === 1) {
        return { product: exactBrandMatches[0], isAmbiguous: false, matchedProducts: exactBrandMatches };
      }
      return {
        product: null,
        isAmbiguous: true,
        matchedProducts: matches,
        searchTerm: this.extractSearchTerm(lower),
      };
    }

    if (matches.length === 1) {
      return { product: matches[0], isAmbiguous: false, matchedProducts: matches };
    }

    // Context memory from previous turn if question uses anaphoric reference (e.g. "it", "this device")
    if (conversationMessages.length > 0 && (lower.includes('it') || lower.includes('this') || lower.includes('the device') || lower.includes('its'))) {
      for (let i = conversationMessages.length - 1; i >= 0; i--) {
        const prev = conversationMessages[i];
        if (prev.productContext && prev.productContext.productId) {
          const remembered = userProducts.find(
            (p) => p._id.toString() === prev.productContext.productId.toString()
          );
          if (remembered) {
            return { product: remembered, isAmbiguous: false, matchedProducts: [remembered] };
          }
        }
      }
    }

    return { product: null, isAmbiguous: false, matchedProducts: [] };
  }

  extractSearchTerm(lower) {
    if (lower.includes('phone') || lower.includes('mobile')) return 'phone';
    if (lower.includes('laptop') || lower.includes('computer')) return 'laptop';
    if (lower.includes('headphone') || lower.includes('earphone')) return 'headphone';
    if (lower.includes('tv') || lower.includes('television')) return 'TV';
    return 'product';
  }

  formatAmbiguityMessage(matchedProducts, term = 'product') {
    let msg = `I found ${matchedProducts.length} ${term}s in your LifeReceipt account. Which one do you mean?\n\n`;
    matchedProducts.forEach((p, idx) => {
      const brandStr = p.brand ? `${p.brand} ` : '';
      const modelStr = p.model ? ` (${p.model})` : '';
      const dateStr = p.purchaseDate ? ` • Purchased on ${formatDateIN(p.purchaseDate)}` : '';
      const snStr = p.serialNumber ? ` • S/N: ${p.serialNumber}` : '';
      msg += `${idx + 1}. **${brandStr}${p.productName}**${modelStr}${dateStr}${snStr}\n`;
    });
    msg += `\nPlease reply with the brand or model you would like assistance with.`;
    return msg;
  }

  /**
   * Classify user intent & determine web search requirement
   */
  analyzeIntentAndSufficiency({ message, product, userProducts, documents, timelineEvents }) {
    const lower = message.toLowerCase();

    const cities = ['chennai', 'mumbai', 'delhi', 'bengaluru', 'bangalore', 'hyderabad', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'kochi'];
    let detectedCity = '';
    for (const city of cities) {
      if (lower.includes(city)) {
        detectedCity = city.charAt(0).toUpperCase() + city.slice(1);
        break;
      }
    }

    const isServiceCenterOrClaim =
      lower.includes('where can i claim warranty') ||
      lower.includes('service center') ||
      lower.includes('service-center') ||
      lower.includes('find the official service center') ||
      lower.includes('official service center') ||
      lower.includes('where to fix');

    const isGrievanceOrDispute =
      lower.includes('refused warranty') ||
      lower.includes('denied warranty') ||
      lower.includes('consumer complaint') ||
      lower.includes('consumer court') ||
      lower.includes('grievance') ||
      lower.includes('fraud');

    let needsWebSearch = false;
    let webSearchQuery = '';

    if (isServiceCenterOrClaim && product) {
      needsWebSearch = true;
      const brandName = product.brand || 'Manufacturer';
      const cityTerm = detectedCity ? ` in ${detectedCity}` : ' in India';
      webSearchQuery = `${brandName} official warranty service center${cityTerm}`;
    }

    return {
      isServiceCenterOrClaim,
      isGrievanceOrDispute,
      detectedCity,
      needsWebSearch,
      webSearchQuery,
    };
  }

  /**
   * Synthesize Grounded LifeReceipt-Wide Intelligence Answer
   */
  async synthesizeLifeReceiptAnswer({
    userMessage,
    product,
    userProducts,
    documents,
    productDocuments,
    timelineEvents,
    serviceRecords,
    warrantyClaims,
    expenses,
    transfers,
    emailReceipts,
    alerts,
    analytics,
    intentAnalysis,
    webSearchResults,
    userId,
    userEmail,
  }) {
    const sources = [];
    const conflicts = [];
    const lower = userMessage.toLowerCase();

    // 1. Check Specialized Grievance Resource
    if (intentAnalysis.isGrievanceOrDispute) {
      sources.push({
        type: 'WEB_GOVERNMENT',
        title: 'National Consumer Helpline (NCH)',
        url: CONSUMER_GRIEVANCE_RESOURCES.nationalConsumerHelpline.url,
        detail: 'Statutory dispute escalation mechanism',
        verified: true,
      });

      let ans = `### Consumer Grievance Escalation Guidance\n\n`;
      ans += `If an authorized service center or manufacturer wrongfully denies warranty coverage, delays repairs beyond reasonable timelines, or provides substandard support, you have statutory remedies under Indian Consumer Law:\n\n`;
      ans += `• **Helpline:** National Consumer Helpline (NCH) Toll Free: **1915**\n`;
      ans += `• **SMS Helpline:** Send SMS to **8800001915**\n`;
      ans += `• **Online Portal:** [consumerhelpline.gov.in](${CONSUMER_GRIEVANCE_RESOURCES.nationalConsumerHelpline.url})\n`;
      ans += `• **E-Filing Portal:** [e-Daakhil Online Dispute Filing](${CONSUMER_GRIEVANCE_RESOURCES.nationalConsumerHelpline.portalUrl})\n\n`;
      ans += `*Please note: The National Consumer Helpline is an official government grievance portal, not the manufacturer's warranty repair desk.*`;

      return { answer: ans, sources, conflicts };
    }

    // 2. Check Service Center Search
    if (intentAnalysis.isServiceCenterOrClaim && product) {
      const brand = product.brand || 'Manufacturer';
      const city = intentAnalysis.detectedCity || 'Chennai';
      const verifiedCenters = serviceCenterService.getServiceCenters({ brand, city });
      const wStatus = calculateWarrantyStatus(product.warranty);

      sources.push({
        type: 'DATABASE',
        title: `LifeReceipt Record (${product.productName})`,
        detail: `Serial: ${product.serialNumber || 'N/A'}, Expiry: ${product.warranty?.warrantyEndDate ? formatDateIN(product.warranty.warrantyEndDate) : 'N/A'}`,
        verified: true,
      });

      let ans = `### Warranty Claim & Service Center Information\n\n`;
      ans += `**Product:** ${brand} ${product.productName} ${product.model ? `(${product.model})` : ''}\n`;
      if (product.serialNumber) {
        ans += `**Serial Number (S/N):** ${product.serialNumber}\n`;
      }
      ans += `**Warranty Status:** ${wStatus.label}${product.warranty?.warrantyEndDate ? ` (Valid until ${formatDateIN(product.warranty.warrantyEndDate)})` : ''}\n\n`;

      if (verifiedCenters.length > 0) {
        const topCenter = verifiedCenters[0];
        sources.push({
          type: 'SERVICE_CENTER',
          title: `${brand} Authorized Service Network`,
          detail: `${topCenter.name} (${topCenter.city})`,
          verified: true,
        });

        ans += `#### Verified Authorized Service Center\n`;
        ans += `• **Authorized Provider:** **${topCenter.name}**\n`;
        ans += `• **Address:** ${topCenter.address}, ${topCenter.city}, ${topCenter.state} - ${topCenter.postalCode}\n`;
        ans += `• **Phone / Helpline:** ${topCenter.phone}\n`;
        if (topCenter.email) ans += `• **Email Support:** ${topCenter.email}\n`;
        if (topCenter.openingHours) ans += `• **Operating Hours:** ${topCenter.openingHours}\n`;
        if (topCenter.website) ans += `• **Official Portal:** [${brand} Support](${topCenter.website})\n`;
        ans += `\n*Verified from authoritative ${brand} service network directory.*\n\n`;
      }

      ans += `#### Documents & Items to Carry for Warranty Claim:\n`;
      ans += `1. **Purchase Invoice:** Printed or digital copy of your purchase receipt.\n`;
      ans += `2. **Product & Accessories:** Device with original power adapter/cables.\n`;
      ans += `3. **Serial Number Proof:** Physical serial label intact on device (S/N: ${product.serialNumber || 'as per invoice'}).\n`;
      ans += `4. **Photo ID:** Government-issued identity proof for service ticket generation.\n`;

      return { answer: ans, sources, conflicts };
    }

    // 3. Try Gemini Semantic Synthesis First
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim()) {
      const systemPrompt = `You are the LifeReceipt-Wide AI Ownership Assistant for the LifeReceipt digital ownership platform.
Operating Region: India.
Primary Currency: Indian Rupee (INR, symbol: ₹, locale: en-IN).
Today's Date: ${analytics.now.toISOString().split('T')[0]}.

CRITICAL GUIDELINES:
1. Ground every answer STRICTLY in the provided authentic LifeReceipt records and analytics.
2. NEVER hallucinate or invent products, prices, dates, serial numbers, sellers, receipts, service records, or warranties not in the data.
3. If a specific detail (e.g. serial number, receipt, warranty expiration date) is NOT recorded, explicitly state that it is unavailable in the user's saved records.
4. STRICT INR CURRENCY RULE: All monetary amounts MUST use Indian Rupee formatting (e.g. ₹72,999, ₹1,24,999, ₹261). NEVER display $, USD, or the word "Dollar".
5. Answer naturally, clearly, and helpfully using GitHub Flavored Markdown (bullet points, bold text).
6. Provide a comprehensive, accurate response addressing the user's question directly.`;

      const contextData = {
        currentDate: analytics.now.toISOString().split('T')[0],
        totalProductsCount: analytics.totalProducts,
        totalSpendFormatted: formatINR(analytics.finances.totalSpend),
        expiredWarranties: analytics.warranties.expired.map((w) => ({
          productName: w.productName,
          brand: w.brand,
          model: w.model,
          expiredOn: formatDateIN(w.warrantyEndDate),
          daysAgoExpired: Math.abs(w.daysRemaining),
        })),
        activeWarranties: analytics.warranties.active.map((w) => ({
          productName: w.productName,
          brand: w.brand,
          model: w.model,
          expiresOn: formatDateIN(w.warrantyEndDate),
          daysRemaining: w.daysRemaining,
        })),
        expiringSoonWarranties: analytics.warranties.expiringSoon.map((w) => ({
          productName: w.productName,
          brand: w.brand,
          expiresOn: formatDateIN(w.warrantyEndDate),
          daysRemaining: w.daysRemaining,
        })),
        missingWarranties: analytics.warranties.missing.map((w) => ({
          productName: w.productName,
          brand: w.brand,
        })),
        activeReturns: analytics.returns.active.map((r) => ({
          productName: r.productName,
          returnDeadline: formatDateIN(r.returnEndDate),
          daysRemaining: r.daysRemaining,
        })),
        categorySpend: analytics.finances.categorySpend,
        highestPricedProduct: analytics.finances.highestProduct
          ? {
              productName: analytics.finances.highestProduct.productName,
              brand: analytics.finances.highestProduct.brand,
              price: formatINR(analytics.finances.highestProduct.purchasePrice),
            }
          : null,
        thisYearPurchases: analytics.finances.thisYearPurchases.map((p) => ({
          productName: p.productName,
          price: formatINR(p.purchasePrice),
          purchaseDate: formatDateIN(p.purchaseDate),
          seller: p.sellerName,
        })),
        allProductsList: userProducts.map((p) => ({
          id: p._id,
          name: p.productName,
          brand: p.brand,
          model: p.model,
          category: p.category,
          price: formatINR(p.purchasePrice),
          purchaseDate: formatDateIN(p.purchaseDate),
          seller: p.sellerName,
          serialNumber: p.serialNumber || 'Unavailable',
          warrantyStatus: calculateWarrantyStatus(p.warranty).label,
        })),
        serviceHistorySummary: {
          totalServiceRecords: serviceRecords.length,
          totalRepairSpendFormatted: formatINR(analytics.services.repairSpend),
          records: serviceRecords.slice(0, 5).map((s) => ({
            issue: s.issueTitle,
            serviceType: s.serviceType,
            status: s.status,
            cost: formatINR(s.actualCost || s.estimatedCost || 0),
            date: formatDateIN(s.serviceDate || s.reportedDate),
          })),
        },
        resolvedProduct: product
          ? {
              name: product.productName,
              brand: product.brand,
              model: product.model,
              category: product.category,
              price: formatINR(product.purchasePrice),
              purchaseDate: formatDateIN(product.purchaseDate),
              seller: product.sellerName,
              serialNumber: product.serialNumber || 'Unavailable',
              warrantyStatus: calculateWarrantyStatus(product.warranty).label,
              warrantyExpiry: product.warranty?.warrantyEndDate ? formatDateIN(product.warranty.warrantyEndDate) : 'Unavailable',
              returnStatus: calculateReturnStatus(product.returnInfo).label,
              documentsCount: productDocuments.length,
            }
          : null,
      };

      try {
        const geminiText = await callGeminiAssistant({
          apiKey: env.GEMINI_API_KEY,
          systemPrompt,
          userMessage,
          contextData,
        });

        if (geminiText && geminiText.trim().length > 15) {
          // Strict zero-dollar enforcement on output
          const sanitizedAnswer = geminiText
            .replace(/\$(\d+[\d,.]*)/g, '₹$1')
            .replace(/\bUSD\b/g, 'INR')
            .replace(/\bDollars?\b/g, 'Rupees');

          sources.push({
            type: 'DATABASE',
            title: 'LifeReceipt Asset Registry',
            detail: `Verified across ${userProducts.length} product records and ownership ledgers`,
            verified: true,
          });

          if (product) {
            sources.push({
              type: 'DATABASE',
              title: `LifeReceipt Record (${product.productName})`,
              detail: `Product metadata and warranty status`,
              verified: true,
            });
          }

          if (serviceRecords.length > 0 && (lower.includes('service') || lower.includes('repair'))) {
            sources.push({
              type: 'SERVICE_RECORD',
              title: 'LifeReceipt Service Ledger',
              detail: `${serviceRecords.length} service events recorded`,
              verified: true,
            });
          }

          if (documents.length > 0 && (lower.includes('receipt') || lower.includes('invoice') || lower.includes('document'))) {
            sources.push({
              type: 'DOCUMENT',
              title: 'LifeReceipt Document Vault',
              detail: `${documents.length} verified documents attached`,
              verified: true,
            });
          }

          return { answer: sanitizedAnswer, sources, conflicts };
        }
      } catch (geminiErr) {
        console.warn('[Gemini Assistant Error, falling back to deterministic synthesis]', geminiErr.message);
      }
    }

    // 4. Deterministic Grounded Synthesizer (100% Guaranteed Reliability Fallback)
    return this.synthesizeDeterministicAnswer({
      lower,
      product,
      userProducts,
      documents,
      productDocuments,
      serviceRecords,
      warrantyClaims,
      expenses,
      transfers,
      emailReceipts,
      analytics,
    });
  }

  /**
   * Deterministic Grounded Synthesizer
   */
  synthesizeDeterministicAnswer({
    lower,
    product,
    userProducts,
    documents,
    productDocuments,
    serviceRecords,
    warrantyClaims,
    expenses,
    transfers,
    emailReceipts,
    analytics,
  }) {
    const sources = [];
    const conflicts = [];

    // SCENARIO 1: Expired Warranties ("ok what products of mine have expire its warranty", "which of my products have expired warranty")
    if (
      (lower.includes('expire') || lower.includes('expired')) &&
      (lower.includes('warranty') || lower.includes('warranties') || lower.includes('product') || lower.includes('mine'))
    ) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Warranty Ledger',
        detail: `Evaluated against current date (${formatDateIN(analytics.now)})`,
        verified: true,
      });

      const expiredList = analytics.warranties.expired;
      if (expiredList.length === 0) {
        return {
          answer: `None of your registered products currently have an expired warranty. You have **${analytics.warranties.active.length} product(s) with active warranty protection**.`,
          sources,
          conflicts,
        };
      }

      let ans = `You have **${expiredList.length} product(s) with an expired warranty** as of ${formatDateIN(analytics.now)}:\n\n`;
      expiredList.forEach((item, idx) => {
        const brandStr = item.brand ? `${item.brand} ` : '';
        const modelStr = item.model ? ` (${item.model})` : '';
        const expiryStr = formatDateIN(item.warrantyEndDate);
        const daysStr = Math.abs(item.daysRemaining);

        ans += `${idx + 1}. **${brandStr}${item.productName}**${modelStr}\n`;
        ans += `   • **Warranty Expired On:** ${expiryStr} (${daysStr} day(s) ago)\n`;
        ans += `   • **Category:** ${item.category}\n`;
        ans += `   • **Provider:** ${item.provider}\n\n`;
      });
      ans += `You can check out of warranty repair options or extended protection plans under **Services & Claims**.`;
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 2: Active Warranties ("which products are currently under warranty")
    if (
      lower.includes('under warranty') ||
      lower.includes('active warranty') ||
      lower.includes('currently under warranty') ||
      lower.includes('have warranty') ||
      lower.includes('has warranty')
    ) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Warranty Ledger',
        detail: `Evaluated against current date (${formatDateIN(analytics.now)})`,
        verified: true,
      });

      const activeList = analytics.warranties.active;
      if (activeList.length === 0) {
        return {
          answer: `You currently have no products under active warranty in your LifeReceipt account.`,
          sources,
          conflicts,
        };
      }

      let ans = `You currently have **${activeList.length} product(s) under active warranty protection**:\n\n`;
      activeList.forEach((item, idx) => {
        const brandStr = item.brand ? `${item.brand} ` : '';
        const expiryStr = formatDateIN(item.warrantyEndDate);
        ans += `${idx + 1}. **${brandStr}${item.productName}**\n`;
        ans += `   • **Warranty Valid Until:** ${expiryStr} (${item.daysRemaining} days remaining)\n`;
        ans += `   • **Provider:** ${item.provider}\n\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 3: Warranties Expiring Soon ("which warranties expire soon", "warranty expires in the next 30 days")
    if (
      lower.includes('expire soon') ||
      lower.includes('expiring soon') ||
      lower.includes('next 30 days') ||
      lower.includes('in 30 days')
    ) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Warranty Ledger',
        detail: '30-day forward warranty horizon',
        verified: true,
      });

      const soonList = analytics.warranties.expiringSoon;
      if (soonList.length === 0) {
        return {
          answer: `None of your registered warranties are expiring within the next 30 days. You have **${analytics.warranties.active.length} active warranty records** in your account.`,
          sources,
          conflicts,
        };
      }

      let ans = `You have **${soonList.length} warranty record(s) expiring within the next 30 days**:\n\n`;
      soonList.forEach((item, idx) => {
        const brandStr = item.brand ? `${item.brand} ` : '';
        const expiryStr = formatDateIN(item.warrantyEndDate);
        ans += `${idx + 1}. **${brandStr}${item.productName}**\n`;
        ans += `   • **Expires On:** ${expiryStr} (${item.daysRemaining} days remaining)\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 4: Missing Warranty Information ("which products have missing warranty information")
    if (
      lower.includes('missing warranty') ||
      lower.includes('no warranty') ||
      lower.includes('without warranty') ||
      lower.includes('unrecorded warranty')
    ) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Asset Registry',
        detail: 'Completeness audit for warranty parameters',
        verified: true,
      });

      const missingList = analytics.warranties.missing;
      if (missingList.length === 0) {
        return {
          answer: `All of your registered products have tracked warranty information. Zero products have missing warranty coverage.`,
          sources,
          conflicts,
        };
      }

      let ans = `The following **${missingList.length} product(s)** do not have explicit warranty expiration dates recorded:\n\n`;
      missingList.forEach((item, idx) => {
        const brandStr = item.brand ? `${item.brand} ` : '';
        ans += `${idx + 1}. **${brandStr}${item.productName}**\n`;
      });
      ans += `\nYou can upload a warranty card or invoice to update these records automatically.`;
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 5: Return Period Query ("which products have a return period still active")
    if (
      lower.includes('return period') ||
      lower.includes('return eligible') ||
      lower.includes('can i return') ||
      lower.includes('active return')
    ) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Return Window Tracker',
        detail: `Evaluated against current date (${formatDateIN(analytics.now)})`,
        verified: true,
      });

      const activeReturns = analytics.returns.active;
      if (activeReturns.length === 0) {
        return {
          answer: `None of your registered products have an active return window open. Return periods for all previously acquired items have concluded or were not eligible for return.`,
          sources,
          conflicts,
        };
      }

      let ans = `You have **${activeReturns.length} product(s) with an active return window**:\n\n`;
      activeReturns.forEach((r, idx) => {
        ans += `${idx + 1}. **${r.brand ? `${r.brand} ` : ''}${r.productName}**\n`;
        ans += `   • **Return Deadline:** ${formatDateIN(r.returnEndDate)} (${r.daysRemaining} days remaining)\n`;
        if (r.policyNotes) ans += `   • **Policy Notes:** ${r.policyNotes}\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 6: Highest / Lowest Purchase Price ("which product has the highest purchase price", "most expensive product")
    if (
      lower.includes('highest purchase price') ||
      lower.includes('most expensive') ||
      lower.includes('highest price') ||
      lower.includes('costliest')
    ) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Asset Registry',
        detail: 'Price ledger analysis',
        verified: true,
      });

      const highest = analytics.finances.highestProduct;
      if (!highest) {
        return {
          answer: `You do not have any products with recorded purchase prices in your account yet.`,
          sources,
          conflicts,
        };
      }

      const brandStr = highest.brand ? `${highest.brand} ` : '';
      const priceStr = formatINR(highest.purchasePrice);
      const dateStr = highest.purchaseDate ? formatDateIN(highest.purchaseDate) : 'Date unrecorded';

      return {
        answer: `Your most expensive recorded asset is **${brandStr}${highest.productName}** at **${priceStr}** (Purchased on ${dateStr} from ${highest.sellerName || 'Direct merchant'}).`,
        sources,
        conflicts,
      };
    }

    // SCENARIO 7: Spend by Category ("how much did i spend on electronics", "spend on computing")
    const categories = ['electronics', 'computing', 'appliances', 'home & furniture', 'personal & apparel', 'automotive'];
    for (const cat of categories) {
      if (lower.includes(cat) && (lower.includes('spend') || lower.includes('cost') || lower.includes('how much'))) {
        sources.push({
          type: 'DATABASE',
          title: 'LifeReceipt Cost Analytics',
          detail: `Category ledger for ${cat}`,
          verified: true,
        });

        const matchingCatKey = Object.keys(analytics.finances.categorySpend).find(
          (k) => k.toLowerCase() === cat
        );
        const catTotal = matchingCatKey ? analytics.finances.categorySpend[matchingCatKey] : 0;
        const matchingProducts = userProducts.filter(
          (p) => (p.category || '').toLowerCase() === cat
        );

        let ans = `You have spent a total of **${formatINR(catTotal)}** across **${matchingProducts.length} item(s)** in **${matchingCatKey || cat}**:\n\n`;
        matchingProducts.forEach((p, idx) => {
          ans += `${idx + 1}. **${p.brand ? `${p.brand} ` : ''}${p.productName}**: ${formatINR(p.purchasePrice)}\n`;
        });
        return { answer: ans.trim(), sources, conflicts };
      }
    }

    // SCENARIO 8: Products Costing More Than Threshold ("which products cost more than ₹50,000", "cost more than 50000")
    const costMoreMatch = lower.match(/cost more than (?:₹|rs\.?|inr)?\s*([\d,]+)/i);
    if (costMoreMatch) {
      const threshold = parseInt(costMoreMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(threshold)) {
        sources.push({
          type: 'DATABASE',
          title: 'LifeReceipt Asset Registry',
          detail: `Filtered for purchase price > ${formatINR(threshold)}`,
          verified: true,
        });

        const expensiveList = userProducts.filter((p) => (Number(p.purchasePrice) || 0) > threshold);
        if (expensiveList.length === 0) {
          return {
            answer: `You have no registered products with a purchase price exceeding **${formatINR(threshold)}**.`,
            sources,
            conflicts,
          };
        }

        let ans = `You have **${expensiveList.length} product(s) costing more than ${formatINR(threshold)}**:\n\n`;
        expensiveList.forEach((p, idx) => {
          ans += `${idx + 1}. **${p.brand ? `${p.brand} ` : ''}${p.productName}**: **${formatINR(p.purchasePrice)}** (${p.category || 'General'})\n`;
        });
        return { answer: ans.trim(), sources, conflicts };
      }
    }

    // SCENARIO 9: Products Bought from Amazon / Seller ("what products did i buy from amazon")
    if (lower.includes('amazon') || lower.includes('flipkart') || lower.includes('croma')) {
      const targetSeller = lower.includes('amazon') ? 'amazon' : lower.includes('flipkart') ? 'flipkart' : 'croma';
      const sellerProducts = userProducts.filter((p) => (p.sellerName || '').toLowerCase().includes(targetSeller));

      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Asset Registry',
        detail: `Merchant filter: ${targetSeller.toUpperCase()}`,
        verified: true,
      });

      if (sellerProducts.length === 0) {
        return {
          answer: `I could not find any products in your LifeReceipt account with **${targetSeller.toUpperCase()}** listed as the seller.`,
          sources,
          conflicts,
        };
      }

      let ans = `You have **${sellerProducts.length} product(s) purchased from ${targetSeller.toUpperCase()}**:\n\n`;
      sellerProducts.forEach((p, idx) => {
        ans += `${idx + 1}. **${p.brand ? `${p.brand} ` : ''}${p.productName}** • ${formatINR(p.purchasePrice)} (Purchased: ${p.purchaseDate ? formatDateIN(p.purchaseDate) : 'Date unrecorded'})\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 10: Products Purchased This Year ("show my products purchased this year")
    if (lower.includes('purchased this year') || lower.includes('bought this year')) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Asset Registry',
        detail: `Purchases in calendar year ${analytics.currentYear}`,
        verified: true,
      });

      const thisYear = analytics.finances.thisYearPurchases;
      if (thisYear.length === 0) {
        return {
          answer: `You have no purchases recorded for the calendar year **${analytics.currentYear}**.`,
          sources,
          conflicts,
        };
      }

      let ans = `You have **${thisYear.length} product(s) purchased in ${analytics.currentYear}**:\n\n`;
      thisYear.forEach((p, idx) => {
        ans += `${idx + 1}. **${p.brand ? `${p.brand} ` : ''}${p.productName}** • **${formatINR(p.purchasePrice)}** on ${formatDateIN(p.purchaseDate)} (from ${p.sellerName || 'Direct merchant'})\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 11: Total Spend Query ("how much have i spent on all my products", "how much did i spend")
    if (
      lower.includes('how much have i spent') ||
      lower.includes('how much did i spend') ||
      lower.includes('total spend') ||
      lower.includes('total spent') ||
      lower.includes('how much spent')
    ) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Cost Analytics',
        detail: 'Aggregated asset valuation ledger',
        verified: true,
      });

      let ans = `You have spent a cumulative total of **${formatINR(analytics.finances.totalSpend)}** across your **${analytics.totalProducts} registered asset(s)** in LifeReceipt.\n\n`;
      ans += `#### Category Spend Breakdown:\n`;
      for (const [cat, amt] of Object.entries(analytics.finances.categorySpend)) {
        ans += `• **${cat}:** ${formatINR(amt)}\n`;
      }
      if (analytics.services.repairSpend > 0) {
        ans += `\nAdditionally, you have logged **${formatINR(analytics.services.repairSpend)}** in maintenance and repair expenditures.`;
      }
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 12: Purchase History ("show me my purchase history", "purchase history")
    if (lower.includes('purchase history') || lower.includes('my purchases')) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Purchase Ledger',
        detail: 'Chronological asset acquisition history',
        verified: true,
      });

      if (userProducts.length === 0) {
        return {
          answer: `You have no purchase records saved in your LifeReceipt account yet.`,
          sources,
          conflicts,
        };
      }

      let ans = `### Chronological Purchase History (${userProducts.length} items)\n\n`;
      userProducts.forEach((p, idx) => {
        const brandStr = p.brand ? `${p.brand} ` : '';
        const priceStr = formatINR(p.purchasePrice);
        const dateStr = p.purchaseDate ? formatDateIN(p.purchaseDate) : 'Date unrecorded';
        const sellerStr = p.sellerName ? ` from ${p.sellerName}` : '';
        ans += `${idx + 1}. **${brandStr}${p.productName}**\n`;
        ans += `   • **Purchased:** ${dateStr}${sellerStr}\n`;
        ans += `   • **Price:** ${priceStr} (${p.category || 'General'})\n`;
        ans += `   • **Warranty:** ${calculateWarrantyStatus(p.warranty).label}\n\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 13: Service & Repair Overview ("what services/repairs do I have", "which products need servicing")
    if (
      lower.includes('what services') ||
      lower.includes('what repairs') ||
      lower.includes('services/repairs') ||
      lower.includes('repair history') ||
      lower.includes('need servicing')
    ) {
      sources.push({
        type: 'SERVICE_RECORD',
        title: 'LifeReceipt Service Ledger',
        detail: `${serviceRecords.length} service records evaluated`,
        verified: true,
      });

      if (serviceRecords.length === 0) {
        return {
          answer: `You currently have no service or repair tickets logged in your LifeReceipt account. None of your items are currently flagged as needing urgent servicing.`,
          sources,
          conflicts,
        };
      }

      let ans = `You have **${serviceRecords.length} service & repair event(s)** logged with a cumulative spend of **${formatINR(analytics.services.repairSpend)}**:\n\n`;
      serviceRecords.slice(0, 5).forEach((s, idx) => {
        const pName = s.productId?.productName || 'Asset';
        const costStr = s.actualCost > 0 ? formatINR(s.actualCost) : (s.status === 'COMPLETED' ? 'Free / Under Warranty' : '—');
        ans += `${idx + 1}. **${pName}** — ${s.serviceType} (${s.status})\n`;
        ans += `   • **Issue:** ${s.issueTitle}\n`;
        ans += `   • **Cost:** ${costStr} • Date: ${formatDateIN(s.serviceDate || s.reportedDate)}\n\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 14: Receipts for Specific Product ("what receipts do I have for my phone", "what receipts do I have")
    if (lower.includes('receipt') || lower.includes('invoice')) {
      sources.push({
        type: 'DOCUMENT',
        title: 'LifeReceipt Document Vault',
        detail: `${documents.length} verified documents attached`,
        verified: true,
      });

      if (product) {
        const pDocs = documents.filter((d) => d.productId && d.productId.toString() === product._id.toString());
        if (pDocs.length === 0) {
          return {
            answer: `You do not have any uploaded receipts or invoices attached to your **${product.productName}** yet. You can upload an invoice on the product details page.`,
            sources,
            conflicts,
          };
        }
        let ans = `You have **${pDocs.length} document(s) attached to ${product.productName}**:\n\n`;
        pDocs.forEach((d, idx) => {
          ans += `${idx + 1}. **${d.documentType}:** ${d.fileName} (${d.status})\n`;
          if (d.extractedData?.invoiceNumber) ans += `   • **Invoice #:** ${d.extractedData.invoiceNumber}\n`;
          if (d.extractedData?.purchasePrice) ans += `   • **Extracted Price:** ${formatINR(d.extractedData.purchasePrice)}\n`;
        });
        return { answer: ans.trim(), sources, conflicts };
      }

      if (documents.length === 0) {
        return {
          answer: `You do not have any receipts or invoices uploaded to your LifeReceipt account yet.`,
          sources,
          conflicts,
        };
      }

      let ans = `You have **${documents.length} document(s) stored in your LifeReceipt Vault**:\n\n`;
      documents.slice(0, 8).forEach((d, idx) => {
        ans += `${idx + 1}. **${d.documentType}:** ${d.fileName} (${d.status})\n`;
      });
      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 15: Hardware Identifier / IMEI / Serial Number Query
    if (lower.includes('imei') || lower.includes('serial number') || lower.includes('serial')) {
      sources.push({
        type: 'DATABASE',
        title: 'LifeReceipt Asset Registry',
        detail: 'Hardware identifier and serial number audit',
        verified: true,
      });

      if (product) {
        if (product.serialNumber) {
          return {
            answer: `The recorded serial number for **${product.productName}** is: \`${product.serialNumber}\`.`,
            sources,
            conflicts,
          };
        } else {
          return {
            answer: `The serial number / IMEI is not available in your saved records for **${product.productName}**. You can add it anytime by editing the product details.`,
            sources,
            conflicts,
          };
        }
      }

      const myMatch = lower.match(/my\s+([^?]+)/i);
      const targetName = myMatch ? myMatch[1].trim() : 'that product';
      return {
        answer: `The serial number / IMEI is not available in your saved records for **${targetName}**. This product was not found in your registered LifeReceipt assets.`,
        sources,
        conflicts,
      };
    }

    // SCENARIO 16: Specific Product In-Depth Overview ("tell me everything you know about my HP Pavilion", "status of my laptop")
    if (product) {
      sources.push({
        type: 'DATABASE',
        title: `LifeReceipt Record (${product.productName})`,
        detail: 'Master asset parameters and ownership status',
        verified: true,
      });

      const wStatus = calculateWarrantyStatus(product.warranty);
      const rStatus = calculateReturnStatus(product.returnInfo);
      const priceStr = formatINR(product.purchasePrice);
      const pDocs = documents.filter((d) => d.productId && d.productId.toString() === product._id.toString());
      const pServices = serviceRecords.filter((s) => s.productId && s.productId.toString() === product._id.toString());

      // If user specifically asked for purchase date
      if (lower.includes('when did i buy') || lower.includes('when did i purchase') || lower.includes('purchase date')) {
        const dateStr = product.purchaseDate ? formatDateIN(product.purchaseDate) : 'Date unrecorded';
        return {
          answer: `You purchased your **${product.brand ? `${product.brand} ` : ''}${product.productName}** on **${dateStr}** for **${priceStr}** from **${product.sellerName || 'Direct merchant'}**.`,
          sources,
          conflicts,
        };
      }

      // If user specifically asked for warranty status
      if (lower.includes('warranty status') || lower.includes('warranty of my')) {
        let ans = `### Warranty Status for ${product.productName}\n\n`;
        ans += `• **Status:** ${wStatus.label}\n`;
        ans += `• **Expiration Date:** ${product.warranty?.warrantyEndDate ? formatDateIN(product.warranty.warrantyEndDate) : 'Not specified'}\n`;
        if (product.warranty?.warrantyProvider) ans += `• **Provider:** ${product.warranty.warrantyProvider}\n`;
        if (wStatus.daysRemaining !== null) {
          ans += `• **Time Remaining:** ${wStatus.daysRemaining > 0 ? `${wStatus.daysRemaining} days remaining` : `Expired ${Math.abs(wStatus.daysRemaining)} days ago`}\n`;
        }
        return { answer: ans.trim(), sources, conflicts };
      }

      let ans = `### Complete Ownership Profile: ${product.brand ? `${product.brand} ` : ''}${product.productName}\n\n`;
      ans += `• **Category:** ${product.category || 'General'}\n`;
      ans += `• **Purchase Price:** **${priceStr}**\n`;
      ans += `• **Purchase Date:** ${product.purchaseDate ? formatDateIN(product.purchaseDate) : 'Not specified'}\n`;
      ans += `• **Merchant / Seller:** ${product.sellerName || 'Direct Merchant'}\n`;
      ans += `• **Hardware Serial Number:** ${product.serialNumber ? `\`${product.serialNumber}\`` : 'Not recorded'}\n`;
      ans += `• **Warranty Status:** ${wStatus.label}${product.warranty?.warrantyEndDate ? ` (Expires: ${formatDateIN(product.warranty.warrantyEndDate)})` : ''}\n`;
      ans += `• **Return Policy:** ${rStatus.label}\n`;
      ans += `• **Vault Documents Attached:** ${pDocs.length} document(s)\n`;
      ans += `• **Service Records Logged:** ${pServices.length} maintenance event(s)\n`;

      return { answer: ans.trim(), sources, conflicts };
    }

    // SCENARIO 16: Catalog Inventory & Count ("how many products do i own", "what products do i own")
    sources.push({
      type: 'DATABASE',
      title: 'LifeReceipt Asset Registry',
      detail: `Retrieved ${userProducts.length} registered asset(s)`,
      verified: true,
    });

    if (userProducts.length === 0) {
      return {
        answer: `You have not registered any physical assets in your LifeReceipt account yet. You can upload an invoice or receipt to add your first product.`,
        sources,
        conflicts,
      };
    }

    let ans = `You currently own **${userProducts.length} registered product(s)** tracked in LifeReceipt (Total value: **${formatINR(analytics.finances.totalSpend)}**):\n\n`;
    userProducts.forEach((p, idx) => {
      const brandStr = p.brand ? `${p.brand} ` : '';
      const priceStr = formatINR(p.purchasePrice);
      const wStatus = calculateWarrantyStatus(p.warranty);
      const dateStr = p.purchaseDate ? formatDateIN(p.purchaseDate) : 'Date unrecorded';

      ans += `${idx + 1}. **${brandStr}${p.productName}** (${p.category || 'Other'})\n`;
      ans += `   • **Price:** ${priceStr} • **Purchased:** ${dateStr} from ${p.sellerName || 'Direct merchant'}\n`;
      ans += `   • **Warranty:** ${wStatus.label}\n\n`;
    });

    return { answer: ans.trim(), sources, conflicts };
  }

  /**
   * Retrieve conversation history for authenticated user
   */
  async getConversationHistory(userId, sessionId) {
    if (!sessionId) {
      const latest = await Conversation.findOne({ userId }).sort({ updatedAt: -1 }).lean();
      return latest ? latest.messages : [];
    }

    const conversation = await Conversation.findOne({ userId, sessionId }).lean();
    return conversation ? conversation.messages : [];
  }

  /**
   * Clear conversation history for authenticated user
   */
  async clearConversationHistory(userId, sessionId) {
    if (sessionId) {
      await Conversation.findOneAndDelete({ userId, sessionId });
    } else {
      await Conversation.deleteMany({ userId });
    }
    return { success: true };
  }
}

export default new AssistantService();
