import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api/v1';

async function testBirdNestUpload() {
  console.log('--- Testing Document Upload & Extraction with bird_nest.pdf ---');

  const email = 'testuser@example.com';
  const password = 'TestPassword123!';

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginData = await loginRes.json();
  const token = loginData.data?.token;
  console.log('Login status:', loginRes.status, 'Token exists:', Boolean(token));

  const form = new FormData();
  const pdfPath = path.resolve('bird_nest.pdf');
  const fileBuffer = fs.readFileSync(pdfPath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  form.append('document', blob, 'bird_nest.pdf');
  form.append('documentType', 'RECEIPT');

  console.log('Uploading bird_nest.pdf at', new Date().toISOString(), '...');
  const tStart = Date.now();
  try {
    const uploadRes = await fetch(`${BASE_URL}/documents/upload-and-extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
      signal: AbortSignal.timeout(90000),
    });

    const elapsed = Date.now() - tStart;
    const result = await uploadRes.json();
    console.log('Structured Fields:', JSON.stringify(result.data?.extractedData, null, 2));
    console.log('AI Extraction:', JSON.stringify(result.data.aiExtraction, null, 2));
  } catch (err) {
    console.error(`Upload error after ${Date.now() - tStart}ms:`, err);
  }
}

testBirdNestUpload().catch(console.error);
