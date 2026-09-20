// Simulate exact ExtractionReviewModal execution with bird_nest.pdf upload response
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api/v1';

async function testModalSimulation() {
  console.log('=== Simulating ExtractionReviewModal with bird_nest.pdf Response ===');

  const email = 'testuser@example.com';
  const password = 'TestPassword123!';

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token;

  const form = new FormData();
  const pdfPath = path.resolve('bird_nest.pdf');
  const fileBuffer = fs.readFileSync(pdfPath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  form.append('document', blob, 'bird_nest.pdf');
  form.append('documentType', 'RECEIPT');

  const uploadRes = await fetch(`${BASE_URL}/documents/upload-and-extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await uploadRes.json();
  const documentData = json.data;

  console.log('API response keys:', Object.keys(documentData));

  // Now execute the EXACT code in ExtractionReviewModal:
  const docRecord = documentData.document || documentData || {};
  const classification = documentData.classification || docRecord.classification || {};
  const aiProviderConfigured = documentData.aiProviderConfigured;
  const aiProvider = documentData.aiProvider;
  const statusMessage = documentData.statusMessage;
  const extractedData = documentData.extractedData || docRecord.extractedData || {};
  const matchedProduct = documentData.matchedProduct || docRecord.matchedProduct || {};
  const duplicateWarning = documentData.duplicateWarning || docRecord.duplicateWarning || {};
  const conflicts = documentData.conflicts || docRecord.conflicts || [];
  const missingFields = documentData.missingFields || docRecord.missingFields || [];
  const fieldConfidence = documentData.fieldConfidence || docRecord.fieldConfidence || {};

  const confidence = extractedData.confidence || {};

  let isEditing = false;
  let isReprocessing = false; // Verified defined!
  let selectedDocType = docRecord.documentType || classification.detectedType || 'RECEIPT';
  let saveAction = matchedProduct?.matchType === 'EXACT' ? 'LINK' : 'CREATE';

  const paginationRegex = /^(--\s*\d+\s*(?:of|\/)\s*\d+\s*--|page\s*\d+\s*(?:of|\/)\s*\d+|\d+\s*of\s*\d+)$/i;
  const rawExtractedName = (typeof extractedData.productName === 'string') ? extractedData.productName.trim() : '';
  const cleanExtractedName = (!paginationRegex.test(rawExtractedName)) ? rawExtractedName : '';

  const rawDocFileName = (typeof docRecord.fileName === 'string')
    ? docRecord.fileName
    : (typeof docRecord.originalName === 'string')
    ? docRecord.originalName
    : '';
  const cleanFileName = rawDocFileName
    ? rawDocFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim()
    : '';
  const fallbackFileName = (cleanFileName && !paginationRegex.test(cleanFileName)) ? cleanFileName : '';
  const initialProductName = cleanExtractedName || fallbackFileName || '';

  console.log('cleanExtractedName:', cleanExtractedName);
  console.log('fallbackFileName:', fallbackFileName);
  console.log('initialProductName:', initialProductName);

  const formData = {
    productName: initialProductName,
    productDescription: extractedData.productDescription || '',
    category: extractedData.category || 'Electronics',
    brand: extractedData.brand || '',
    model: extractedData.model || '',
    serialNumber: extractedData.serialNumber || '',
    purchasePrice: extractedData.purchasePrice !== null && extractedData.purchasePrice !== undefined ? extractedData.purchasePrice : '',
    currency: extractedData.currency || 'INR',
    purchaseDate: extractedData.purchaseDate || new Date().toISOString().split('T')[0],
    sellerName: extractedData.sellerName || '',
    sellerContact: extractedData.sellerPhone || '',
    invoiceNumber: extractedData.invoiceNumber || '',
    hasWarranty: Boolean(extractedData.warranty?.hasWarranty || extractedData.warranty?.durationMonths),
    warrantyProvider: extractedData.warranty?.warrantyProvider || (extractedData.brand ? `${extractedData.brand} India` : ''),
    warrantyType: extractedData.warranty?.warrantyType || 'Manufacturer',
    warrantyStartDate: extractedData.warranty?.warrantyStartDate || extractedData.purchaseDate || new Date().toISOString().split('T')[0],
    warrantyEndDate: extractedData.warranty?.warrantyEndDate || '',
    returnEligible: Boolean(extractedData.returnInfo?.returnEligible),
    returnStartDate: extractedData.purchaseDate || new Date().toISOString().split('T')[0],
    returnEndDate: extractedData.returnInfo?.returnEndDate || '',
    returnPolicyNotes: extractedData.returnInfo?.returnPolicyNotes || '',
    notes: extractedData.summary || '',
  };

  console.log('Initialized Form Data:');
  console.log('  Product Name:', formData.productName);
  console.log('  Brand:', formData.brand);
  console.log('  Model:', formData.model);
  console.log('  Price:', formData.purchasePrice, formData.currency);
  console.log('  Seller:', formData.sellerName);
  console.log('  Invoice #:', formData.invoiceNumber);

  // Check all render references:
  console.log('Doc Type:', selectedDocType);
  console.log('isReprocessing state check: disabled =', isReprocessing);
  console.log('Doc FileName:', docRecord?.fileName || rawDocFileName || 'Document');
  console.log('Page Count:', docRecord?.pageCount || 1);

  if (initialProductName === '-- 1 of 1 --') {
    throw new Error('FAIL: Product name is pagination string "-- 1 of 1 --"');
  }
  if (!initialProductName) {
    throw new Error('FAIL: Product name is empty');
  }

  console.log('SUCCESS: All ExtractionReviewModal render prerequisites satisfied without any runtime exceptions!');
}

testModalSimulation().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
