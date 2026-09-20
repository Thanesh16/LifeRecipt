import fs from 'fs';
import path from 'path';
import env from '../config/env.js';

/**
 * Service abstraction for extracting text and structured data from receipts and invoices.
 * Supports:
 * - Gemini API (multi-modal / text)
 * - OpenAI API (gpt-4o vision / text)
 * - Deterministic text parser fallback when AI provider is not configured
 */

/**
 * Extract raw text from PDF or text-bearing files
 */
export const extractRawText = async (filePath, mimeType) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    if (mimeType === 'application/pdf') {
      try {
        const pdfParseModule = await import('pdf-parse');
        if (pdfParseModule.PDFParse) {
          const parser = new pdfParseModule.PDFParse({ data: fileBuffer });
          const textResult = await parser.getText();
          const text = (textResult && textResult.text) ? textResult.text.trim() : '';
          if (typeof parser.destroy === 'function') {
            try { await parser.destroy(); } catch (_) {}
          }
          if (text) return text;
        } else if (typeof pdfParseModule.default === 'function') {
          const pdfData = await pdfParseModule.default(fileBuffer);
          if (pdfData && pdfData.text && pdfData.text.trim()) {
            return pdfData.text.trim();
          }
        }
      } catch (pdfErr) {
        // Fallback: extract plain text strings from PDF stream
        const rawContent = fileBuffer.toString('utf-8');
        const textMatches = rawContent.match(/\(([^)]+)\)\s*Tj/g);
        if (textMatches) {
          return textMatches.map((m) => m.replace(/[()]/g, '').replace(/\s*Tj/, '')).join(' ');
        }
      }
    }

    return '';
  } catch (err) {
    console.warn(`[Text Extraction Warning] ${err.message}`);
    return '';
  }
};

/**
 * Regex-based deterministic parser used as fallback when AI API keys are missing.
 * Special focus: Indian invoices (₹, Rs., Rs, INR, GST, GSTIN, CGST, SGST, IGST).
 * Never invents information; extracts only explicitly matching patterns.
 */
export const parseDeterministicReceipt = (text, originalName) => {
  const clean = text || '';
  const paginationRegex = /^(--\s*\d+\s*(?:of|\/)\s*\d+\s*--|page\s*\d+\s*(?:of|\/)\s*\d+|\d+\s*of\s*\d+)$/i;
  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && !paginationRegex.test(l));

  let detectedPrice = null;
  let detectedCurrency = 'INR'; // Default region: India (INR)
  let detectedDate = null;
  let detectedSeller = null;
  let detectedInvoiceNumber = null;
  let detectedTaxInfo = null;

  // Currency detection
  if (clean.includes('₹') || clean.match(/\b(?:INR|Rs\.?|Rupees)\b/i)) {
    detectedCurrency = 'INR';
  } else if (clean.includes('€') || clean.match(/\bEUR\b/i)) {
    detectedCurrency = 'EUR';
  } else if (clean.includes('£') || clean.match(/\bGBP\b/i)) {
    detectedCurrency = 'GBP';
  } else if (clean.includes('$') || clean.match(/\bUSD\b/i)) {
    detectedCurrency = 'USD';
  }

  // Price match: Prioritize grand total / total price over freight or transit charges
  const grandTotalRegex = /(?:total\s+price|grand\s+total|net\s+payable|total\s+amount|invoice\s+total)[\s:]*(?:₹|Rs\.?|INR)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/i;
  const gtMatch = clean.match(grandTotalRegex);
  if (gtMatch && gtMatch[1]) {
    const rawVal = gtMatch[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      detectedPrice = num;
    }
  }

  if (!detectedPrice) {
    const priceRegexes = [
      /(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/i,
      /(?:total|amount|net payable|grand total)[\s:]*(?:₹|Rs\.?|INR|\$)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/i,
      /(?:[$€£₹]|USD|EUR|GBP|INR)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?)/,
    ];

    for (const regex of priceRegexes) {
      const match = clean.match(regex);
      if (match && match[1]) {
        const rawVal = match[1].replace(/,/g, '');
        const num = parseFloat(rawVal);
        if (!isNaN(num) && num > 0) {
          detectedPrice = num;
          break;
        }
      }
    }
  }

  // Indian GST / Tax extraction: GSTIN (15 alphanumeric characters e.g. 29ABCDE1234F1Z5)
  const gstinMatch = clean.match(/\b(?:GSTIN|GST(?:\s*(?:No|Number|#))?)[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
  const taxesFound = [];
  if (gstinMatch) {
    taxesFound.push(`GSTIN: ${gstinMatch[1]}`);
  }

  const cgstMatch = clean.match(/\bCGST(?:\s*@\s*\d+(?:\.\d+)?%)?[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (cgstMatch) taxesFound.push(`CGST: ₹${cgstMatch[1]}`);

  const sgstMatch = clean.match(/\bSGST(?:\s*@\s*\d+(?:\.\d+)?%)?[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (sgstMatch) taxesFound.push(`SGST: ₹${sgstMatch[1]}`);

  const igstMatch = clean.match(/\bIGST(?:\s*@\s*\d+(?:\.\d+)?%)?[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (igstMatch) taxesFound.push(`IGST: ₹${igstMatch[1]}`);

  if (taxesFound.length > 0) {
    detectedTaxInfo = taxesFound.join(' | ');
  }

  // Date match: supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, 15 Oct 2024
  const datePatterns = [
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/, // Indian DD/MM/YYYY
    /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, // YYYY-MM-DD
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i
  ];

  for (const pattern of datePatterns) {
    const match = clean.match(pattern);
    if (match) {
      if (match[3] && match[3].length === 4 && match[1].length <= 2) {
        // DD/MM/YYYY
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        const parsed = new Date(`${year}-${month}-${day}`);
        if (!isNaN(parsed.getTime())) {
          detectedDate = `${year}-${month}-${day}`;
          break;
        }
      } else {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed.getTime())) {
          detectedDate = parsed.toISOString().split('T')[0];
          break;
        }
      }
    }
  }

  // Invoice # match
  const invoiceMatch = clean.match(/(?:invoice\s*(?:no|number|#)|inv\s*#)[\s:]*([a-zA-Z0-9-_/]+)/i);
  if (invoiceMatch) {
    detectedInvoiceNumber = invoiceMatch[1];
  }

  // Warranty match in text: e.g. "1 Year Warranty", "2 Years Comprehensive Warranty"
  let hasWarranty = false;
  let durationMonths = null;
  let warrantyEndDate = null;
  const warrantyMatch = clean.match(/(\d+)\s*(?:year|yr|month|mo)s?\s*(?:manufacturer|store|limited)?\s*warranty/i);
  if (warrantyMatch) {
    hasWarranty = true;
    const count = parseInt(warrantyMatch[1], 10);
    const isYear = /year|yr/i.test(warrantyMatch[0]);
    durationMonths = isYear ? count * 12 : count;

    if (detectedDate) {
      const start = new Date(detectedDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + durationMonths);
      warrantyEndDate = end.toISOString().split('T')[0];
    }
  }

  // Seller detection
  const soldByMatch = clean.match(/(?:sold\s+by|merchant|billed\s+from)[\s:]*\n*([A-Za-z0-9\s&,.-]{3,50})/i);
  if (soldByMatch && soldByMatch[1] && !soldByMatch[1].toLowerCase().includes('flipkart india') && !soldByMatch[1].toLowerCase().includes('tax invoice')) {
    detectedSeller = soldByMatch[1].replace(/^[,\s]+|[,\s]+$/g, '').trim();
  } else {
    const sellerKeywords = ['Amazon', 'Flipkart', 'Croma', 'Reliance Digital', 'Vijay Sales', 'Apple Store', 'HP World'];
    for (const s of sellerKeywords) {
      if (clean.toLowerCase().includes(s.toLowerCase())) {
        detectedSeller = s;
        break;
      }
    }
    if (!detectedSeller && lines.length > 0 && lines[0].length < 50 && !lines[0].match(/invoice|receipt|tax|godown|estate|place of/i)) {
      detectedSeller = lines[0];
    }
  }

  // Check for table product line item (e.g. after Product Description / Description of Goods)
  let tableProductCandidate = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/product\s+description|description\s+of\s+goods|item\s+description/i.test(l)) {
      for (let j = i + 1; j <= i + 4 && j < lines.length; j++) {
        const next = lines[j];
        if (!/^(qty|gross|amount|discount|taxable|igst|cgst|sgst|cess|total|value|charges|particulars|rate|hsn)/i.test(next) && next.length >= 5) {
          tableProductCandidate = next;
          break;
        }
      }
    }
    if (tableProductCandidate) break;
  }

  const sanitizeName = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const candidateLines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const addressLineRegex = /(?:godown|shivam estate|place of origin|destination|shipped|billed|consignor|consignee|registration no|surat|nagercoil|tamil nadu|gujarat|pincode|industrial|logistic park)/i;
    const nonProductHeaders = /^(tax\s+invoice|invoice|receipt|bill\s+of\s+supply|order\s+details|cash\s+receipt|shipping\s+slip|delivery\s+challan|date|seller|total|amount|customer|page|original|duplicate|triplicate|declaration|ordered through|authorized)/i;

    let chosen = null;
    for (const line of candidateLines) {
      if (!paginationRegex.test(line) && !nonProductHeaders.test(line) && !addressLineRegex.test(line) && line.length >= 3) {
        chosen = line;
        break;
      }
    }
    if (!chosen && candidateLines.length > 0) {
      chosen = candidateLines[candidateLines.length - 1];
    }
    if (!chosen) return null;

    return chosen
      .split('|')[0]
      .replace(/\[\[\s*\]\]/g, '')
      .replace(/IMEI.*$/i, '')
      .replace(/HSN:.*$/i, '')
      .replace(/\(\d+\)$/, '')
      .replace(/^[-\s:,]+|[-\s:,]+$/g, '')
      .trim();
  };

  let cleanName = null;
  let detectedBrand = null;
  let detectedModel = null;

  if (tableProductCandidate) {
    cleanName = sanitizeName(tableProductCandidate);
    if (cleanName) {
      detectedBrand = cleanName.split(/\s+/)[0];
    }
    const mMatch = tableProductCandidate.match(/(?:HAND-[A-Z0-9-]+|[A-Z0-9]{3,}-[A-Z0-9]+)/i);
    if (mMatch) {
      detectedModel = mMatch[0].trim();
    }
  }

  // Fallback to filename or known brands
  if (!cleanName) {
    const rawBase = path.basename(originalName, path.extname(originalName))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

    if (rawBase && !paginationRegex.test(rawBase) && !rawBase.match(/^(?:scan|image|doc|receipt|invoice|upload|img|file|untitled|document)\b/i)) {
      cleanName = rawBase;
    }

    const knownBrands = ['boAt', 'Boat', 'Sony', 'Apple', 'Samsung', 'HP', 'Dell', 'Lenovo', 'LG', 'Bose', 'OnePlus'];
    for (const line of lines) {
      if (paginationRegex.test(line)) continue;
      for (const b of knownBrands) {
        if (new RegExp(`\\b${b}\\b`, 'i').test(line) && line.length < 80) {
          cleanName = line;
          detectedBrand = b;
          break;
        }
      }
      if (cleanName) break;
    }
  }

  // Infer category
  let detectedCategory = 'Electronics';
  const allContext = `${clean} ${cleanName || ''}`.toLowerCase();
  if (allContext.match(/\b(bird\s+house|bird\s+nest|furniture|sofa|chair|table|bed|mattress|decor|wooden|shelf|cabinet)\b/)) {
    detectedCategory = 'Home & Furniture';
  } else if (allContext.match(/\b(refrigerator|fridge|washing\s+machine|microwave|oven|vacuum|ac|air\s+conditioner|heater|purifier)\b/)) {
    detectedCategory = 'Appliances';
  } else if (allContext.match(/\b(laptop|desktop|monitor|keyboard|mouse|printer|router|tablet|ipad|macbook|ram|ssd|hard\s+disk)\b/)) {
    detectedCategory = 'Computing';
  } else if (allContext.match(/\b(headphone|earphone|audio|speaker|tv|television|camera|smartwatch|watch|earbuds|soundbar|mobile|phone|smartphone)\b/)) {
    detectedCategory = 'Electronics';
  } else if (allContext.match(/\b(car|bike|motorcycle|tyre|tire|helmet|dashcam)\b/)) {
    detectedCategory = 'Automotive';
  } else if (allContext.match(/\b(shirt|shoes|dress|tshirt|jeans|jacket|clothing|sunglasses)\b/)) {
    detectedCategory = 'Personal & Apparel';
  } else if (allContext.match(/\b(drill|wrench|hammer|screwdriver|tool\s+kit|saw)\b/)) {
    detectedCategory = 'Tools & Hardware';
  } else if (allContext.match(/\b(bicycle|cycle|treadmill|dumbbell|fitness|tent|yoga)\b/)) {
    detectedCategory = 'Sports & Outdoors';
  }

  return {
    productName: cleanName || null,
    productDescription: null,
    products: cleanName ? [{ productName: cleanName, brand: detectedBrand, model: detectedModel, purchasePrice: detectedPrice || null, quantity: 1, productDescription: null }] : [],
    category: detectedCategory,
    brand: detectedBrand,
    model: detectedModel,
    serialNumber: null,
    purchaseDate: detectedDate || null,
    purchasePrice: detectedPrice || null,
    currency: detectedCurrency,
    sellerName: detectedSeller || null,
    invoiceNumber: detectedInvoiceNumber || null,
    warranty: {
      hasWarranty,
      durationMonths,
      warrantyStartDate: detectedDate || null,
      warrantyEndDate,
      warrantyProvider: detectedSeller || null,
      warrantyType: hasWarranty ? 'Manufacturer' : 'None',
    },
    returnInfo: {
      returnEligible: false,
      returnEndDate: null,
      returnPolicyNotes: null,
    },
    quantity: 1,
    taxInfo: detectedTaxInfo,
    confidence: {
      productName: cleanName ? 'Low' : 'Unknown',
      brand: 'Unknown',
      model: 'Unknown',
      purchasePrice: detectedPrice ? 'Medium' : 'Unknown',
      purchaseDate: detectedDate ? 'Medium' : 'Unknown',
      warranty: hasWarranty ? 'Medium' : 'Unknown',
      returnInfo: 'Unknown',
    },
    summary: 'Extracted via fallback parser. AI provider API key is not configured.',
    unclearDetails: [
      'AI Provider API key not configured. For automated semantic extraction, configure GEMINI_API_KEY or OPENAI_API_KEY.',
    ],
  };
};

/**
 * Call Gemini multi-modal model with fallback cascade and PDF support
 */
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest'];

const callGeminiExtraction = async (apiKey, fileBuffer, mimeType, text) => {
  const prompt = `
You are an expert financial and product ownership data extraction engine for the LIFERECEIPT platform.
Analyze this document (receipt, invoice, warranty, service invoice, order confirmation, shipping slip, manual, or product sheet) and extract structured product and purchase details.

CRITICAL PRODUCT & PRICING RULES:
1. PRODUCT NAME & DESCRIPTION:
   - Extract the authentic, concise product name (e.g. "boAt Rockerz 650 Pro" or "Avirox HAND-BH-07 Bird House").
   - NEVER use pagination text (e.g. "-- 1 of 1 --", "-- 1 of 3 --", "Page 1 of 1", "1 of 1").
   - NEVER use printer headers/footers, delivery addresses, consignor/consignee labels.
   - If the document contains both a product name and a long marketing or specification description, keep "productName" clean and concise, and place the longer text into "productDescription".
2. MULTIPLE PRODUCTS / VARIANTS:
   - If multiple products or line items are present, identify the primary product in the root fields ("productName", "brand", "model", etc.), AND list all detected items in the "products" array:
     [ { "productName": string, "brand": string or null, "model": string or null, "purchasePrice": number or null, "quantity": number, "productDescription": string or null } ]
3. PURCHASE PRICE:
   - ONLY extract "purchasePrice" if an explicit purchase price, unit price, or monetary total is stated in the document.
   - Prioritize final invoice/order total (e.g. "TOTAL PRICE: 261.00") over freight or transit charges.
   - If NO purchase price is present in the document, return null. NEVER invent ₹0 or $0 or hallucinate an amount.
4. REGIONAL & TAX RULES:
   - The operating region is INDIA. Default currency is "INR" (₹) unless explicitly stated otherwise.
   - Extract Indian tax details into "taxInfo" when present: GSTIN, CGST, SGST, IGST. NEVER invent tax data.
5. WARRANTY & RETURNS:
   - Extract warranty coverage duration, provider, and terms if mentioned. If absent, set hasWarranty: false.
6. Return ONLY a valid JSON object matching this exact schema:

{
  "productName": string or null,
  "productDescription": string or null,
  "category": "Electronics" | "Appliances" | "Automotive" | "Home & Furniture" | "Computing" | "Personal & Apparel" | "Tools & Hardware" | "Sports & Outdoors" | "Other" or null,
  "brand": string or null,
  "model": string or null,
  "serialNumber": string or null,
  "purchaseDate": "YYYY-MM-DD" or null,
  "purchasePrice": number or null,
  "currency": string or null,
  "sellerName": string or null,
  "invoiceNumber": string or null,
  "quantity": number,
  "taxInfo": string or null,
  "products": [
    {
      "productName": string,
      "brand": string or null,
      "model": string or null,
      "purchasePrice": number or null,
      "quantity": number,
      "productDescription": string or null
    }
  ],
  "warranty": {
    "hasWarranty": boolean,
    "durationMonths": number or null,
    "warrantyStartDate": "YYYY-MM-DD" or null,
    "warrantyEndDate": "YYYY-MM-DD" or null,
    "warrantyProvider": string or null,
    "warrantyType": "Manufacturer" | "Extended" | "Store" | "Third-Party" | "Lifetime" | "None" or null
  },
  "returnInfo": {
    "returnEligible": boolean,
    "returnEndDate": "YYYY-MM-DD" or null,
    "returnPolicyNotes": string or null
  },
  "confidence": {
    "productName": "High" | "Medium" | "Low" | "Unknown",
    "brand": "High" | "Medium" | "Low" | "Unknown",
    "model": "High" | "Medium" | "Low" | "Unknown",
    "purchasePrice": "High" | "Medium" | "Low" | "Unknown",
    "purchaseDate": "High" | "Medium" | "Low" | "Unknown",
    "warranty": "High" | "Medium" | "Low" | "Unknown",
    "returnInfo": "High" | "Medium" | "Low" | "Unknown"
  },
  "summary": string,
  "unclearDetails": [string]
}
`;

  const parts = [{ text: prompt }];
  const hasReadableText = Boolean(text && text.trim().length > 50);

  if (hasReadableText) {
    // When text is available, send clean text directly (5x faster, avoids huge PDF upload)
    parts.push({
      text: `Document text content:\n${text.trim()}`,
    });
  } else if (fileBuffer && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
    // For image or scanned document without text layer, pass binary base64
    parts.push({
      inlineData: {
        mimeType,
        data: fileBuffer.toString('base64'),
      },
    });
  }

  // 12s per-model attempt prevents hanging when network or DNS has hiccups
  const timeoutMs = 12000;
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 429) {
          console.warn(`[Gemini Rate Limit] Model ${model} rate limited / quota exceeded (HTTP 429).`);
        } else if (response.status === 400 || response.status === 403) {
          console.warn(`[Gemini Auth Error] Model ${model} authentication or permission error (HTTP ${response.status}).`);
        }
        throw new Error(`Gemini model ${model} returned status ${response.status}: ${errorBody}`);
      }

      const result = await response.json();
      const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error(`Gemini model ${model} returned empty response content.`);
      }

      const parsed = JSON.parse(rawJson);

      // Clean product name if noise or address was captured
      if (parsed.productName && typeof parsed.productName === 'string') {
        const pLines = parsed.productName.split('\n').map((l) => l.trim()).filter(Boolean);
        const addressLineRegex = /(?:godown|shivam estate|place of origin|destination|shipped|billed|consignor|consignee|registration no|surat|nagercoil|tamil nadu|gujarat|pincode|industrial|logistic park)/i;
        let chosen = null;
        for (const l of pLines) {
          if (!addressLineRegex.test(l) && l.length >= 3) {
            chosen = l;
            break;
          }
        }
        if (!chosen && pLines.length > 0) chosen = pLines[pLines.length - 1];
        if (chosen) {
          parsed.productName = chosen.split('|')[0].replace(/\[\[\s*\]\]/g, '').replace(/IMEI.*$/i, '').replace(/HSN:.*$/i, '').replace(/\(\d+\)$/, '').trim();
        }
      }

      // Ensure products array is formatted
      if (!parsed.products && parsed.productName) {
        parsed.products = [{
          productName: parsed.productName,
          brand: parsed.brand || null,
          model: parsed.model || null,
          purchasePrice: parsed.purchasePrice !== undefined ? parsed.purchasePrice : null,
          quantity: parsed.quantity || 1,
          productDescription: parsed.productDescription || null,
        }];
      }

      return { data: parsed, modelUsed: model };
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        console.warn(`[Gemini Timeout] Model ${model} timed out after ${timeoutMs}ms.`);
      } else {
        console.warn(`[Gemini Extraction Fallback] Model ${model} failed (${err.message}, cause: ${err.cause?.message || err.cause?.code || err.cause}). Trying next candidate...`);
      }
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini extraction models failed.');
};

/**
 * Call OpenAI API (gpt-4o vision or text)
 */
const callOpenAIExtraction = async (apiKey, fileBuffer, mimeType, text) => {
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const systemPrompt = `
You are an expert financial and product ownership data extraction engine for the LIFERECEIPT platform.
Extract structured product details from receipts and invoices.
The operating region is INDIA. Default currency is "INR" (₹) unless explicitly specified otherwise.
Never invent ₹0 or $0 or hallucinate unstated amounts.
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Extract structured product & purchase details according to our schema.\nDocument Text: ${text || ''}`,
        },
      ],
    },
  ];

  if (mimeType.startsWith('image/')) {
    messages[1].content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
      },
    });
  }

  const timeoutMs = env.DOCUMENT_PROCESSING_TIMEOUT_MS || 50000;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API call failed with status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const rawJson = result.choices?.[0]?.message?.content;
  return JSON.parse(rawJson);
};

/**
 * Master Extraction Pipeline
 */
export const processDocumentWithAI = async ({ filePath, mimeType, originalName, extractedText = null }) => {
  // 1. Read file and extract text/OCR
  const fileBuffer = fs.readFileSync(filePath);
  const ocrText = (extractedText && extractedText.trim()) || (await extractRawText(filePath, mimeType));

  const hasGeminiKey = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim());
  const hasOpenAIKey = Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim());

  // 2. If AI key is configured, execute genuine AI extraction
  if (env.AI_PROVIDER === 'GEMINI' && hasGeminiKey) {
    try {
      const extractedResult = await callGeminiExtraction(env.GEMINI_API_KEY, fileBuffer, mimeType, ocrText);
      return {
        aiProviderConfigured: true,
        aiProvider: 'GEMINI',
        aiModelUsed: extractedResult.modelUsed || 'gemini-3-flash-preview',
        ocrText,
        extractedData: extractedResult.data,
      };
    } catch (aiErr) {
      console.error('[Gemini AI Extraction Error]', aiErr.message);
      // Fallback with explicit failure note
      const fallback = parseDeterministicReceipt(ocrText, originalName);
      fallback.unclearDetails.push(`AI request failed: ${aiErr.message}. Fallback text parser used.`);
      return {
        aiProviderConfigured: true,
        aiProvider: 'GEMINI (Error Fallback)',
        aiModelUsed: 'fallback-regex',
        ocrText,
        extractedData: fallback,
      };
    }
  } else if (env.AI_PROVIDER === 'OPENAI' && hasOpenAIKey) {
    try {
      const extracted = await callOpenAIExtraction(env.OPENAI_API_KEY, fileBuffer, mimeType, ocrText);
      return {
        aiProviderConfigured: true,
        aiProvider: 'OPENAI',
        aiModelUsed: 'gpt-4o',
        ocrText,
        extractedData: extracted,
      };
    } catch (aiErr) {
      console.error('[OpenAI Extraction Error]', aiErr.message);
      const fallback = parseDeterministicReceipt(ocrText, originalName);
      fallback.unclearDetails.push(`OpenAI request failed: ${aiErr.message}. Fallback text parser used.`);
      return {
        aiProviderConfigured: true,
        aiProvider: 'OPENAI (Error Fallback)',
        aiModelUsed: 'fallback-regex',
        ocrText,
        extractedData: fallback,
      };
    }
  }

  // 3. If AI configuration is missing, explicitly report status and perform rule-based parsing
  const parsedData = parseDeterministicReceipt(ocrText, originalName);

  return {
    aiProviderConfigured: false,
    aiProvider: env.AI_PROVIDER,
    aiModelUsed: 'deterministic-regex-fallback',
    statusMessage: `AI Provider (${env.AI_PROVIDER}) API key is not configured in backend/.env. Document text was extracted, but semantic AI structuring requires GEMINI_API_KEY or OPENAI_API_KEY.`,
    ocrText,
    extractedData: parsedData,
  };
};

export default {
  extractRawText,
  processDocumentWithAI,
};
