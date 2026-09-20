import fs from 'fs';
import path from 'path';
import env from '../backend/src/config/env.js';
import documentIntelligenceService from '../backend/src/services/documentIntelligenceService.js';

async function testGeminiModels() {
  const filePath = path.resolve('bird_nest.pdf');
  const fileBuffer = fs.readFileSync(filePath);
  const { fullText } = await documentIntelligenceService.extractMultiPageText(filePath, 'application/pdf');

  const models = [
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
  ];

  console.log(`Document text length: ${fullText.length} chars`);

  for (const model of models) {
    console.log(`\n================ Testing ${model} ================`);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    // Test 1: with text content
    const t0 = Date.now();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Extract product purchase details as JSON:\n${fullText}` }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      console.log(`[Text Only] Model ${model} returned HTTP ${res.status} in ${Date.now() - t0}ms`);
      if (res.ok) {
        const data = await res.json();
        console.log('Result:', data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 300));
      } else {
        console.log('Error:', (await res.text()).slice(0, 300));
      }
    } catch (e) {
      console.log(`[Text Only] Failed in ${Date.now() - t0}ms: ${e.message}`);
    }

    // Test 2: with inlineData (binary PDF base64)
    const t1 = Date.now();
    try {
      const res2 = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract product purchase details as JSON from this PDF document:' },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: fileBuffer.toString('base64'),
                }
              }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      console.log(`[Binary PDF] Model ${model} returned HTTP ${res2.status} in ${Date.now() - t1}ms`);
      if (res2.ok) {
        const data = await res2.json();
        console.log('Result:', data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 300));
      } else {
        console.log('Error:', (await res2.text()).slice(0, 300));
      }
    } catch (e) {
      console.log(`[Binary PDF] Failed in ${Date.now() - t1}ms: ${e.message}`);
    }
  }
}

testGeminiModels().catch(console.error);
