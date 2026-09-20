import fs from 'fs';
import path from 'path';
import { extractRawText } from '../backend/src/services/aiExtractionService.js';
import documentIntelligenceService from '../backend/src/services/documentIntelligenceService.js';
import env from '../backend/src/config/env.js';

async function inspectBirdNest() {
  console.log('=== Inspecting bird_nest.pdf ===');
  const filePath = path.resolve('bird_nest.pdf');
  const stat = fs.statSync(filePath);
  console.log(`File size: ${(stat.size / 1024).toFixed(2)} KB`);

  console.log('\n[Stage 1: extractRawText / pdf-parse]');
  const t0 = Date.now();
  const rawText = await extractRawText(filePath, 'application/pdf');
  console.log(`extractRawText took: ${Date.now() - t0}ms`);
  console.log(`Extracted rawText length: ${rawText.length}`);
  console.log(`Extracted rawText sample:\n${rawText.slice(0, 500)}`);

  console.log('\n[Stage 2: documentIntelligenceService.extractMultiPageText]');
  const t1 = Date.now();
  const multiPage = await documentIntelligenceService.extractMultiPageText(filePath, 'application/pdf');
  console.log(`extractMultiPageText took: ${Date.now() - t1}ms`);
  console.log(`Pages: ${multiPage.pageCount}, fullText length: ${multiPage.fullText?.length}`);
  console.log(`fullText sample:\n${multiPage.fullText?.slice(0, 500)}`);

  console.log('\n[Stage 3: Testing Gemini with bird_nest.pdf]');
  const GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
  const fileBuffer = fs.readFileSync(filePath);
  const parts = [
    { text: 'Extract structured product and purchase details from this document. If not found, return null.' },
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: fileBuffer.toString('base64'),
      }
    }
  ];

  for (const model of GEMINI_MODELS) {
    console.log(`\nTesting Gemini Model: ${model}...`);
    const tStart = Date.now();
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });
      console.log(`Status: ${res.status} in ${Date.now() - tStart}ms`);
      const body = await res.text();
      console.log(`Response body (first 300 chars): ${body.slice(0, 300)}`);
      break;
    } catch (err) {
      console.error(`Model ${model} failed in ${Date.now() - tStart}ms: ${err.message}`);
    }
  }
}

inspectBirdNest().catch(console.error);
