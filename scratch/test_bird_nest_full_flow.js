import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api/v1';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('=== Step 1: User Login / Session ===');
  // Register or login a test user
  const email = `test_flow_${Date.now()}@test.lifereceipt.com`;
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Auditor',
      email,
      password: 'Password123!',
    }),
  });
  const regData = await regRes.json();
  assert(regRes.status === 201 || regData.success, 'Test user registered successfully');
  const token = regData.data?.token || regData.token;
  assert(Boolean(token), 'JWT token acquired');

  console.log('\n=== Step 2: Upload and Extract bird_nest.pdf ===');
  const filePath = path.resolve('bird_nest.pdf');
  const fileBytes = fs.readFileSync(filePath);
  const blob = new Blob([fileBytes], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('document', blob, 'bird_nest.pdf');
  formData.append('documentType', 'RECEIPT'); // Test with default RECEIPT to verify AI detects INVOICE

  const t0 = Date.now();
  const upRes = await fetch(`${BASE_URL}/documents/upload-and-extract`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const upData = await upRes.json();
  console.log(`Upload completed in ${Date.now() - t0}ms, status: ${upRes.status}`);
  assert(upData.success, 'Document uploaded and extracted successfully');

  const { classification, extractedData, document: docRecord } = upData.data;

  console.log('Classification:', classification);
  assert(classification.detectedType === 'INVOICE', `AI classified document as INVOICE (got: ${classification.detectedType})`);
  assert(classification.confidence >= 0.80, `Classification confidence >= 80% (got: ${Math.round(classification.confidence * 100)}%)`);

  console.log('Extracted Data:', {
    productName: extractedData.productName,
    category: extractedData.category,
    brand: extractedData.brand,
    model: extractedData.model,
    purchasePrice: extractedData.purchasePrice,
    currency: extractedData.currency,
    sellerName: extractedData.sellerName,
    invoiceNumber: extractedData.invoiceNumber,
    taxInfo: extractedData.taxInfo,
  });

  // Verify product name has NO address pollution
  assert(
    !extractedData.productName.includes('Godown') &&
    !extractedData.productName.includes('Shivam Estate') &&
    !extractedData.productName.includes('Saroli') &&
    !extractedData.productName.includes('Place of Origin'),
    'Product name does NOT contain address / godown headers'
  );

  assert(
    extractedData.productName.includes('Avirox') && extractedData.productName.includes('Bird House'),
    `Product name is authentic: "${extractedData.productName}"`
  );

  assert(extractedData.category === 'Home & Furniture', `Category is 'Home & Furniture' (got: ${extractedData.category})`);
  assert(extractedData.brand === 'Avirox', `Brand is 'Avirox' (got: ${extractedData.brand})`);
  assert(extractedData.model === 'HAND-BH-07', `Model is 'HAND-BH-07' (got: ${extractedData.model})`);
  assert(extractedData.purchasePrice === 261, `Purchase price is ₹261 (got: ${extractedData.purchasePrice})`);
  assert(extractedData.currency === 'INR', `Currency is INR (got: ${extractedData.currency})`);
  assert(extractedData.invoiceNumber === 'LWAA3WP270000290', `Invoice number is 'LWAA3WP270000290' (got: ${extractedData.invoiceNumber})`);
  assert(extractedData.taxInfo && extractedData.taxInfo.includes('24DSQPK2457A1ZU'), `Tax info includes GSTIN (got: ${extractedData.taxInfo})`);

  console.log('\n=== Step 3: Simulate User Editing & Confirming in Review Modal ===');
  const documentId = docRecord._id;
  const editedPayload = {
    productName: extractedData.productName,
    category: extractedData.category,
    brand: extractedData.brand,
    model: extractedData.model,
    serialNumber: 'BH-SR-998811',
    purchasePrice: extractedData.purchasePrice,
    currency: extractedData.currency,
    purchaseDate: extractedData.purchaseDate || '2026-05-19',
    sellerName: extractedData.sellerName,
    invoiceNumber: extractedData.invoiceNumber,
    documentType: 'INVOICE',
    warranty: {
      hasWarranty: true,
      warrantyProvider: 'Avirox India',
      warrantyType: 'Manufacturer',
      warrantyStartDate: '2026-05-19',
      warrantyEndDate: '2027-05-19',
    },
    returnInfo: {
      returnEligible: false,
    },
    notes: 'Verified end-to-end extraction with INR currency compliance',
    status: 'Active',
  };

  const confRes = await fetch(`${BASE_URL}/documents/confirm-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      documentId,
      productData: editedPayload,
    }),
  });

  const confData = await confRes.json();
  assert(confData.success, 'Product confirmed and saved successfully');
  const createdProduct = confData.data?.product;
  const updatedDoc = confData.data?.document;

  assert(createdProduct?._id, 'Product record created with valid ID');
  assert(createdProduct.productName === 'Avirox HAND-BH-07 Bird House', 'Product name persisted in DB');
  assert(createdProduct.category === 'Home & Furniture', 'Category persisted as Home & Furniture in DB');
  assert(createdProduct.brand === 'Avirox', 'Brand persisted in DB');
  assert(createdProduct.model === 'HAND-BH-07', 'Model persisted in DB');
  assert(createdProduct.serialNumber === 'BH-SR-998811', 'Serial number edited by user persisted in DB');
  assert(createdProduct.purchasePrice === 261, 'Purchase price 261 persisted in DB');
  assert(createdProduct.currency === 'INR', 'Currency INR persisted in DB');
  assert(createdProduct.warranty?.hasWarranty === true, 'Warranty active flag persisted in DB');
  assert(createdProduct.warranty?.warrantyProvider === 'Avirox India', 'Warranty provider persisted in DB');

  assert(updatedDoc?.productId === createdProduct._id, 'Document linked to created product ID in DB');
  assert(updatedDoc?.documentType === 'INVOICE', 'Document type updated to INVOICE in DB');
  assert(updatedDoc?.status === 'CONFIRMED', 'Document status updated to CONFIRMED in DB');

  console.log('\n=== Step 4: Fetch Product Detail (Verification for ProductDetailPage) ===');
  const detailRes = await fetch(`${BASE_URL}/products/${createdProduct._id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const detailData = await detailRes.json();
  assert(detailData.success, 'Product detail fetched successfully');
  const productDetail = detailData.data?.product || detailData.data;
  assert(productDetail?.productName === 'Avirox HAND-BH-07 Bird House', 'Detail returns correct product name');
  assert(productDetail?.currency === 'INR', 'Detail returns currency INR');
  assert(productDetail?.purchasePrice === 261, 'Detail returns purchase price 261');

  console.log('\n=== Summary ===');
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
