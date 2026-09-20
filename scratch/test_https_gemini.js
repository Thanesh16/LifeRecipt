import https from 'https';
import fs from 'fs';
import path from 'path';
import env from '../backend/src/config/env.js';
import documentIntelligenceService from '../backend/src/services/documentIntelligenceService.js';

async function testHttpsRequest() {
  const filePath = path.resolve('bird_nest.pdf');
  const { fullText } = await documentIntelligenceService.extractMultiPageText(filePath, 'application/pdf');

  const prompt = `
Extract structured purchase details from this document text as JSON:
{
  "productName": string,
  "brand": string,
  "model": string,
  "purchasePrice": number,
  "currency": "INR",
  "sellerName": string,
  "invoiceNumber": string,
  "taxInfo": string
}
Document Text:
${fullText}
`;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 60000,
  };

  console.log('Sending https request to Gemini at', new Date().toISOString());
  const t0 = Date.now();

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`HTTPS Status: ${res.statusCode} in ${Date.now() - t0}ms`);
      try {
        const json = JSON.parse(data);
        console.log('Gemini Result:\n', json.candidates?.[0]?.content?.parts?.[0]?.text);
      } catch (e) {
        console.log('Raw data:', data.slice(0, 300));
      }
    });
  });

  req.on('error', (e) => {
    console.error(`HTTPS Error after ${Date.now() - t0}ms:`, e);
  });

  req.on('timeout', () => {
    req.destroy(new Error('HTTPS request timed out after 60s'));
  });

  req.write(payload);
  req.end();
}

testHttpsRequest().catch(console.error);
