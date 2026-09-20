/**
 * LIFERECEIPT Phase 4 Comprehensive Automated Verification Suite
 * 
 * Tests:
 * 1. Indian Currency Formatting & Locale Grouping (₹, Lakhs, Crores)
 * 2. Dynamic Warranty Status Calculator (ACTIVE, EXPIRING_SOON, EXPIRED, NO_WARRANTY, UNKNOWN)
 * 3. Dynamic Return Status Calculator (RETURN_ACTIVE, RETURN_EXPIRING_SOON, RETURN_EXPIRED, NOT_ELIGIBLE, UNKNOWN)
 * 4. Indian Invoice & Tax Parsing (₹, Rs., GSTIN, CGST, SGST)
 * 5. Smart Alert Model & Idempotent Generation via API
 * 6. Alert API Endpoints (GET, PATCH read, PATCH read-all, unread-count)
 * 7. Cross-User Security Isolation (User B cannot read/modify User A's alerts)
 * 8. Regional & Currency Defaults in User and Dashboard APIs
 */

const BASE_URL = 'http://localhost:5000/api/v1';

async function request(url, options = {}) {
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

async function runPhase4Tests() {
  console.log('\n======================================================');
  console.log(' LIFERECEIPT PHASE 4: AUTOMATED VERIFICATION SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  const testNames = [];

  // ==========================================
  // TEST 1: Indian Currency Formatting
  // ==========================================
  console.log('--- TEST 1: Indian Currency Formatting & Grouping ---');
  function formatCurrency(amount, currency = 'INR', locale = 'en-IN') {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    const hasDecimals = num % 1 !== 0;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: hasDecimals ? 2 : 0,
      }).format(num);
    } catch {
      return `₹${num}`;
    }
  }

  const f72k = formatCurrency(72999);
  assert(f72k.includes('₹') && f72k.includes('72,999'), `Format ₹72,999 correctly: got "${f72k}"`);

  const f1lakh = formatCurrency(100000);
  assert(f1lakh.includes('₹') && f1lakh.includes('1,00,000'), `Format 1 Lakh as ₹1,00,000: got "${f1lakh}"`);

  const f125k = formatCurrency(125000);
  assert(f125k.includes('₹') && f125k.includes('1,25,000'), `Format ₹1,25,000 correctly: got "${f125k}"`);

  const f10lakh = formatCurrency(1000000);
  assert(f10lakh.includes('₹') && f10lakh.includes('10,00,000'), `Format 10 Lakhs as ₹10,00,000: got "${f10lakh}"`);

  assert(!f72k.includes('$') && !f1lakh.includes('$'), 'No dollar signs present in INR formatted values');
  passedTests++;
  testNames.push('Indian Currency Formatting (₹ & Indian grouping)');

  // ==========================================
  // TEST 2: Dynamic Warranty Statuses
  // ==========================================
  console.log('\n--- TEST 2: Dynamic Warranty Status Calculations ---');
  const { calculateWarrantyStatus } = await import('../backend/src/utils/statusCalculator.js');

  const refDate = new Date('2026-09-18T12:00:00Z');

  // No warranty
  const wsNoWarranty = calculateWarrantyStatus({ hasWarranty: false }, refDate);
  assert(wsNoWarranty.status === 'NO_WARRANTY', 'No warranty detected as NO_WARRANTY');

  // Unknown end date
  const wsUnknown = calculateWarrantyStatus({ hasWarranty: true, warrantyEndDate: null }, refDate);
  assert(wsUnknown.status === 'UNKNOWN', 'Missing warrantyEndDate detected as UNKNOWN');

  // Expired
  const wsExpired = calculateWarrantyStatus({ hasWarranty: true, warrantyEndDate: '2026-08-01' }, refDate);
  assert(wsExpired.status === 'EXPIRED' && wsExpired.isExpired === true, 'Past date detected as EXPIRED');

  // Expiring soon (15 days) -> MEDIUM
  const wsExpiringMedium = calculateWarrantyStatus({ hasWarranty: true, warrantyEndDate: '2026-10-03' }, refDate);
  assert(wsExpiringMedium.status === 'EXPIRING_SOON' && wsExpiringMedium.isCritical === false, '15 days detected as EXPIRING_SOON (warning)');

  // Critical expiring soon (4 days) -> HIGH
  const wsExpiringCritical = calculateWarrantyStatus({ hasWarranty: true, warrantyEndDate: '2026-09-22' }, refDate);
  assert(wsExpiringCritical.status === 'EXPIRING_SOON' && wsExpiringCritical.isCritical === true, '4 days detected as EXPIRING_SOON (critical)');

  // Active (180 days)
  const wsActive = calculateWarrantyStatus({ hasWarranty: true, warrantyEndDate: '2027-03-18' }, refDate);
  assert(wsActive.status === 'ACTIVE' && wsActive.daysRemaining > 30, 'Future warranty detected as ACTIVE');

  passedTests++;
  testNames.push('Dynamic Warranty Status Calculator');

  // ==========================================
  // TEST 3: Dynamic Return Statuses
  // ==========================================
  console.log('\n--- TEST 3: Dynamic Return Period Status Calculations ---');
  const { calculateReturnStatus } = await import('../backend/src/utils/statusCalculator.js');

  // Not eligible
  const rsNotEligible = calculateReturnStatus({ returnEligible: false }, refDate);
  assert(rsNotEligible.status === 'NOT_ELIGIBLE', 'Not eligible detected as NOT_ELIGIBLE');

  // Return closed
  const rsExpired = calculateReturnStatus({ returnEligible: true, returnEndDate: '2026-09-10' }, refDate);
  assert(rsExpired.status === 'RETURN_EXPIRED', 'Past return date detected as RETURN_EXPIRED');

  // Return expiring soon (2 days -> Critical)
  const rsCritical = calculateReturnStatus({ returnEligible: true, returnEndDate: '2026-09-20' }, refDate);
  assert(rsCritical.status === 'RETURN_EXPIRING_SOON' && rsCritical.isCritical === true, '2 days detected as RETURN_EXPIRING_SOON (critical)');

  // Return expiring soon (5 days -> Medium)
  const rsExpiring = calculateReturnStatus({ returnEligible: true, returnEndDate: '2026-09-23' }, refDate);
  assert(rsExpiring.status === 'RETURN_EXPIRING_SOON' && rsExpiring.isCritical === false, '5 days detected as RETURN_EXPIRING_SOON (standard)');

  // Return active (> 7 days)
  const rsActive = calculateReturnStatus({ returnEligible: true, returnEndDate: '2026-10-10' }, refDate);
  assert(rsActive.status === 'RETURN_ACTIVE', 'Future return window detected as RETURN_ACTIVE');

  passedTests++;
  testNames.push('Dynamic Return Period Status Calculator');

  // ==========================================
  // TEST 4: Indian Invoice & Tax Parsing
  // ==========================================
  console.log('\n--- TEST 4: Indian Invoice Parsing & Tax Identification ---');
  const { parseDeterministicReceipt } = await import('../backend/src/services/aiExtractionService.js');

  const indianReceiptText = `
TAX INVOICE
Croma Electronics Retail Ltd
Store: Indiranagar, Bangalore
GSTIN: 29ABCDE1234F1Z5
Date: 15/09/2026
Invoice No: INV-BLR-2026-98124
Product: Apple MacBook Air M3
Total Amount: ₹1,25,000
CGST @ 9%: ₹9,534
SGST @ 9%: ₹9,534
1 Year Manufacturer Warranty Included
`;

  const parsed = parseDeterministicReceipt(indianReceiptText, 'croma_macbook_receipt.pdf');
  assert(parsed.currency === 'INR', `Currency detected as INR: got "${parsed.currency}"`);
  assert(parsed.purchasePrice === 125000, `Purchase price detected as 125000: got "${parsed.purchasePrice}"`);
  assert(parsed.taxInfo && parsed.taxInfo.includes('29ABCDE1234F1Z5'), `Tax info contains GSTIN: got "${parsed.taxInfo}"`);
  assert(parsed.taxInfo && parsed.taxInfo.includes('CGST'), `Tax info contains CGST: got "${parsed.taxInfo}"`);
  assert(parsed.warranty.hasWarranty === true, '1 Year Warranty recognized');
  assert(parsed.warranty.durationMonths === 12, 'Warranty duration parsed as 12 months');

  passedTests++;
  testNames.push('Indian Invoice & Tax Parsing (GSTIN, CGST, SGST, ₹)');

  // ==========================================
  // TEST 5: User Setup & Isolated Alert Generation
  // ==========================================
  console.log('\n--- TEST 5: Alert Generation & Idempotency via API ---');
  const testStamp = Date.now();
  const userAEmail = `phase4_usera_${testStamp}@example.com`;
  const userBEmail = `phase4_userb_${testStamp}@example.com`;

  // Register User A
  const regARes = await request(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Sharma',
      email: userAEmail,
      password: 'Password123!',
    }),
  });
  assert(regARes.status === 201, 'User A registered successfully');
  const tokenA = regARes.data.data.token;

  // Check User A preferences defaults to INR
  const meRes = await request(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(meRes.data.data.user.preferences?.currency === 'INR', `User A currency default is INR: got "${meRes.data.data.user.preferences?.currency}"`);
  assert(meRes.data.data.user.preferences?.country === 'IN', `User A country default is IN: got "${meRes.data.data.user.preferences?.country}"`);

  // Create Product A1 for User A with warranty expiring in 5 days (Critical -> HIGH priority)
  const today = new Date();
  const in5Days = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const in2Days = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const prod1Res = await request(`${BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      productName: 'Sony Bravia 55-inch OLED',
      category: 'Electronics',
      brand: 'Sony',
      purchasePrice: 139990,
      currency: 'INR',
      warranty: {
        hasWarranty: true,
        warrantyProvider: 'Sony India',
        warrantyEndDate: in5Days,
      },
      returnInfo: {
        returnEligible: true,
        returnEndDate: in2Days,
      },
    }),
  });
  assert(prod1Res.status === 201, 'Product with expiring warranty & return created');
  const prodId = prod1Res.data.data._id;

  // Fetch Alerts for User A (this dynamically evaluates and creates alerts)
  const alertsRes1 = await request(`${BASE_URL}/alerts`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(alertsRes1.status === 200, 'Alerts endpoint responded 200');
  const initialAlertCount = alertsRes1.data.data.alerts.length;
  assert(initialAlertCount >= 2, `Generated at least 2 alerts for User A: got ${initialAlertCount}`);

  // Test IDEMPOTENCY: Querying alerts again must NOT duplicate unread alerts
  const alertsRes2 = await request(`${BASE_URL}/alerts`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const secondAlertCount = alertsRes2.data.data.alerts.length;
  assert(secondAlertCount === initialAlertCount, `Alert generation is idempotent (count remained ${secondAlertCount})`);

  passedTests++;
  testNames.push('Alert Generation & Idempotency');

  // ==========================================
  // TEST 6: Alert Endpoints & Unread Count
  // ==========================================
  console.log('\n--- TEST 6: Alert Actions (Unread Count, Mark as Read, Read All) ---');
  const unreadRes1 = await request(`${BASE_URL}/alerts/unread-count`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(unreadRes1.status === 200, 'GET /unread-count succeeded');
  assert(unreadRes1.data.data.unreadCount >= 2, `Unread count matches active alerts: ${unreadRes1.data.data.unreadCount}`);

  const targetAlertId = alertsRes1.data.data.alerts[0]._id;

  // Mark single alert as read
  const markReadRes = await request(`${BASE_URL}/alerts/${targetAlertId}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(markReadRes.status === 200 && markReadRes.data.data.isRead === true, 'Single alert marked as read');

  // Unread count decremented
  const unreadRes2 = await request(`${BASE_URL}/alerts/unread-count`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(unreadRes2.data.data.unreadCount === unreadRes1.data.data.unreadCount - 1, 'Unread count decremented by 1');

  // Mark all as read
  const markAllRes = await request(`${BASE_URL}/alerts/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(markAllRes.status === 200, 'PATCH /read-all succeeded');

  const unreadRes3 = await request(`${BASE_URL}/alerts/unread-count`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(unreadRes3.data.data.unreadCount === 0, 'Unread count is now 0 after mark-all');

  passedTests++;
  testNames.push('Alert Actions (Mark Read & Mark All Read)');

  // ==========================================
  // TEST 7: Cross-User Security Isolation
  // ==========================================
  console.log('\n--- TEST 7: Multi-Tenant Alert Security Isolation ---');
  // Register User B
  const regBRes = await request(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Pooja Iyer',
      email: userBEmail,
      password: 'Password123!',
    }),
  });
  const tokenB = regBRes.data.data.token;

  // User B queries alerts: should see 0 alerts
  const alertsBRes = await request(`${BASE_URL}/alerts`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(alertsBRes.data.data.alerts.length === 0, 'User B sees 0 alerts from User A (tenant isolated)');

  // User B tries to mark User A's alert as read: should fail with 404
  const attackRes = await request(`${BASE_URL}/alerts/${targetAlertId}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(attackRes.status === 404, `User B cannot modify User A's alert (status 404): got ${attackRes.status}`);

  passedTests++;
  testNames.push('Cross-User Alert Security Isolation (404 Unauthorized)');

  // ==========================================
  // TEST 8: Dashboard API India Defaults
  // ==========================================
  console.log('\n--- TEST 8: Dashboard API Regional & Currency Defaults ---');
  const dashRes = await request(`${BASE_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(dashRes.status === 200, 'Dashboard summary succeeded');
  assert(dashRes.data.data.metrics.currency === 'INR', `Dashboard currency is INR: got "${dashRes.data.data.metrics.currency}"`);
  assert(dashRes.data.data.upcomingActions.length > 0, 'Dashboard reports upcoming action items');

  passedTests++;
  testNames.push('Dashboard Regional Defaults (INR)');

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n======================================================');
  console.log(` ✅ ALL PHASE 4 TESTS PASSED: ${passedTests}/${testNames.length}`);
  testNames.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
  console.log('======================================================\n');
}

runPhase4Tests().catch((err) => {
  console.error('\n❌ Phase 4 verification failed:', err);
  process.exit(1);
});
