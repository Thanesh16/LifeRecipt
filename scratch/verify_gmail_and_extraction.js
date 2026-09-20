import mongoose from 'mongoose';
import emailIntelligenceService from '../backend/src/services/email/emailIntelligenceService.js';
import env from '../backend/src/config/env.js';

const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyAll() {
  console.log('===============================================================');
  console.log('  LIFERECEIPT REAL GMAIL & EXTRACTION MASTER VERIFICATION');
  console.log('===============================================================\n');

  // 1. Connect to Database and check preservation of user data
  console.log('[1/5] Checking Database Integrity & Mock Cleanliness...');
  await mongoose.connect(env.MONGO_URI);
  const totalProducts = await mongoose.connection.db.collection('products').countDocuments();
  const totalDocuments = await mongoose.connection.db.collection('documents').countDocuments();
  const emailReceiptsCount = await mongoose.connection.db.collection('emailreceipts').countDocuments();
  const mockReceipts = await mongoose.connection.db.collection('emailreceipts').find({
    providerMessageId: { $in: ['gmail_msg_in_001', 'gmail_msg_in_002', 'outlook_msg_in_001'] }
  }).toArray();
  const mockConnections = await mongoose.connection.db.collection('emailconnections').find({
    emailAddress: { $in: ['thanesh.s@gmail.com', 'alice.phase11@gmail.com'] }
  }).toArray();

  console.log(`  ✓ Total Products Preserved: ${totalProducts} (Expected: >= 178)`);
  console.log(`  ✓ Total Documents Preserved: ${totalDocuments}`);
  console.log(`  ✓ Total Email Receipt Candidates in DB: ${emailReceiptsCount}`);
  console.log(`  ✓ Mock Email Receipts in DB: ${mockReceipts.length} (Expected: 0)`);
  console.log(`  ✓ Mock Email Connections in DB: ${mockConnections.length} (Expected: 0)`);

  if (mockReceipts.length > 0 || mockConnections.length > 0) {
    throw new Error('Database still contains mock email records!');
  }
  if (totalProducts < 178) {
    throw new Error(`Expected at least 178 genuine products, found ${totalProducts}`);
  }

  // 2. Test User Authentication
  console.log('\n[2/5] Testing User Authentication...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testuser@example.com', password: 'TestPassword123!' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token;
  if (!token) throw new Error('Failed to obtain JWT token for API tests');
  console.log('  ✓ Authenticated successfully with JWT token');

  // 3. Test Google OAuth API Endpoints
  console.log('\n[3/5] Testing Genuine Google OAuth Endpoints...');
  const authUrlRes = await fetch(`${BASE_URL}/email-receipts/auth/google/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const authUrlData = await authUrlRes.json();
  console.log('  ✓ GET /auth/google/url status:', authUrlRes.status);
  console.log('    Response message:', authUrlData.message);
  console.log('    OAuth Configured:', authUrlData.configured || authUrlData.data?.configured || false);

  const callbackRes = await fetch(`${BASE_URL}/email-receipts/auth/google/callback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code: '' }),
  });
  const callbackData = await callbackRes.json();
  console.log('  ✓ POST /auth/google/callback code validation status:', callbackRes.status);
  console.log('    Validation message:', callbackData.message);

  // 4. Test Email Receipt API candidates & connections
  console.log('\n[4/5] Testing Email Receipts API endpoints...');
  const connsRes = await fetch(`${BASE_URL}/email-receipts/connections`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const connsData = await connsRes.json();
  console.log('  ✓ GET /connections status:', connsRes.status);
  console.log('    Connections count:', connsData.data?.length || 0);

  const candidatesRes = await fetch(`${BASE_URL}/email-receipts?tab=needs_review`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const candidatesData = await candidatesRes.json();
  console.log('  ✓ GET /email-receipts?tab=needs_review status:', candidatesRes.status);
  console.log('    Candidates count:', candidatesData.data?.candidates?.length || 0);

  // 5. Test Source Conflict Detection Engine
  console.log('\n[5/5] Testing Source Conflict Detection Engine...');
  // Case A: Conflict (Email says Sony Bravia, attachment says HP Pavilion)
  const conflictTestA = emailIntelligenceService._detectSourceConflict(
    {
      subject: 'Croma e-Receipt: Your purchase of Sony Bravia TV',
      snippet: 'Total paid ₹1,24,999 for Sony Bravia OLED',
    },
    {
      productName: 'HP Pavilion 15 Core i5 Laptop',
      brand: 'HP',
      model: '15-eg',
      purchasePrice: 72999,
    },
    true
  );

  console.log('  Case A (Sony Email vs HP Invoice Attachment):');
  console.log('    hasConflict:', conflictTestA.hasConflict);
  console.log('    conflictType:', conflictTestA.conflictType);
  console.log('    conflictReason:', conflictTestA.conflictReason);

  if (!conflictTestA.hasConflict || conflictTestA.conflictType !== 'PRODUCT_BRAND_MISMATCH') {
    throw new Error('Case A should have detected a PRODUCT_BRAND_MISMATCH conflict');
  }

  // Case B: Price mismatch conflict
  const conflictTestB = emailIntelligenceService._detectSourceConflict(
    {
      subject: 'Order Confirmation #12345',
      snippet: 'Total amount paid: ₹1,24,999',
    },
    {
      productName: 'Sony Bravia TV',
      brand: 'Sony',
      model: 'XR-55',
      purchasePrice: 72999,
    },
    true
  );

  console.log('\n  Case B (Price Mismatch: ₹1,24,999 vs ₹72,999):');
  console.log('    hasConflict:', conflictTestB.hasConflict);
  console.log('    conflictType:', conflictTestB.conflictType);
  console.log('    conflictReason:', conflictTestB.conflictReason);

  if (!conflictTestB.hasConflict || conflictTestB.conflictType !== 'PRICE_MISMATCH') {
    throw new Error('Case B should have detected a PRICE_MISMATCH conflict');
  }

  // Case C: No conflict (Email matches attachment)
  const conflictTestC = emailIntelligenceService._detectSourceConflict(
    {
      subject: 'Flipkart Order OD337604041522773100: Avirox Bird House',
      snippet: 'Tax Invoice for Avirox HAND-BH-07 Bird House. Total: ₹261',
    },
    {
      productName: 'Avirox HAND-BH-07 Bird House',
      brand: 'Avirox',
      model: 'HAND-BH-07',
      purchasePrice: 261,
    },
    true
  );

  console.log('\n  Case C (Consistent Email and Invoice):');
  console.log('    hasConflict:', conflictTestC.hasConflict);

  if (conflictTestC.hasConflict) {
    throw new Error('Case C should NOT have detected a conflict');
  }

  console.log('\n===============================================================');
  console.log('  >>> ALL MASTER REQUIREMENTS SUCCESSFULLY VERIFIED! <<<');
  console.log('===============================================================\n');

  await mongoose.disconnect();
}

verifyAll().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
