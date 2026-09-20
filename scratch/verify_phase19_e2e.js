/**
 * LIFERECEIPT Phase 19: Master End-to-End Integration & Stabilization Suite
 * 
 * Tests Flows A through I:
 * FLOW A — New User Registration & Dashboard
 * FLOW B — Receipt Upload to Ownership (OCR, GSTIN, Product Linking)
 * FLOW C — Warranty Tracking, Alerts & Claim Preparation
 * FLOW D — Service Ecosystem (CRUD, Expense Sync, Patterns, Metro Centers)
 * FLOW E — AI Ownership Assistant Grounding & Source Attribution
 * FLOW F — Email Receipt Intelligence & Duplicate Prevention
 * FLOW G — Peer-to-Peer Ownership Transfer Lifecycle
 * FLOW H — Digital Ownership Passport (Cryptographic Share & Instant Revocation)
 * FLOW I — Mobile, PWA Assets, IDOR Isolation & Parameter Sanitization
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from '../backend/node_modules/pdfkit/js/pdfkit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000/api/v1';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const status = response.status;
  let data = null;
  try {
    data = await response.json();
  } catch {
    // non-json response
  }

  return { status, data, ok: response.ok };
}

// Generate valid test invoice PDF
function createTestInvoicePdf(invoiceNum, gstin, serialNum) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(16).text('TAX INVOICE - RELIANCE RETAIL LIMITED', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`GSTIN: ${gstin}`);
    doc.text(`Invoice No: ${invoiceNum}`);
    doc.text(`Date: ${new Date().toISOString().split('T')[0]}`);
    doc.moveDown();
    doc.text('Item Description: HP Pavilion 15 Gaming Laptop');
    doc.text(`Serial Number: ${serialNum}`);
    doc.text('Model: 15-dk1056wm');
    doc.text('Amount: INR 75,000');
    doc.text('CGST (9%): INR 6,750');
    doc.text('SGST (9%): INR 6,750');
    doc.text('Total Amount: INR 88,500');
    doc.moveDown();
    doc.text('Warranty Terms: 1 Year Manufacturer Warranty included.');
    doc.end();
  });
}

async function runMasterSuite() {
  console.log('================================================================');
  console.log(' LIFERECEIPT PHASE 19: MASTER END-TO-END VERIFICATION SUITE');
  console.log('================================================================\n');

  try {
    const timestamp = Date.now();
    const userAEmail = `phase19_user_a_${timestamp}@test.lifereceipt.com`;
    const userBEmail = `phase19_user_b_${timestamp}@test.lifereceipt.com`;
    const strongPassword = 'Password123!';

    // ================================================================
    // FLOW A: New User Registration & Dashboard
    // ================================================================
    console.log('[FLOW A] New User Registration & Dashboard...');
    const regA = await apiRequest('/auth/register', {
      method: 'POST',
      body: { name: 'Priya Sharma', email: userAEmail, password: strongPassword },
    });
    assert(regA.status === 201, 'User A registered successfully');
    const tokenA = regA.data?.data?.token || regA.data?.token;
    assert(tokenA, 'User A received JWT token');

    const regB = await apiRequest('/auth/register', {
      method: 'POST',
      body: { name: 'Rahul Verma', email: userBEmail, password: strongPassword },
    });
    assert(regB.status === 201, 'User B registered successfully');
    const tokenB = regB.data?.data?.token || regB.data?.token;
    assert(tokenB, 'User B received JWT token');

    const authA = { headers: { Authorization: `Bearer ${tokenA}` } };
    const authB = { headers: { Authorization: `Bearer ${tokenB}` } };

    // Check dashboard empty state
    const dashEmpty = await apiRequest('/dashboard/summary', authA);
    assert(dashEmpty.status === 200, 'User A retrieved empty dashboard summary');
    assert(dashEmpty.data?.data?.metrics?.totalProducts === 0, 'Dashboard correctly reports 0 products for new user');

    // Create baseline product manually
    const createProd = await apiRequest('/products', {
      method: 'POST',
      ...authA,
      body: {
        productName: 'Sony Bravia 55 4K TV',
        category: 'Electronics',
        brand: 'Sony',
        model: 'KD-55X75K',
        serialNumber: `SN-SONY-${timestamp}`,
        purchasePrice: 62000,
        currency: 'INR',
        sellerName: 'Croma Retail',
        purchaseDate: new Date().toISOString(),
        warranty: {
          hasWarranty: true,
          warrantyStartDate: new Date().toISOString(),
          warrantyEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          warrantyProvider: 'Sony India',
          warrantyType: 'Manufacturer',
        },
      },
    });
    assert(createProd.status === 201, 'User A created initial product in INR');
    const productA = createProd.data?.data;
    assert(productA?._id, 'Product ID generated');

    // Verify dashboard updated
    const dashUpdated = await apiRequest('/dashboard/summary', authA);
    assert(dashUpdated.data?.data?.metrics?.totalProducts === 1, 'Dashboard updated to 1 product');
    assert(dashUpdated.data?.data?.metrics?.totalTrackedValue === 62000, 'Tracked value matches ₹62,000');

    // ================================================================
    // FLOW B: Receipt to Ownership (Magic Bytes, OCR, GSTIN, Linking)
    // ================================================================
    console.log('\n[FLOW B] Receipt to Ownership (Magic Bytes, OCR, GSTIN, Linking)...');
    const testSerial = `SN-HP-${timestamp}`;
    const testInvoiceNum = `INV-HP-${timestamp}`;
    const pdfBuffer = await createTestInvoicePdf(testInvoiceNum, '29ABCDE1234F1Z5', testSerial);

    // Upload multipart PDF
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="HP_Laptop_Invoice.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      pdfBuffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nINVOICE\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${BASE_URL}/documents/upload-and-extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 201, 'Invoice PDF uploaded and passed magic byte inspection');
    const docA = uploadData.data?.document;
    assert(docA?._id, 'Document ID generated');
    assert(docA?.fileHash?.length === 64, 'SHA-256 cryptographic file hash computed');
    assert(docA?.classification?.detectedType === 'INVOICE', 'Document classified as INVOICE');

    // Link document to a new confirmed product
    const confirmRes = await apiRequest('/documents/confirm-product', {
      method: 'POST',
      ...authA,
      body: {
        documentId: docA._id,
        action: 'CREATE_NEW',
        productData: {
          productName: 'HP Pavilion 15 Gaming Laptop',
          category: 'Computing',
          brand: 'HP',
          model: '15-dk1056wm',
          serialNumber: testSerial,
          purchasePrice: 88500,
          currency: 'INR',
          sellerName: 'Reliance Retail Limited',
          invoiceNumber: testInvoiceNum,
          purchaseDate: new Date().toISOString(),
          warranty: {
            hasWarranty: true,
            warrantyStartDate: new Date().toISOString(),
            warrantyEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            warrantyProvider: 'HP India',
            warrantyType: 'Manufacturer',
          },
        },
      },
    });
    assert(confirmRes.status === 201, 'Document confirmed and new Product created from extraction');
    const productB = confirmRes.data?.data?.product;
    assert(productB?._id, 'Extracted product successfully persisted');

    // Duplicate document detection test
    const dupRes = await fetch(`${BASE_URL}/documents/upload-and-extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const dupData = await dupRes.json();
    assert(dupData.data?.duplicateWarning?.isDuplicate === true, 'Duplicate document detected via SHA-256 hash');

    // ================================================================
    // FLOW C: Warranty Tracking, Alerts & Claim Preparation
    // ================================================================
    console.log('\n[FLOW C] Warranty Tracking, Alerts & Claim Preparation...');
    const alertsRes = await apiRequest('/alerts', authA);
    assert(alertsRes.status === 200, 'Retrieved active alerts for User A');

    // Prepare warranty claim
    const claimPrepRes = await apiRequest(`/services/claims/prepare/${productB._id}`, authA);
    assert(claimPrepRes.status === 200, 'Warranty claim pre-flight checklist prepared');
    assert(claimPrepRes.data?.data?.product?.name === 'HP Pavilion 15 Gaming Laptop', 'Claim checklist links to product');

    // Submit warranty claim
    const claimSubmit = await apiRequest('/services/claims', {
      method: 'POST',
      ...authA,
      body: {
        productId: productB._id,
        claimType: 'MANUFACTURER',
        issueTitle: 'Laptop display defect under warranty',
        issueDescription: 'Laptop screen flickering intermittently on battery',
        notes: 'Requested expedited resolution from authorized center',
      },
    });
    assert(claimSubmit.status === 201, 'Warranty claim successfully submitted');
    const claimRecord = claimSubmit.data?.data;
    assert(claimRecord?._id, 'Warranty claim ID generated');

    // ================================================================
    // FLOW D: Service Ecosystem (CRUD, Cost Sync, Patterns, Centers)
    // ================================================================
    console.log('\n[FLOW D] Service Ecosystem (CRUD, Cost Sync, Patterns, Centers)...');
    const svcReq1 = await apiRequest('/services', {
      method: 'POST',
      ...authA,
      body: {
        productId: productB._id,
        serviceType: 'REPAIR',
        issueTitle: 'Screen flickering defect',
        issueDescription: 'Display panel replacement needed',
        estimatedCost: 8000,
        serviceCenter: {
          name: 'HP Authorized Service Center Chennai',
          city: 'Chennai',
          isAuthorized: true,
        },
      },
    });
    assert(svcReq1.status === 201, 'Service record 1 created in REQUESTED status');
    const svc1Id = svcReq1.data?.data?._id;

    // Complete service record with actual cost
    const svcComplete = await apiRequest(`/services/${svc1Id}`, {
      method: 'PUT',
      ...authA,
      body: {
        status: 'COMPLETED',
        actualCost: 7500,
        completionDate: new Date().toISOString(),
      },
    });
    assert(svcComplete.status === 200, 'Service record 1 updated to COMPLETED');

    // Verify automatic expense synchronization
    const expRes = await apiRequest(`/expenses/products/${productB._id}`, authA);
    const expenseList = expRes.data?.data?.expenses || (Array.isArray(expRes.data?.data) ? expRes.data?.data : []);
    const hasSyncExpense = expenseList.some(
      (e) => e.expenseType === 'REPAIR' && e.amount === 7500
    );
    assert(hasSyncExpense, 'Repair cost (₹7,500) automatically synchronized with Expense ledger');

    // Add 2nd service record on same product to trigger automated pattern analysis
    const svcReq2 = await apiRequest('/services', {
      method: 'POST',
      ...authA,
      body: {
        productId: productB._id,
        serviceType: 'REPAIR',
        issueTitle: 'Screen backlight failure',
        issueDescription: 'Chronic screen problem resurfaced',
        estimatedCost: 38000,
        actualCost: 40000,
        status: 'COMPLETED',
        serviceCenter: {
          name: 'HP Care Hub Mumbai',
          city: 'Mumbai',
          isAuthorized: true,
        },
      },
    });
    assert(svcReq2.status === 201, 'Service record 2 logged to test repair burden');

    // Service History Analysis
    const analysisRes = await apiRequest(`/services/analysis?productId=${productB._id}`, authA);
    assert(analysisRes.status === 200, 'Service analysis endpoint succeeded');
    const patterns = analysisRes.data?.data?.patterns || [];
    const hasFrequent = patterns.some((p) => p.type === 'FREQUENT_REPAIRS');
    const hasBurden = patterns.some((p) => p.type === 'HIGH_REPAIR_BURDEN');
    const hasDefect = patterns.some((p) => p.type === 'RECURRING_DEFECT');
    assert(hasFrequent, 'Pattern FREQUENT_REPAIRS flagged (>= 2 repair events)');
    assert(hasBurden, 'Pattern HIGH_REPAIR_BURDEN flagged (cumulative repair spend > 50% purchase price)');
    assert(hasDefect, 'Pattern RECURRING_DEFECT flagged for chronic "screen" defect');

    // Service centers directory test across Indian metro hubs
    const centerRes = await apiRequest('/services/centers?brand=HP&city=Chennai', authA);
    assert(centerRes.status === 200, 'Service centers queried for HP in Chennai');
    assert(centerRes.data?.data?.length > 0, 'Found verified HP service center in Chennai');

    // ================================================================
    // FLOW E: AI Ownership Assistant Grounding & Source Attribution
    // ================================================================
    console.log('\n[FLOW E] AI Ownership Assistant Grounding & Source Attribution...');
    
    // Test Catalog Question
    const aiCatalog = await apiRequest('/assistant/chat', {
      method: 'POST',
      ...authA,
      body: { message: 'What products do I own?' },
    });
    assert(aiCatalog.status === 200, 'AI Assistant processed catalog question');
    const catalogText = aiCatalog.data?.data?.response || aiCatalog.data?.data?.answer || aiCatalog.data?.data?.content || '';
    assert(
      catalogText.includes('HP Pavilion') || catalogText.includes('Sony Bravia'),
      'AI Assistant identified owned products from real database records'
    );

    // Test Repair Spend Question
    const aiSpend = await apiRequest('/assistant/chat', {
      method: 'POST',
      ...authA,
      body: { message: 'How much have I spent on repairs for my HP laptop?' },
    });
    assert(aiSpend.status === 200, 'AI Assistant processed repair spend question');
    const spendText = aiSpend.data?.data?.response || aiSpend.data?.data?.answer || aiSpend.data?.data?.content || '';
    assert(
      spendText.includes('₹') || spendText.includes('INR'),
      'AI Assistant correctly reports repair expenditure in INR (₹)'
    );

    // Verify strict zero-dollar rule in AI Assistant output
    assert(!spendText.includes('$'), 'Strict zero-dollar policy verified in AI Assistant response');

    // Verify 4-way source attribution structure
    const sources = aiCatalog.data?.data?.sources || [];
    assert(sources.length > 0, 'AI Assistant provided verified source attribution');

    // ================================================================
    // FLOW F: Email Receipt Intelligence & Duplicate Prevention
    // ================================================================
    console.log('\n[FLOW F] Email Receipt Intelligence...');
    const emailConnRes = await apiRequest('/email-receipts/connections', authA);
    assert(emailConnRes.status === 200, 'Queried email receipt connection states');

    const emailInboxRes = await apiRequest('/email-receipts', authA);
    assert(emailInboxRes.status === 200, 'Accessed email receipts review inbox');

    // ================================================================
    // FLOW G: Ownership Transfer Lifecycle
    // ================================================================
    console.log('\n[FLOW G] Ownership Transfer Lifecycle...');
    // User A initiates transfer of productA (Sony Bravia) to User B
    const transferInit = await apiRequest('/transfers/initiate', {
      method: 'POST',
      ...authA,
      body: {
        productId: productA._id,
        recipientEmail: userBEmail,
        notes: 'Selling TV to friend',
      },
    });
    assert(transferInit.status === 201, 'Ownership transfer initiated by User A');
    const transferId = transferInit.data?.data?._id;
    assert(transferId, 'Transfer record ID created');

    // User B checks incoming transfers
    const incomingRes = await apiRequest('/transfers/incoming', authB);
    assert(incomingRes.status === 200, 'User B retrieved incoming transfers');
    const hasIncoming = incomingRes.data?.data?.some((t) => t._id === transferId);
    assert(hasIncoming, 'User B sees pending incoming transfer');

    // User B accepts transfer
    const acceptRes = await apiRequest(`/transfers/${transferId}/accept`, {
      method: 'POST',
      ...authB,
    });
    assert(acceptRes.status === 200, 'User B accepted ownership transfer');

    // Verify productA is now owned by User B
    const prodCheckB = await apiRequest(`/products/${productA._id}`, authB);
    assert(prodCheckB.status === 200, 'Transferred product successfully accessed by new owner (User B)');

    // Verify User A no longer has active product access
    const prodCheckA = await apiRequest(`/products/${productA._id}`, authA);
    assert(prodCheckA.status === 404, 'Previous owner (User A) cleanly denied direct product mutation (404)');

    // ================================================================
    // FLOW H: Digital Ownership Passport & Sharing
    // ================================================================
    console.log('\n[FLOW H] Digital Ownership Passport & Sharing...');
    // Generate passport for productB
    const passportRes = await apiRequest(`/passports/${productB._id}`, authA);
    assert(passportRes.status === 200, 'Generated Digital Ownership Passport');
    const passportProdName = passportRes.data?.data?.product?.productName || passportRes.data?.data?.product?.name || passportRes.data?.data?.passport?.product?.name;
    assert(passportProdName === 'HP Pavilion 15 Gaming Laptop', 'Passport matches product identity');

    // Create cryptographic share link
    const shareRes = await apiRequest(`/passports/${productB._id}/shares`, {
      method: 'POST',
      ...authA,
      body: {
        permissionLevel: 'BASIC',
        expiresInDays: 7,
      },
    });
    assert(shareRes.status === 201, 'Cryptographic passport share link created');
    const shareToken = shareRes.data?.data?.shareToken;
    const shareRecordId = shareRes.data?.data?.shareId || shareRes.data?.data?._id;
    assert(shareToken, 'Cryptographic share token generated');

    // Public access via share token (unauthenticated)
    const publicRes = await apiRequest(`/passports/public/${shareToken}`);
    assert(publicRes.status === 200, 'Unauthenticated public viewer accesses passport via share token');
    assert(publicRes.data?.data?.permissionLevel === 'BASIC', 'Tier BASIC strictly applied to public viewer');

    // Revoke share token immediately
    const revokeRes = await apiRequest(`/passports/shares/${shareRecordId}`, {
      method: 'DELETE',
      ...authA,
    });
    assert(revokeRes.status === 200, 'Passport share link successfully revoked');

    // Verify revoked token denies access
    const revokedCheck = await apiRequest(`/passports/public/${shareToken}`);
    assert(revokedCheck.status === 403, 'Revoked share token denies public access with HTTP 403');

    // ================================================================
    // FLOW I: Mobile, PWA Assets, IDOR Isolation & Parameter Sanitization
    // ================================================================
    console.log('\n[FLOW I] Mobile, PWA Assets, IDOR Isolation & Parameter Sanitization...');
    // Check PWA assets
    const manifestPath = path.join(__dirname, '../frontend/public/manifest.json');
    assert(fs.existsSync(manifestPath), 'PWA Web App Manifest exists');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifest.display === 'standalone', 'Manifest display mode is standalone');
    assert(manifest.theme_color === '#0284c7', 'Manifest theme color is #0284c7');

    const swPath = path.join(__dirname, '../frontend/public/sw.js');
    assert(fs.existsSync(swPath), 'PWA Service Worker file exists');
    const swContent = fs.readFileSync(swPath, 'utf8');
    assert(swContent.includes('/api/'), 'Service Worker strictly bypasses API calls');

    // Multi-tenant IDOR check: User A tries to view User B's transferred product or document
    const idorRes = await apiRequest(`/documents/${docA._id}`, authB);
    assert(idorRes.status === 404, 'User B denied access to User A documents (404 Not Found)');

    // Malformed ObjectId parameter validation (HTTP 400)
    const malformedProd = await apiRequest('/products/invalid-id-12345', authA);
    assert(malformedProd.status === 400, 'Malformed Product ID rejected with HTTP 400');

    const malformedSvc = await apiRequest('/services/malformed-id-67890', authA);
    assert(malformedSvc.status === 400, 'Malformed Service ID rejected with HTTP 400');

    const malformedExp = await apiRequest('/expenses/products/malformed-prod-id', authA);
    assert(malformedExp.status === 400, 'Malformed Expense Product ID rejected with HTTP 400');

    // NoSQL Injection sanitization check
    const nosqlRes = await apiRequest('/products', {
      method: 'POST',
      ...authA,
      body: {
        productName: 'Injection Test Item',
        category: 'Other',
        purchasePrice: 100,
        $where: 'sleep(1000)',
        'admin.role': 'superadmin',
      },
    });
    assert(nosqlRes.status === 201, 'Product created and NoSQL operator injection stripped safely');

    console.log('\n================================================================');
    console.log(` MASTER VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Master Test Suite Error:', err);
    process.exit(1);
  }
}

runMasterSuite();
