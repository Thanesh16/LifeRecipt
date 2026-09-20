import fs from 'fs';
import path from 'path';
import { Agent, setGlobalDispatcher } from 'undici';
import env from '../backend/src/config/env.js';
import documentIntelligenceService from '../backend/src/services/documentIntelligenceService.js';

// Configure global undici dispatcher with 60s connect and header timeouts
setGlobalDispatcher(new Agent({
  connect: {
    timeout: 60000,
  },
  headersTimeout: 60000,
  bodyTimeout: 60000,
}));

async function testBirdNestExtraction() {
  const filePath = path.resolve('bird_nest.pdf');
  const { fullText } = await documentIntelligenceService.extractMultiPageText(filePath, 'application/pdf');

  const prompt = `
You are an expert financial and product ownership data extraction engine for the LIFERECEIPT platform.
Extract structured product details from this document text.
Output JSON matching:
{
  "productName": string or null,
  "productDescription": string or null,
  "category": "Electronics" | "Appliances" | "Automotive" | "Home & Furniture" | "Computing" | "Personal & Apparel" | "Tools & Hardware" | "Sports & Outdoors" | "Other" or null,
  "brand": string or null,
  "model": string or null,
  "purchasePrice": number or null,
  "currency": "INR",
  "sellerName": string or null,
  "invoiceNumber": string or null,
  "taxInfo": string or null
}
`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
  const t0 = Date.now();
  console.log('Sending request to Gemini at', new Date().toISOString());
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { text: `Document Text:\n${fullText}` }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    console.log(`Gemini response status: ${res.status} in ${Date.now() - t0}ms`);
    const data = await res.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('Result:\n', resultText);
  } catch (err) {
    console.error(`Error after ${Date.now() - t0}ms:`, err);
  }
}

testBirdNestExtraction().catch(console.error);
