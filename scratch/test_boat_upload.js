import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api/v1';

async function testUpload() {
  console.log('--- Testing Document Upload & Extraction with boat_headphone.pdf ---');

  // 1. Authenticate with test credentials
  const email = 'testuser@example.com';
  const password = 'TestPassword123!';

  let loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  let token = null;
  if (loginRes.ok) {
    const data = await loginRes.json();
    token = data.data.token;
    console.log('Logged in successfully as:', email);
  } else {
    // Register if user doesn't exist
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email,
        password,
      }),
    });
    if (regRes.ok) {
      const data = await regRes.json();
      token = data.data.token;
      console.log('Registered & logged in as:', email);
    } else {
      console.error('Failed to log in or register:', await regRes.text());
      process.exit(1);
    }
  }

  // 2. Upload boat_headphone.pdf using native FormData and Blob
  const form = new FormData();
  const pdfPath = path.resolve('boat_headphone.pdf');
  const fileBuffer = fs.readFileSync(pdfPath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  form.append('document', blob, 'boat_headphone.pdf');
  form.append('documentType', 'RECEIPT');

  console.log('Uploading boat_headphone.pdf...');
  const uploadRes = await fetch(`${BASE_URL}/documents/upload-and-extract`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const uploadStatus = uploadRes.status;
  const result = await uploadRes.json();

  console.log('Upload HTTP Status:', uploadStatus);
  if (!uploadRes.ok) {
    console.error('Upload failed:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const doc = result.data.document;
  const ext = result.data.extractedData;

  console.log('\n================ EXTRACTION VERIFICATION RESULTS ================');
  console.log('1. Product Name:', ext.productName);
  console.log('   Is NOT "-- 1 of 1 --":', ext.productName !== '-- 1 of 1 --' && !ext.productName.includes('1 of 1'));
  console.log('2. Product Description:', ext.productDescription ? ext.productDescription.slice(0, 70) + '...' : 'null');
  console.log('3. Brand:', ext.brand);
  console.log('4. Model:', ext.model);
  console.log('5. Purchase Price:', ext.purchasePrice, '(Is null / Not in document:', ext.purchasePrice === null, ')');
  console.log('6. Currency:', ext.currency);
  console.log('7. AI Provider:', result.data.aiProvider, '| AI Model:', doc.aiModelUsed);
  console.log('8. Multiple Products Array Count:', ext.products?.length || 0);
  if (ext.products?.length) {
    ext.products.forEach((p, i) => console.log(`   Product [${i+1}]:`, p.productName, '| Price:', p.purchasePrice));
  }
  console.log('9. Confidence Scores:', JSON.stringify(doc.fieldConfidence?.productName || ext.confidence?.productName));
  console.log('=================================================================\n');

  // Verify assertions
  const isProductNameCorrect = ext.productName && ext.productName.toLowerCase().includes('rockerz 650 pro');
  const isNotPagination = ext.productName !== '-- 1 of 1 --' && !ext.productName.includes('1 of 1');
  const isPriceNull = ext.purchasePrice === null;
  const isCurrencyINR = ext.currency === 'INR';
  const isBrandCorrect = ext.brand && ext.brand.toLowerCase() === 'boat';

  console.log('VERIFICATION SUMMARY:');
  console.log('✓ Product Name identifies boAt Rockerz 650 Pro:', isProductNameCorrect ? 'PASS' : 'FAIL');
  console.log('✓ Product Name is NOT pagination (-- 1 of 1 --):', isNotPagination ? 'PASS' : 'FAIL');
  console.log('✓ Brand identified as boAt:', isBrandCorrect ? 'PASS' : 'FAIL');
  console.log('✓ Purchase Price is null (Not in document):', isPriceNull ? 'PASS' : 'FAIL');
  console.log('✓ Currency is INR:', isCurrencyINR ? 'PASS' : 'FAIL');

  if (isProductNameCorrect && isNotPagination && isPriceNull && isCurrencyINR) {
    console.log('\n>>> ALL TARGETED REQUIREMENTS FOR DOCUMENT EXTRACTION PASSED! <<<');
    process.exit(0);
  } else {
    console.error('\n>>> SOME ASSERTIONS FAILED <<<');
    process.exit(1);
  }
}

testUpload().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
