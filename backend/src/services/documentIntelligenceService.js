import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Document from '../models/Document.js';
import Product from '../models/Product.js';
import { formatDateIN, formatINR } from '../utils/formatters.js';

/**
 * LIFERECEIPT Advanced AI Document Intelligence Service
 * Phase 16: Document classification, multi-page parsing, structured field extraction,
 * field confidence scoring, product matching, duplicate detection, and conflict detection.
 */
class DocumentIntelligenceService {
  /**
   * Compute SHA-256 hash of file content for tamper-evidence and duplicate detection.
   */
  computeFileHash(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (err) {
      console.warn(`[File Hash Warning] ${err.message}`);
      return null;
    }
  }

  /**
   * Parse multi-page PDF documents into page-by-page text chunks.
   */
  async extractMultiPageText(filePath, mimeType) {
    try {
      const fileBuffer = fs.readFileSync(filePath);

      if (mimeType === 'application/pdf') {
        let pages = [];
        let fullText = '';
        let pageCount = 1;

        const pdfParseModule = await import('pdf-parse');
        if (pdfParseModule.PDFParse) {
          // pdf-parse v2+
          const parser = new pdfParseModule.PDFParse({ data: fileBuffer });
          const textResult = await parser.getText();
          fullText = (textResult && textResult.text) ? textResult.text.trim() : '';
          pageCount = (textResult && textResult.total) ? textResult.total : 1;

          if (Array.isArray(textResult?.pages)) {
            pages = textResult.pages.map((p, idx) => ({
              pageNumber: p.num || idx + 1,
              text: (p.text || '').trim(),
            }));
          }

          if (typeof parser.destroy === 'function') {
            try {
              await parser.destroy();
            } catch (_) {}
          }
        } else if (typeof pdfParseModule.default === 'function') {
          // pdf-parse v1 fallback
          const pdfData = await pdfParseModule.default(fileBuffer);
          fullText = (pdfData && pdfData.text) ? pdfData.text.trim() : '';
          pageCount = (pdfData && pdfData.numpages) ? pdfData.numpages : 1;
          const rawSplits = fullText.split('\f').filter((s) => s.trim().length > 0);
          if (rawSplits.length > 0) {
            pages = rawSplits.map((chunk, i) => ({ pageNumber: i + 1, text: chunk.trim() }));
          }
        }

        if (pages.length === 0 && fullText) {
          pages.push({ pageNumber: 1, text: fullText });
        }

        return {
          pageCount: pageCount || pages.length || 1,
          pages,
          fullText,
        };
      }

      // Plain text / OCR fallback
      const rawText = fileBuffer.toString('utf-8');
      return {
        pageCount: 1,
        pages: [{ pageNumber: 1, text: rawText }],
        fullText: rawText,
      };
    } catch (err) {
      console.warn(`[Multi-Page Text Extraction Warning] ${err.message}`);
      return {
        pageCount: 1,
        pages: [{ pageNumber: 1, text: '' }],
        fullText: '',
      };
    }
  }

  /**
   * Classify document into one of the supported types based on semantic keyword density.
   */
  classifyDocument(text = '', fileName = '', userDeclaredType = null) {
    const lower = `${fileName} ${text}`.toLowerCase();

    // Classification Scoring Table
    const scores = {
      WARRANTY: 0,
      SERVICE_INVOICE: 0,
      INSURANCE: 0,
      MANUAL: 0,
      PURCHASE_ORDER: 0,
      DELIVERY_DOCUMENT: 0,
      INVOICE: 0,
      RECEIPT: 0,
    };

    // 1. Warranty Certificate
    if (lower.includes('warranty certificate') || lower.includes('warranty card') || lower.includes('warranty terms')) scores.WARRANTY += 5;
    if (lower.includes('limited warranty') || lower.includes('warranty coverage') || lower.includes('exclusions')) scores.WARRANTY += 3;
    if (lower.includes('warranty period') || lower.includes('claim procedure')) scores.WARRANTY += 2;

    // 2. Service / Repair Invoice
    if (lower.includes('service invoice') || lower.includes('job card') || lower.includes('repair invoice')) scores.SERVICE_INVOICE += 5;
    if (lower.includes('parts replaced') || lower.includes('labor charges') || lower.includes('technician notes')) scores.SERVICE_INVOICE += 3;
    if (lower.includes('service center') || lower.includes('diagnostic')) scores.SERVICE_INVOICE += 2;

    // 3. Insurance Policy
    if (lower.includes('insurance policy') || lower.includes('policy schedule') || lower.includes('sum insured')) scores.INSURANCE += 5;
    if (lower.includes('policy number') || lower.includes('premium amount') || lower.includes('coverage period')) scores.INSURANCE += 3;
    if (lower.includes('insurer') || lower.includes('underwriter')) scores.INSURANCE += 2;

    // 4. User Manual / Guide
    if (lower.includes('user manual') || lower.includes('user guide') || lower.includes('instruction manual')) scores.MANUAL += 5;
    if (lower.includes('installation guide') || lower.includes('operating instructions') || lower.includes('safety precautions')) scores.MANUAL += 3;
    if (lower.includes('troubleshooting') || lower.includes('specifications')) scores.MANUAL += 2;

    // 5. Purchase Order
    if (lower.includes('purchase order') || lower.includes('po number') || lower.includes('p.o. no')) scores.PURCHASE_ORDER += 5;
    if (lower.includes('vendor code') || lower.includes('order requisition')) scores.PURCHASE_ORDER += 3;

    // 6. Delivery Document / Challan
    if (lower.includes('delivery challan') || lower.includes('consignment note') || lower.includes('proof of delivery')) scores.DELIVERY_DOCUMENT += 5;
    if (lower.includes('dispatch advice') || lower.includes('received in good condition')) scores.DELIVERY_DOCUMENT += 3;

    // 7. Commercial Tax Invoice
    if (lower.includes('tax invoice') || lower.includes('bill of supply') || lower.includes('gstin')) scores.INVOICE += 5;
    if (lower.includes('cgst') || lower.includes('sgst') || lower.includes('igst') || lower.includes('invoice no')) scores.INVOICE += 3;
    if (lower.includes('taxable value') || lower.includes('place of supply')) scores.INVOICE += 2;

    // 8. General Receipt
    if (lower.includes('receipt') || lower.includes('sales receipt') || lower.includes('payment receipt')) scores.RECEIPT += 4;
    if (lower.includes('order summary') || lower.includes('cash memo')) scores.RECEIPT += 2;

    // Identify highest scoring category
    let bestType = 'RECEIPT';
    let maxScore = 0;
    const alternatives = [];

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = type;
      }
      if (score > 1) {
        alternatives.push(type);
      }
    }

    // Confidence mapping: score >= 5 is very confident (0.95), >= 3 is moderate (0.80), >= 1 is low (0.60)
    let confidence = 0.50;
    if (maxScore >= 5) confidence = 0.95;
    else if (maxScore >= 3) confidence = 0.80;
    else if (maxScore >= 1) confidence = 0.65;

    // Keep AI detection objective!
    // Best type is determined by content scoring. User declared type is preserved for UI reference,
    // but never overrides an objective high-confidence classification.
    let detectedType = bestType;
    if (maxScore === 0 && userDeclaredType && userDeclaredType !== 'ALL') {
      detectedType = userDeclaredType;
      confidence = 0.60;
    }

    const isConfident = confidence >= 0.65;

    return {
      detectedType,
      confidence,
      isConfident,
      userDeclaredType: userDeclaredType || null,
      alternativeTypes: alternatives.filter((t) => t !== detectedType),
      classifiedAt: new Date(),
    };
  }

  /**
   * Extract structured fields according to classified document type.
   */
  extractStructuredFields(text = '', docType = 'RECEIPT', pages = []) {
    const clean = text || '';
    const paginationRegex = /^(--\s*\d+\s*(?:of|\/)\s*\d+\s*--|page\s*\d+\s*(?:of|\/)\s*\d+|\d+\s*of\s*\d+)$/i;
    const lines = clean
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => Boolean(l) && !paginationRegex.test(l));

    const fieldConfidence = {};
    const missingFields = [];

    // Helper to find which page a substring or regex match appears on
    const findSourcePage = (target) => {
      if (!pages || pages.length <= 1) return 'Page 1';
      for (const p of pages) {
        if (typeof target === 'string' && p.text.toLowerCase().includes(target.toLowerCase())) {
          return `Page ${p.pageNumber}`;
        }
        if (target instanceof RegExp && target.test(p.text)) {
          return `Page ${p.pageNumber}`;
        }
      }
      return 'Page 1';
    };

    // --- 1. COMMON PURCHASE / COMMERCIAL INVOICE EXTRACTION ---
    let productName = null;
    let category = null;
    let brand = null;
    let model = null;
    let serialNumber = null;
    let purchaseDate = null;
    let purchasePrice = null;
    let currency = 'INR';
    let sellerName = null;
    let sellerAddress = null;
    let sellerPhone = null;
    let invoiceNumber = null;
    let gstin = null;
    let cgst = null;
    let sgst = null;
    let igst = null;
    let taxInfo = null;

    // Brand detection
    const knownBrands = ['HP', 'Apple', 'Sony', 'Samsung', 'Dell', 'Lenovo', 'LG', 'Asus', 'OnePlus', 'Xiaomi', 'Boat', 'Bose'];
    for (const b of knownBrands) {
      const bRegex = new RegExp(`\\b${b}\\b`, 'i');
      if (bRegex.test(clean)) {
        brand = b;
        fieldConfidence.brand = { value: b, confidence: 0.95, source: findSourcePage(bRegex) };
        break;
      }
    }

    // Serial Number pattern
    const snRegex = /(?:serial\s*(?:no|number|#)?|s\/n|sr\.?\s*no\.?)[\s:]*([a-zA-Z0-9-]{6,24})/i;
    const snMatch = clean.match(snRegex);
    if (snMatch) {
      serialNumber = snMatch[1].trim();
      fieldConfidence.serialNumber = { value: serialNumber, confidence: 0.92, source: findSourcePage(snRegex) };
    }

    // Model pattern
    const modelRegex = /(?:model(?:\s*(?:no|number|#))?)[\s:]*([a-zA-Z0-9-_\s]{3,24})/i;
    const modelMatch = clean.match(modelRegex);
    if (modelMatch && modelMatch[1]) {
      const candidateModel = modelMatch[1].trim();
      if (!candidateModel.toLowerCase().includes('invoice') && !candidateModel.toLowerCase().includes('tax')) {
        model = candidateModel;
        fieldConfidence.model = { value: model, confidence: 0.88, source: findSourcePage(modelRegex) };
      }
    }

    // Currency Detection
    if (clean.includes('₹') || clean.match(/\b(?:INR|Rs\.?|Rupees)\b/i)) {
      currency = 'INR';
    }

    // Price extraction: Prioritize invoice grand total over itemized or transit charges
    const grandTotalRegex = /(?:total\s+price|grand\s+total|net\s+payable|total\s+amount|invoice\s+total)[\s:]*(?:₹|Rs\.?|INR)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/i;
    const gtMatch = clean.match(grandTotalRegex);
    if (gtMatch && gtMatch[1]) {
      const parsed = parseFloat(gtMatch[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        purchasePrice = parsed;
        fieldConfidence.purchasePrice = { value: purchasePrice, confidence: 0.98, source: findSourcePage(grandTotalRegex) };
      }
    }

    if (!purchasePrice) {
      const priceRegex = /(?:₹|Rs\.?|INR|¹|\b(?:Grand\s+)?Total[\s:]*(?:₹|Rs\.?|INR|¹)?|\bBase\s+Price[\s:]*(?:₹|Rs\.?|INR|¹)?|\bAmount[\s:]*(?:₹|Rs\.?|INR|¹)?)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/i;
      const priceMatch = clean.match(priceRegex);
      if (priceMatch && priceMatch[1]) {
        const parsed = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          purchasePrice = parsed;
          fieldConfidence.purchasePrice = { value: purchasePrice, confidence: 0.94, source: findSourcePage(priceRegex) };
        }
      }
    }

    // Invoice number
    const invRegex = /(?:invoice\s*(?:no|number|#)|inv\s*#)[\s:]*([a-zA-Z0-9-_/]+)/i;
    const invMatch = clean.match(invRegex);
    if (invMatch) {
      invoiceNumber = invMatch[1].trim();
      fieldConfidence.invoiceNumber = { value: invoiceNumber, confidence: 0.95, source: findSourcePage(invRegex) };
    }

    // Indian GSTIN
    const gstinRegex = /\b(?:GSTIN|GST(?:\s*(?:No|Number|#))?)[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i;
    const gstinMatch = clean.match(gstinRegex);
    if (gstinMatch) {
      gstin = gstinMatch[1].trim();
      fieldConfidence.gstin = { value: gstin, confidence: 0.98, source: findSourcePage(gstinRegex) };
      taxInfo = `GSTIN: ${gstin}`;
    }

    // CGST & SGST
    const cgstRegex = /\bCGST(?:\s*@\s*\d+(?:\.\d+)?%)?[:\s]*(?:₹|Rs\.?|INR|¹)?\s*([0-9,]+(?:\.[0-9]{2})?)/i;
    const cgstMatch = clean.match(cgstRegex);
    if (cgstMatch) {
      cgst = parseFloat(cgstMatch[1].replace(/,/g, ''));
      fieldConfidence.cgst = { value: cgst, confidence: 0.90, source: findSourcePage(cgstRegex) };
    }

    const sgstRegex = /\bSGST(?:\s*@\s*\d+(?:\.\d+)?%)?[:\s]*(?:₹|Rs\.?|INR|¹)?\s*([0-9,]+(?:\.[0-9]{2})?)/i;
    const sgstMatch = clean.match(sgstRegex);
    if (sgstMatch) {
      sgst = parseFloat(sgstMatch[1].replace(/,/g, ''));
      fieldConfidence.sgst = { value: sgst, confidence: 0.90, source: findSourcePage(sgstRegex) };
    }

    // Seller Name
    const soldByMatch = clean.match(/(?:sold\s+by|merchant|billed\s+from)[\s:]*\n*([A-Za-z0-9\s&,.-]{3,50})/i);
    if (soldByMatch && soldByMatch[1] && !soldByMatch[1].toLowerCase().includes('flipkart india') && !soldByMatch[1].toLowerCase().includes('tax invoice')) {
      sellerName = soldByMatch[1].replace(/^[,\s]+|[,\s]+$/g, '').trim();
      fieldConfidence.sellerName = { value: sellerName, confidence: 0.94, source: findSourcePage(sellerName) };
    } else {
      const sellerKeywords = ['Amazon', 'Flipkart', 'Croma', 'Reliance Digital', 'Vijay Sales', 'Apple Store', 'HP World'];
      for (const s of sellerKeywords) {
        if (clean.toLowerCase().includes(s.toLowerCase())) {
          sellerName = s;
          fieldConfidence.sellerName = { value: sellerName, confidence: 0.92, source: findSourcePage(s) };
          break;
        }
      }
    }

    // Date extraction: 10 Sep 2026, 2026-09-10, 10/09/2026
    const dateRegex = /\b(\d{1,2}[\s/-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[\s/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i;
    const dateMatch = clean.match(dateRegex);
    if (dateMatch) {
      try {
        const d = new Date(dateMatch[1]);
        if (!isNaN(d.getTime())) {
          purchaseDate = d.toISOString().split('T')[0];
          fieldConfidence.purchaseDate = { value: purchaseDate, confidence: 0.90, source: findSourcePage(dateRegex) };
        }
      } catch (err) {
        // Ignore unparseable date
      }
    }

    // Phone / Customer Care
    const phoneRegex = /\b(?:1800[-\s]?\d{3}[-\s]?\d{4}|\+?91[-\s]?\d{10}|\d{3,4}[-\s]?\d{3,4}[-\s]?\d{4})\b/;
    const phoneMatch = clean.match(phoneRegex);
    if (phoneMatch) {
      sellerPhone = phoneMatch[0];
      fieldConfidence.sellerPhone = { value: sellerPhone, confidence: 0.90, source: findSourcePage(phoneRegex) };
    }

    // Product Name derivation
    let candidateName = null;

    // Check for product line items in tables (e.g. after Product Description / Description of Goods)
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
      const addressLineRegex = /(?:godown|shivam estate|place of origin|destination|shipped\s+to|shipped\s+from|billed\s+to|billed\s+from|consignor|consignee|registration no|surat|nagercoil|tamil nadu|gujarat|pincode|industrial|logistic park)/i;
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

    if (tableProductCandidate) {
      candidateName = sanitizeName(tableProductCandidate);
      if (!brand && candidateName) {
        brand = candidateName.split(/\s+/)[0];
        fieldConfidence.brand = { value: brand, confidence: 0.85, source: findSourcePage(brand) };
      }
      if (!model) {
        const mMatch = tableProductCandidate.match(/(?:HAND-[A-Z0-9-]+|[A-Z0-9]{3,}-[A-Z0-9]+)/i);
        if (mMatch) {
          model = mMatch[0].trim();
          fieldConfidence.model = { value: model, confidence: 0.88, source: findSourcePage(model) };
        }
      }
    } else if (brand && model) {
      candidateName = `${brand} ${model}`;
    } else if (brand) {
      candidateName = `${brand} Device`;
    } else {
      const nonProductHeaders = /^(tax\s+invoice|invoice|receipt|bill\s+of\s+supply|order\s+details|cash\s+receipt|shipping\s+slip|delivery\s+challan|date|seller|total|amount|customer|page|original|duplicate|triplicate|godown|destination|consignor|consignee|shipped|billed|declaration)\b/i;
      const addressLineRegex = /(?:godown|shivam estate|place of origin|destination|shipped\s+to|shipped\s+from|billed\s+to|billed\s+from|consignor|consignee|registration no|surat|nagercoil|tamil nadu|gujarat|pincode)/i;
      const plausibleLine = lines.find((l) => l.length >= 3 && l.length <= 80 && !nonProductHeaders.test(l) && !addressLineRegex.test(l) && !paginationRegex.test(l));
      if (plausibleLine) {
        candidateName = sanitizeName(plausibleLine);
      }
    }

    if (candidateName && !paginationRegex.test(candidateName)) {
      productName = candidateName;
      fieldConfidence.productName = { value: productName, confidence: brand ? 0.90 : 0.70, source: findSourcePage(productName) };
    } else {
      productName = null;
      fieldConfidence.productName = { value: null, confidence: 0, source: 'Not in text layer' };
    }

    // Category deduction
    const allContext = `${clean} ${productName || ''}`.toLowerCase();
    if (allContext.match(/\b(bird\s+house|bird\s+nest|furniture|sofa|chair|table|bed|mattress|decor|wooden|shelf|cabinet)\b/)) {
      category = 'Home & Furniture';
    } else if (allContext.match(/\b(refrigerator|fridge|washing\s+machine|microwave|oven|vacuum|ac|air\s+conditioner|heater|purifier)\b/)) {
      category = 'Appliances';
    } else if (allContext.match(/\b(laptop|desktop|monitor|keyboard|mouse|printer|router|tablet|ipad|macbook|ram|ssd|hard\s+disk)\b/)) {
      category = 'Computing';
    } else if (allContext.match(/\b(headphone|earphone|audio|speaker|tv|television|camera|smartwatch|watch|earbuds|soundbar|mobile|phone|smartphone)\b/)) {
      category = 'Electronics';
    } else if (allContext.match(/\b(car|bike|motorcycle|tyre|tire|helmet|dashcam)\b/)) {
      category = 'Automotive';
    } else if (allContext.match(/\b(shirt|shoes|dress|tshirt|jeans|jacket|clothing|sunglasses)\b/)) {
      category = 'Personal & Apparel';
    } else if (allContext.match(/\b(drill|wrench|hammer|screwdriver|tool\s+kit|saw)\b/)) {
      category = 'Tools & Hardware';
    } else if (allContext.match(/\b(bicycle|cycle|treadmill|dumbbell|fitness|tent|yoga)\b/)) {
      category = 'Sports & Outdoors';
    } else {
      category = 'Electronics';
    }

    // --- 2. TYPE-SPECIFIC FIELD EXTRACTION ---
    const warrantyData = {
      hasWarranty: false,
      durationMonths: null,
      warrantyStartDate: purchaseDate,
      warrantyEndDate: null,
      warrantyProvider: brand ? `${brand} India` : null,
      warrantyType: 'Manufacturer',
      warrantyTerms: null,
      exclusions: [],
      claimProcedure: null,
      supportContact: sellerPhone,
      serviceCenterInformation: null,
    };

    const serviceInvoiceData = {
      serviceProvider: sellerName,
      serviceCenter: null,
      serviceDate: purchaseDate,
      issue: null,
      serviceType: 'GENERAL_SERVICE',
      partsCost: null,
      laborCost: null,
      warrantyClaimReference: null,
    };

    const insuranceData = {
      insuredProduct: productName,
      insurer: null,
      policyNumber: null,
      startDate: purchaseDate,
      endDate: null,
      coverage: null,
      premium: purchasePrice,
      claimContact: sellerPhone,
    };

    const manualData = {
      modelNumber: model,
      installation: null,
      maintenance: null,
      safety: null,
      supportUrl: null,
    };

    // Specific logic for WARRANTY document type
    if (docType === 'WARRANTY') {
      warrantyData.hasWarranty = true;
      warrantyData.warrantyType = 'Manufacturer Limited';

      const durRegex = /(\d+)\s*(?:year|yr|month|mth)s?\s*warranty/i;
      const durMatch = clean.match(durRegex);
      if (durMatch) {
        const num = parseInt(durMatch[1], 10);
        warrantyData.durationMonths = clean.toLowerCase().includes('year') ? num * 12 : num;
        fieldConfidence.warrantyDuration = { value: `${warrantyData.durationMonths} months`, confidence: 0.92, source: findSourcePage(durRegex) };
      }

      if (clean.toLowerCase().includes('accidental damage')) {
        warrantyData.exclusions.push('Accidental damage not covered unless ADP plan purchased');
      }
      if (clean.toLowerCase().includes('water damage') || clean.toLowerCase().includes('liquid')) {
        warrantyData.exclusions.push('Liquid ingress and water damage excluded');
      }

      const claimRegex = /(?:how to claim|claim procedure|to initiate a claim)[\s:]*([^\n.]+)/i;
      const claimMatch = clean.match(claimRegex);
      if (claimMatch) {
        warrantyData.claimProcedure = claimMatch[1].trim();
        fieldConfidence.claimProcedure = { value: warrantyData.claimProcedure, confidence: 0.88, source: findSourcePage(claimRegex) };
      }
    }

    // Specific logic for SERVICE_INVOICE document type
    if (docType === 'SERVICE_INVOICE') {
      const issueRegex = /(?:fault|problem|issue|reported complaint)[\s:]*([^\n.]+)/i;
      const issueMatch = clean.match(issueRegex);
      if (issueMatch) {
        serviceInvoiceData.issue = issueMatch[1].trim();
        fieldConfidence.serviceIssue = { value: serviceInvoiceData.issue, confidence: 0.88, source: findSourcePage(issueRegex) };
      }

      const clmRefRegex = /(?:claim\s*(?:ref|reference|#)|rma\s*#)[\s:]*([a-zA-Z0-9-]+)/i;
      const clmRefMatch = clean.match(clmRefRegex);
      if (clmRefMatch) {
        serviceInvoiceData.warrantyClaimReference = clmRefMatch[1].trim();
        fieldConfidence.warrantyClaimReference = { value: serviceInvoiceData.warrantyClaimReference, confidence: 0.95, source: findSourcePage(clmRefRegex) };
      }
    }

    // Specific logic for INSURANCE document type
    if (docType === 'INSURANCE') {
      const polRegex = /(?:policy\s*(?:no|number|#))[\s:]*([a-zA-Z0-9-_]+)/i;
      const polMatch = clean.match(polRegex);
      if (polMatch) {
        insuranceData.policyNumber = polMatch[1].trim();
        fieldConfidence.policyNumber = { value: insuranceData.policyNumber, confidence: 0.95, source: findSourcePage(polRegex) };
      }
    }

    // Identify missing important fields based on document type
    if (['RECEIPT', 'INVOICE', 'PURCHASE_ORDER'].includes(docType)) {
      if (!serialNumber) missingFields.push('Hardware Serial Number (S/N)');
      if (!model) missingFields.push('Product Model Number');
      if (!purchaseDate) missingFields.push('Purchase Date');
      if (!purchasePrice) missingFields.push('Total Amount');
    } else if (docType === 'WARRANTY') {
      if (!serialNumber) missingFields.push('Covered Serial Number');
      if (!warrantyData.durationMonths) missingFields.push('Warranty Duration Period');
      if (!warrantyData.claimProcedure) missingFields.push('Claim Procedure Helpline');
    } else if (docType === 'SERVICE_INVOICE') {
      if (!serviceInvoiceData.issue) missingFields.push('Reported Defect / Issue');
      if (!purchasePrice) missingFields.push('Service Cost / Bill Amount');
    }

    return {
      productName,
      productDescription: null,
      products: productName ? [{ productName, brand, model, purchasePrice, quantity: 1, productDescription: null }] : [],
      category: category || 'Electronics',
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchasePrice,
      currency,
      sellerName,
      sellerAddress,
      sellerPhone,
      invoiceNumber,
      gstin,
      cgst,
      sgst,
      igst,
      taxInfo,
      warranty: warrantyData,
      serviceInvoice: serviceInvoiceData,
      insurance: insuranceData,
      manual: manualData,
      fieldConfidence,
      missingFields,
    };
  }

  /**
   * Intelligently match an uploaded document against the user's existing physical products.
   */
  async matchDocumentToProducts(userId, extractedData) {
    try {
      const userProducts = await Product.find({ userId }).lean();
      if (!userProducts || userProducts.length === 0) {
        return {
          productId: null,
          confidence: 0,
          matchReason: 'No existing products in account',
          matchType: 'NONE',
          candidateProducts: [],
        };
      }

      const { serialNumber, model, brand, invoiceNumber, purchaseDate } = extractedData;
      const scoredCandidates = [];

      for (const prod of userProducts) {
        let score = 0;
        const reasons = [];

        // 1. Exact Serial Number Match (Definitive 100 points)
        if (serialNumber && prod.serialNumber && prod.serialNumber.trim().toLowerCase() === serialNumber.trim().toLowerCase()) {
          score += 100;
          reasons.push(`Exact Hardware Serial Match (${serialNumber})`);
        }

        // 2. Invoice Number Match (High 75 points)
        if (invoiceNumber && prod.notes && prod.notes.toLowerCase().includes(invoiceNumber.toLowerCase())) {
          score += 75;
          reasons.push(`Invoice Number Reference (${invoiceNumber})`);
        }

        // 3. Model Match (40 points)
        if (model && prod.model && prod.model.trim().toLowerCase() === model.trim().toLowerCase()) {
          score += 40;
          reasons.push(`Model Match (${model})`);
        }

        // 4. Brand Match (20 points)
        if (brand && prod.brand && prod.brand.trim().toLowerCase() === brand.trim().toLowerCase()) {
          score += 20;
          reasons.push(`Brand Match (${brand})`);
        }

        // 5. Purchase Date Match (15 points)
        if (purchaseDate && prod.purchaseDate) {
          const pDate = new Date(prod.purchaseDate).toISOString().split('T')[0];
          if (pDate === purchaseDate) {
            score += 15;
            reasons.push(`Matching Purchase Date (${purchaseDate})`);
          }
        }

        if (score >= 40) {
          scoredCandidates.push({
            productId: prod._id,
            productName: prod.productName,
            brand: prod.brand,
            model: prod.model,
            serialNumber: prod.serialNumber,
            score,
            reason: reasons.join('; '),
          });
        }
      }

      // Sort candidates descending by score
      scoredCandidates.sort((a, b) => b.score - a.score);

      if (scoredCandidates.length === 0) {
        return {
          productId: null,
          confidence: 0,
          matchReason: 'No strong match found among registered products',
          matchType: 'NONE',
          candidateProducts: [],
        };
      }

      const top = scoredCandidates[0];

      // Exact match if score >= 100 or single high score candidate
      if (top.score >= 100 || (scoredCandidates.length === 1 && top.score >= 60)) {
        return {
          productId: top.productId,
          confidence: Math.min(1.0, top.score / 100),
          matchReason: top.reason,
          matchType: 'EXACT',
          candidateProducts: scoredCandidates,
        };
      }

      // Multiple candidates or moderate ambiguity
      return {
        productId: top.productId,
        confidence: top.score / 100,
        matchReason: `Multiple potential candidates found. Best match: ${top.productName}`,
        matchType: 'MULTIPLE',
        candidateProducts: scoredCandidates,
      };
    } catch (err) {
      console.error('[Product Matching Error]', err);
      return {
        productId: null,
        confidence: 0,
        matchReason: 'Matching failed',
        matchType: 'NONE',
        candidateProducts: [],
      };
    }
  }

  /**
   * Detect duplicate documents in user's vault by file hash or invoice number.
   */
  async detectDuplicateDocument(userId, fileHash, extractedData, currentDocId = null) {
    try {
      if (!userId) return { isDuplicate: false };

      // Check 1: SHA-256 Binary File Hash Match
      if (fileHash) {
        const hashMatch = await Document.findOne({
          userId,
          fileHash,
          _id: { $ne: currentDocId },
        }).lean();

        if (hashMatch) {
          return {
            isDuplicate: true,
            originalDocumentId: hashMatch._id,
            duplicateReason: `Exact duplicate file content already uploaded (${hashMatch.fileName})`,
          };
        }
      }

      // Check 2: Same Invoice Number & Seller
      if (extractedData.invoiceNumber && extractedData.sellerName) {
        const invMatch = await Document.findOne({
          userId,
          _id: { $ne: currentDocId },
          'extractedData.invoiceNumber': extractedData.invoiceNumber,
          'extractedData.sellerName': extractedData.sellerName,
        }).lean();

        if (invMatch) {
          return {
            isDuplicate: true,
            originalDocumentId: invMatch._id,
            duplicateReason: `Document with same invoice number (#${extractedData.invoiceNumber}) from ${extractedData.sellerName} already exists in your vault`,
          };
        }
      }

      return { isDuplicate: false, originalDocumentId: null, duplicateReason: null };
    } catch (err) {
      console.warn(`[Duplicate Check Warning] ${err.message}`);
      return { isDuplicate: false };
    }
  }

  /**
   * Cross-reference extracted document data against an existing product record to detect conflicts.
   */
  detectConflicts(existingProduct, extractedData) {
    if (!existingProduct) return [];
    const conflicts = [];

    // Serial Number Conflict
    if (
      extractedData.serialNumber &&
      existingProduct.serialNumber &&
      extractedData.serialNumber.trim().toLowerCase() !== existingProduct.serialNumber.trim().toLowerCase()
    ) {
      conflicts.push({
        field: 'serialNumber',
        documentValue: extractedData.serialNumber,
        existingValue: existingProduct.serialNumber,
        existingSource: 'PRODUCT_RECORD',
        explanation: `Document lists serial number "${extractedData.serialNumber}" which differs from registered product serial "${existingProduct.serialNumber}".`,
      });
    }

    // Purchase Price Conflict
    if (
      extractedData.purchasePrice &&
      existingProduct.purchasePrice &&
      Math.abs(extractedData.purchasePrice - existingProduct.purchasePrice) > 5
    ) {
      conflicts.push({
        field: 'purchasePrice',
        documentValue: extractedData.purchasePrice,
        existingValue: existingProduct.purchasePrice,
        existingSource: 'PRODUCT_RECORD',
        explanation: `Document shows amount ${formatINR(extractedData.purchasePrice)} but registered purchase price is ${formatINR(existingProduct.purchasePrice)}.`,
      });
    }

    // Purchase Date Conflict
    if (extractedData.purchaseDate && existingProduct.purchaseDate) {
      const docDate = extractedData.purchaseDate;
      const prodDate = new Date(existingProduct.purchaseDate).toISOString().split('T')[0];
      if (docDate !== prodDate) {
        conflicts.push({
          field: 'purchaseDate',
          documentValue: docDate,
          existingValue: prodDate,
          existingSource: 'PRODUCT_RECORD',
          explanation: `Document states date ${formatDateIN(docDate)} while product has ${formatDateIN(prodDate)}.`,
        });
      }
    }

    return conflicts;
  }
}

export default new DocumentIntelligenceService();
