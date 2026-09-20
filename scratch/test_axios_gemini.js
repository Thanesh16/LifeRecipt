import axios from '../backend/node_modules/axios/index.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import env from '../backend/src/config/env.js';
import documentIntelligenceService from '../backend/src/services/documentIntelligenceService.js';

async function testAxiosGemini() {
  const filePath = path.resolve('bird_nest.pdf');
  const { fullText } = await documentIntelligenceService.extractMultiPageText(filePath, 'application/pdf');

  const prompt = `
You are an expert financial and product ownership data extraction engine for the LIFERECEIPT platform.
Analyze this document and extract structured product and purchase details.

CRITICAL PRODUCT & PRICING RULES:
1. PRODUCT NAME & DESCRIPTION:
   - Extract the authentic, concise product name (e.g. "Avirox HAND-BH-07 Bird House").
   - NEVER use pagination text (e.g. "-- 1 of 3 --", "1 of 2", "Page 1 of 3").
   - NEVER use printer headers/footers, delivery addresses, consignor/consignee labels.
   - If the document contains both a product name and description/specs, keep "productName" clean and concise.
2. PURCHASE PRICE:
   - ONLY extract "purchasePrice" if an explicit purchase price, unit price, or monetary total is stated in the document.
   - If NO purchase price is present in the document, return null. NEVER invent ₹0 or $0 or hallucinate an amount.
3. REGIONAL & TAX RULES:
   - The operating region is INDIA. Default currency is "INR" (₹) unless explicitly stated otherwise.
   - Extract Indian tax details into "taxInfo" when present: GSTIN, CGST, SGST, IGST.
4. WARRANTY:
   - Only extract warranty if mentioned. If absent, set hasWarranty to false and durationMonths to null.
5. Return ONLY a valid JSON object matching this schema:
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
  "taxInfo": string or null
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
  const t0 = Date.now();
  console.log('Sending axios request to Gemini at', new Date().toISOString());

  const httpsAgent = new https.Agent({
    keepAlive: true,
    timeout: 60000,
  });

  const response = await axios.post(
    url,
    {
      contents: [{
        parts: [
          { text: prompt },
          { text: `Document Text Content:\n${fullText}` }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
      httpsAgent,
    }
  );

  console.log(`Axios status: ${response.status} in ${Date.now() - t0}ms`);
  const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('Result:\n', rawText);
}

testAxiosGemini().catch((err) => {
  console.error('Axios error:', err.message, err.response?.data || '');
});
