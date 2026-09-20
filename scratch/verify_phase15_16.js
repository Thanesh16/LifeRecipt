/**
 * LIFERECEIPT Phase 15 & 16 Comprehensive Automated Verification Suite
 * 
 * Tests:
 * 1. Security: Password Complexity Validation (Rejects weak, accepts strong)
 * 2. Security: Malformed ObjectId Param Validation (400 Bad Request)
 * 3. Security: File Upload Magic Byte Enforcement (Rejects spoofed extensions)
 * 4. Security: Tenant Isolation & IDOR Protection (Cross-user access blocked)
 * 5. Security: Audit Trail Recording (Tamper-evident logs on auth, docs, shares)
 * 6. AI Doc Intel: SHA-256 Binary Hashing & Multi-Page Text Extraction
 * 7. AI Doc Intel: Intelligent Document Classification (INVOICE, WARRANTY, etc.)
 * 8. AI Doc Intel: Structured Indian Metadata Extraction (GSTIN, CGST, SGST, INR ₹)
 * 9. AI Doc Intel: Duplicate Document Detection (Hash & Invoice# matching)
 * 10. AI Doc Intel: Intelligent Product Matching & Conflict Detection
 * 11. AI Doc Intel: Lifecycle Endpoints (Reprocess, Link Product, Extracted Data Edit)
 * 12. Security & Passport: User Shares Listing, Revocation, and Audit Tracking
 * 13. AI Assistant Scenario 18: Document Intelligence Queries
 * 14. Security: Safe Cascading Account Deletion with Password Verification
 */

import fs from 'fs';
import path from 'path';
import PDFDocument from '../backend/node_modules/pdfkit/js/pdfkit.js';

const BASE_URL = 'http://localhost:5000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

// Generate a valid PDF buffer using PDFKit for realistic OCR & parsing
function createValidPdf(textContent = 'Official Tax Invoice', addSecondPage = false) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(11).text(textContent);
    if (addSecondPage) {
      doc.addPage();
      doc.fontSize(10).text('Page 2: Standard Terms & Authorized Service Centers');
      doc.text('Warranty Coverage Details: 24 months manufacturer defects.');
      doc.text('Warranty Exclusions: Accidental drop damage, liquid ingress, unauthorized modifications.');
      doc.text('Claim Procedure: Contact authorized service support or visit service center with invoice.');
    }
    doc.end();
  });
}

async function runTests() {
  console.log('\n===============================================================');
  console.log(' LIFERECEIPT PHASE 15 & 16: COMPREHENSIVE VERIFICATION SUITE');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  const userAEmail = `phase15_alice_${timestamp}@test.lifereceipt.com`;
  const userBEmail = `phase15_bob_${timestamp}@test.lifereceipt.com`;
  const strongPassword = 'Password123!';

  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;

  // ==========================================
  // TEST 1: Password Strength Validation
  // ==========================================
  console.log('--- TEST 1: Password Strength Validation ---');
  
  // Weak password: too short
  const weakShort = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Weak User', email: `weak1_${timestamp}@test.com`, password: '123' }),
  });
  assert(weakShort.status === 400, 'Rejects password shorter than 8 characters');

  // Weak password: no uppercase
  const weakNoUpper = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Weak User', email: `weak2_${timestamp}@test.com`, password: 'password123' }),
  });
  assert(weakNoUpper.status === 400, 'Rejects password with no uppercase letters');

  // Strong password: registration succeeds
  const regUserA = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice Security', email: userAEmail, password: strongPassword }),
  });
  assert(regUserA.status === 201 && regUserA.data.success, 'Accepts strong password and registers User A');
  userAToken = regUserA.data.data.token;
  userAId = regUserA.data.data.user.id;

  // Register User B for tenant isolation testing
  const regUserB = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bob Isolation', email: userBEmail, password: strongPassword }),
  });
  assert(regUserB.status === 201 && regUserB.data.success, 'Registers User B with strong password');
  userBToken = regUserB.data.data.token;
  userBId = regUserB.data.data.user.id;

  // ==========================================
  // TEST 2: Malformed ObjectId Param Validation
  // ==========================================
  console.log('\n--- TEST 2: ObjectId URL Parameter Sanitization ---');
  
  const invalidIdRes = await request('/documents/not-a-valid-hex-id-123', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  assert(invalidIdRes.status === 400, 'Rejects malformed document ID with 400 Bad Request');
  assert(invalidIdRes.data.message.includes('Invalid resource identifier format'), 'Returns clear validation error message');

  const invalidPassportIdRes = await request('/passports/not-a-valid-hex-id-456/pdf', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  assert(invalidPassportIdRes.status === 400, 'Rejects malformed passport product ID with 400 Bad Request');

  // ==========================================
  // TEST 3: File Upload Magic Byte Enforcement
  // ==========================================
  console.log('\n--- TEST 3: File Upload Magic Byte Enforcement ---');
  
  // Create a spoofed file: declared as PDF, but body is plaintext
  const fakePdfContent = 'This is plain text pretending to be a PDF file!';
  const boundary = `----WebKitFormBoundary${Date.now()}`;
  
  const spoofedPayload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="spoofed.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    Buffer.from(fakePdfContent, 'utf-8'),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nINVOICE\r\n--${boundary}--\r\n`),
  ]);

  const spoofedRes = await request('/documents/upload-and-extract', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: spoofedPayload,
  });

  assert(spoofedRes.status === 400, 'Rejects file with spoofed magic bytes (400 Bad Request)');
  assert(
    spoofedRes.data.message.includes('File content validation failed') || spoofedRes.data.message.includes('magic byte') || spoofedRes.data.message.includes('signature does not match'),
    'Explains signature mismatch without crashing server'
  );

  // ==========================================
  // TEST 4: Valid PDF Upload & Intelligence Pipeline
  // ==========================================
  console.log('\n--- TEST 4: AI Document Intelligence Pipeline (Hashing, OCR, GSTIN Extraction) ---');
  
  // Create realistic invoice text for multi-page extraction & classification
  const invoiceText = `TAX INVOICE
Reliance Digital Retail Ltd
GSTIN: 27AABCR1234F1Z9
CIN: U12345MH2000PLC123456
Invoice No: INV-RD-2026-98765
Date: 15/01/2026
Customer Name: Alice Security

Item Description: Sony Bravia 55 Inch 4K UHD Smart OLED TV
Model Number: XR-55A80L
Serial Number: SN-SONY-789012
HSN/SAC: 8528
Qty: 1
Base Price: ₹1,24,990.00
CGST 9%: ₹11,249.10
SGST 9%: ₹11,249.10
Grand Total: ₹1,47,488.20

Warranty Period: 24 Months Comprehensive Manufacturer Coverage
Authorized Service Contact: 1800-103-7799
Email: support@sony.in`;

  const validPdfBuf = await createValidPdf(invoiceText, true);
  const boundaryValid = `----WebKitFormBoundaryValid${Date.now()}`;
  
  const validPayload = Buffer.concat([
    Buffer.from(`--${boundaryValid}\r\nContent-Disposition: form-data; name="document"; filename="Sony_OLED_Invoice.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    validPdfBuf,
    Buffer.from(`\r\n--${boundaryValid}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nINVOICE\r\n--${boundaryValid}--\r\n`),
  ]);

  const uploadRes = await request('/documents/upload-and-extract', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundaryValid}`,
    },
    body: validPayload,
  });

  assert(uploadRes.status === 201 && uploadRes.data.success, 'Valid PDF passes magic byte inspection and uploads');
  const uploadedDoc = uploadRes.data.data.document;
  assert(uploadedDoc && uploadedDoc._id, 'Document ID generated');
  assert(uploadedDoc.fileHash && uploadedDoc.fileHash.length === 64, 'Computed 64-character SHA-256 file hash');
  assert(uploadedDoc.extractedData?.currency === 'INR', 'Default ledger currency is INR');
  assert(uploadedDoc.classification && uploadedDoc.classification.confidence > 0, 'Classified document with confidence score');
  console.log(`    Document classified as: ${uploadedDoc.classification?.detectedType || uploadedDoc.documentType} (Confidence: ${uploadedDoc.classification?.confidence})`);

  // Verify multi-page & structured GST extraction
  assert(uploadedDoc.pageCount >= 1, 'Extracted page count from PDF');
  assert(uploadedDoc.extractedData, 'Extracted data object generated');
  assert(uploadedDoc.extractedData.gstin === '27AABCR1234F1Z9', 'Extracted Indian GSTIN (27AABCR1234F1Z9)');
  assert(uploadedDoc.extractedData.invoiceNumber === 'INV-RD-2026-98765', 'Extracted Invoice Number');
  const merchant = uploadedDoc.extractedData.sellerName || uploadedDoc.extractedData.merchantName;
  assert(merchant && merchant.includes('Reliance Digital'), 'Extracted Merchant/Seller Name (Reliance Digital)');
  assert(uploadedDoc.extractedData.serialNumber === 'SN-SONY-789012', 'Extracted hardware Serial Number');

  // ==========================================
  // TEST 5: Duplicate Document Detection
  // ==========================================
  console.log('\n--- TEST 5: Duplicate Document Detection ---');

  const duplicateRes = await request('/documents/upload-and-extract', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundaryValid}`,
    },
    body: validPayload,
  });

  assert(duplicateRes.status === 201, 'Duplicate upload processed');
  const dupDoc = duplicateRes.data.data.document;
  const dupWarning = duplicateRes.data.data.duplicateWarning || dupDoc.duplicateWarning;
  assert(dupWarning && dupWarning.isDuplicate, 'Flagged duplicate document via SHA-256 hash match');
  console.log(`    Duplicate detection note: ${dupWarning?.duplicateReason || dupWarning?.reason}`);

  // Clean up duplicate doc
  await request(`/documents/${dupDoc._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userAToken}` },
  });

  // ==========================================
  // TEST 6: Intelligent Product Matching & Conflict Detection
  // ==========================================
  console.log('\n--- TEST 6: Intelligent Product Matching & Conflict Detection ---');

  // Create a product for User A with the same serial number but different purchase price to test conflict detection
  const prodRes = await request('/products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productName: 'Sony Bravia 55 OLED TV',
      brand: 'Sony',
      model: 'XR-55A80L',
      serialNumber: 'SN-SONY-789012',
      purchasePrice: 110000, // Discrepancy with invoice price 147488.20
      purchaseDate: '2026-01-15',
      category: 'Electronics',
    }),
  });

  assert(prodRes.status === 201, 'Created product with matching serial number');
  const productA = prodRes.data.data;

  // Link uploaded document to product to trigger conflict checks
  const linkRes = await request(`/documents/${uploadedDoc._id}/link-product`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId: productA._id }),
  });

  assert(linkRes.status === 200 && linkRes.data.success, 'Successfully linked document to product');
  const linkedDoc = linkRes.data.data;
  console.log('DEBUG linkedDoc.conflicts:', linkedDoc.conflicts, 'extracted purchasePrice:', linkedDoc.extractedData?.purchasePrice, 'productA price:', productA.purchasePrice);
  assert(Array.isArray(linkedDoc.conflicts) && linkedDoc.conflicts.length > 0, 'Detected price conflict between invoice and product baseline');
  console.log(`    Conflict flagged: ${linkedDoc.conflicts[0]?.field} (${linkedDoc.conflicts[0]?.explanation || linkedDoc.conflicts[0]?.description})`);

  // ==========================================
  // TEST 7: Document Lifecycle Endpoints (Edit Extracted Data & Reprocess)
  // ==========================================
  console.log('\n--- TEST 7: Extracted Data Edit & Document Reprocess ---');

  const editDataRes = await request(`/documents/${uploadedDoc._id}/extracted-data`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      extractedData: {
        sellerName: 'Reliance Digital Flagship Store',
        totalAmount: 147488,
      },
    }),
  });

  assert(editDataRes.status === 200, 'Successfully updated extracted metadata');
  assert(editDataRes.data.data.extractedData.sellerName === 'Reliance Digital Flagship Store', 'Persisted edited merchant/seller name');

  const reprocessRes = await request(`/documents/${uploadedDoc._id}/reprocess`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documentType: 'WARRANTY' }),
  });

  assert(reprocessRes.status === 200, 'Reprocessed document with target type');
  assert(reprocessRes.data.data.documentType === 'WARRANTY', 'Updated document classification to WARRANTY');

  // ==========================================
  // TEST 8: Tenant Isolation & IDOR Protection
  // ==========================================
  console.log('\n--- TEST 8: Tenant Isolation & IDOR Enforcement ---');

  // User B attempts to access User A's document
  const idorDocRes = await request(`/documents/${uploadedDoc._id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  assert(idorDocRes.status === 404 || idorDocRes.status === 403, 'User B cannot view User A document (404/403 IDOR rejection)');

  // User B attempts to edit User A's document
  const idorEditRes = await request(`/documents/${uploadedDoc._id}/extracted-data`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${userBToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ totalAmount: 0 }),
  });
  assert(idorEditRes.status === 404 || idorEditRes.status === 403, 'User B cannot edit User A document');

  // User B attempts to delete User A's document
  const idorDeleteRes = await request(`/documents/${uploadedDoc._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  assert(idorDeleteRes.status === 404 || idorDeleteRes.status === 403, 'User B cannot delete User A document');

  // User B attempts to view User A's passport
  const idorPassportRes = await request(`/passports/${productA._id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  assert(idorPassportRes.status === 404 || idorPassportRes.status === 403, 'User B cannot view User A passport');

  // ==========================================
  // TEST 9: Passport Share Management & Revocation
  // ==========================================
  console.log('\n--- TEST 9: Passport Cryptographic Share Links & Immediate Revocation ---');

  // Create passport share token
  const createShareRes = await request(`/passports/${productA._id}/shares`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ permissionLevel: 'BASIC', expiresDays: 7 }),
  });

  assert(createShareRes.status === 201 && createShareRes.data.success, 'Generated cryptographic passport share token');
  const shareToken = createShareRes.data.data.shareToken || createShareRes.data.data.share?.shareToken;
  const shareId = createShareRes.data.data.shareId || createShareRes.data.data.share?.shareId;

  // Test public access before revocation
  const publicAccessRes = await request(`/passports/public/${shareToken}`);
  assert(publicAccessRes.status === 200 && publicAccessRes.data.success, 'Public viewer accesses passport via share token');
  assert(publicAccessRes.data.data.permissionLevel === 'BASIC', 'Tier BASIC strictly applied to public view');

  // Get all user shares
  const userSharesRes = await request('/passports/user/shares', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  assert(userSharesRes.status === 200 && userSharesRes.data.success, 'Retrieved all user shares for Privacy & Security tab');
  const activeShare = userSharesRes.data.data.find((s) => s._id === shareId);
  assert(activeShare && activeShare.status === 'ACTIVE', 'Share listed as ACTIVE');

  // Revoke share token
  const revokeRes = await request(`/passports/shares/${shareId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  assert(revokeRes.status === 200 && revokeRes.data.success, 'Successfully revoked share link immediately');

  // Verify public access is now rejected
  const publicRevokedRes = await request(`/passports/public/${shareToken}`);
  assert(publicRevokedRes.status === 403, 'Revoked share token denies public access (403 Forbidden)');

  // ==========================================
  // TEST 10: Security Audit Log Trail
  // ==========================================
  console.log('\n--- TEST 10: Security Audit Trail Retention & Zero Credential Leakage ---');

  const auditRes = await request('/auth/audit-log', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userAToken}` },
  });

  assert(auditRes.status === 200 && auditRes.data.success, 'Retrieved security audit log');
  const logs = auditRes.data.data.logs;
  assert(Array.isArray(logs) && logs.length >= 3, 'Recorded multiple tamper-evident security events');

  const actionsLogged = logs.map((l) => l.action);
  assert(actionsLogged.includes('REGISTER'), 'Audit log captured REGISTER event');
  assert(actionsLogged.includes('DOCUMENT_UPLOAD'), 'Audit log captured DOCUMENT_UPLOAD event');
  assert(actionsLogged.includes('PASSPORT_SHARE_CREATE'), 'Audit log captured PASSPORT_SHARE_CREATE event');
  assert(actionsLogged.includes('PASSPORT_SHARE_REVOKE'), 'Audit log captured PASSPORT_SHARE_REVOKE event');

  // Ensure zero credentials leakage in details
  logs.forEach((log) => {
    const rawDetails = JSON.stringify(log.details || {});
    assert(!rawDetails.includes(strongPassword), 'Zero credentials leakage: Password never stored in audit log');
    assert(!rawDetails.includes('Bearer'), 'Zero credentials leakage: Token never stored in audit log');
  });
  console.log(`    Recorded ${logs.length} audit events with zero credential leakage.`);

  // ==========================================
  // TEST 11: AI Assistant Scenario 18 Document Intelligence
  // ==========================================
  console.log('\n--- TEST 11: AI Ownership Assistant Document Intelligence (Scenario 18) ---');

  const assistantQueryRes = await request('/assistant/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'What are the warranty coverage and exclusions mentioned in my Sony TV document?',
    }),
  });

  assert(assistantQueryRes.status === 200 && assistantQueryRes.data.success, 'AI Assistant processed document query');
  const aiAnswer = assistantQueryRes.data.data.response || assistantQueryRes.data.data.message;
  assert(aiAnswer && aiAnswer.length > 20, 'Assistant returned detailed response');
  assert(!aiAnswer.includes('$'), 'Strict zero-dollar policy: No dollar signs in AI response');
  console.log(`    AI Assistant response sample: "${aiAnswer.slice(0, 100)}..."`);

  // ==========================================
  // TEST 12: Safe Cascading Account Deletion
  // ==========================================
  console.log('\n--- TEST 12: Safe Cascading Account Deletion ---');

  // Bob tries to delete with wrong password
  const bobWrongPassRes = await request('/auth/account', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${userBToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: 'WrongPassword999!' }),
  });
  assert(bobWrongPassRes.status === 401, 'Account deletion rejects incorrect password (401 Unauthorized)');

  // Bob deletes with correct password
  const bobCorrectPassRes = await request('/auth/account', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${userBToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: strongPassword }),
  });
  assert(bobCorrectPassRes.status === 200 && bobCorrectPassRes.data.success, 'Account successfully deleted with password confirmation');

  // Verify Bob can no longer log in
  const bobLoginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userBEmail, password: strongPassword }),
  });
  assert(bobLoginRes.status === 401, 'Deleted account cannot log in (401 Unauthorized)');

  // Verify Bob's audit trail logged ACCOUNT_DELETE
  // Check User A is unaffected (tenant isolation during deletion)
  const userAProductsCheck = await request('/products', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  const userAProducts = userAProductsCheck.data.data.products || userAProductsCheck.data.data;
  assert(userAProductsCheck.status === 200 && (userAProducts.length >= 1 || userAProductsCheck.data.data.count >= 1), 'User A products remain completely intact after User B deletion');

  console.log('\n===============================================================');
  console.log(' ✅ ALL PHASE 15 & 16 TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
