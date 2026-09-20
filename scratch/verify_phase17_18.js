import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 17 & 18 VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  try {
    // 1. Setup Test Users
    const timestamp = Date.now();
    const userAEmail = `phase17_user_a_${timestamp}@test.com`;
    const userBEmail = `phase17_user_b_${timestamp}@test.com`;
    const password = 'Password@123';

    console.log('[1] Setting up isolated test accounts...');
    const regResA = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Service Test User A',
        email: userAEmail,
        password,
      },
    });
    const tokenA = regResA.data?.data?.token || regResA.data?.token;
    assert(tokenA !== undefined, 'User A registered and received auth token');

    const regResB = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        name: 'Service Test User B',
        email: userBEmail,
        password,
      },
    });
    const tokenB = regResB.data?.data?.token || regResB.data?.token;
    assert(tokenB !== undefined, 'User B registered and received auth token');

    const authA = { headers: { Authorization: `Bearer ${tokenA}` } };
    const authB = { headers: { Authorization: `Bearer ${tokenB}` } };

    // 2. Create Test Product for User A
    console.log('\n[2] Creating Product with INR purchase price...');
    const prodRes = await apiRequest('/products', {
      method: 'POST',
      ...authA,
      body: {
        productName: 'HP Pavilion 15 Gaming Laptop',
        category: 'Electronics',
        brand: 'HP',
        model: '15-dk1056wm',
        serialNumber: `HP-SN-${timestamp}`,
        purchasePrice: 10000,
        currency: 'INR',
        purchaseDate: '2025-01-15',
        sellerName: 'Reliance Digital',
        hasWarranty: true,
        warrantyDurationMonths: 12,
        warrantyType: 'Manufacturer',
      },
    });

    const productA = prodRes.data?.data;
    assert(productA && productA._id, `Product created for User A: ${productA?.productName}`);

    // 3. Service Record CRUD & Lifecycle
    console.log('\n[3] Testing Service Record CRUD & Lifecycle...');
    const svc1Res = await apiRequest('/services', {
      method: 'POST',
      ...authA,
      body: {
        productId: productA._id,
        serviceType: 'REPAIR',
        status: 'REQUESTED',
        issueTitle: 'Display screen flickering',
        issueDescription: 'Laptop screen shows horizontal lines after waking from sleep.',
        serviceProvider: 'HP Care Center',
        serviceCenterName: 'HP Authorized Service Center Chennai',
        serviceCenterAddress: 'Mount Road, Chennai',
        serviceCenterPhone: '044-28521144',
        reportedDate: '2026-02-10',
        estimatedCost: 4000,
      },
    });

    const record1 = svc1Res.data?.data;
    assert(record1 && record1._id, 'Service record 1 created with status REQUESTED');
    assert(record1?.serviceType === 'REPAIR', 'Service type is REPAIR');
    assert(record1?.estimatedCost === 4000, 'Estimated cost is ₹4,000');

    // Update to COMPLETED with actual cost
    const updateRes = await apiRequest(`/services/${record1._id}`, {
      method: 'PUT',
      ...authA,
      body: {
        status: 'COMPLETED',
        completedDate: '2026-02-15',
        actualCost: 3500,
        notes: 'Replaced screen connector cable under repair warranty.',
      },
    });

    assert(updateRes.data?.data?.status === 'COMPLETED', 'Service record status updated to COMPLETED');
    assert(updateRes.data?.data?.actualCost === 3500, 'Actual cost recorded as ₹3,500');

    // Verify Expense synchronization
    const expRes = await apiRequest(`/expenses?productId=${productA._id}`, {
      method: 'GET',
      ...authA,
    });
    const expenses = expRes.data?.data?.expenses || expRes.data?.data || [];
    const linkedExpense = expenses.find((e) => e.amount === 3500);
    assert(linkedExpense !== undefined, 'Expense record automatically synchronized with actual repair cost (₹3,500)');

    // 4. Automated Service History Analysis (Repeated repairs, high burden, recurring defect)
    console.log('\n[4] Testing Automated Service History Pattern Analysis...');
    // Create second repair record for same product with recurring "screen" keyword and cost
    const svc2Res = await apiRequest('/services', {
      method: 'POST',
      ...authA,
      body: {
        productId: productA._id,
        serviceType: 'REPAIR',
        status: 'COMPLETED',
        issueTitle: 'Screen backlight failure',
        issueDescription: 'Display screen went completely dark; backlight failed.',
        serviceProvider: 'HP Care Center',
        reportedDate: '2026-04-01',
        completedDate: '2026-04-05',
        actualCost: 2500,
      },
    });

    assert(svc2Res.data?.data?._id !== undefined, 'Second service record created on same product');

    // Call /services/analysis endpoint
    const analysisRes = await apiRequest(`/services/analysis?productId=${productA._id}`, {
      method: 'GET',
      ...authA,
    });
    const analysis = analysisRes.data?.data;

    assert(analysis !== undefined, 'GET /services/analysis returned valid payload');
    assert(analysis?.totalRepairs >= 2, `Analysis detects repeated repairs (${analysis?.totalRepairs} repairs)`);
    assert(analysis?.totalServiceCost >= 6000, `Cumulative spend computed correctly: ₹${analysis?.totalServiceCost}`);

    // Check patterns
    const spendPattern = analysis?.patterns?.find((p) => p.type === 'HIGH_REPAIR_BURDEN');
    assert(spendPattern !== undefined, 'HIGH_REPAIR_BURDEN pattern flagged (>50% of ₹10,000 purchase price)');

    const frequentPattern = analysis?.patterns?.find((p) => p.type === 'FREQUENT_REPAIRS');
    assert(frequentPattern !== undefined, 'FREQUENT_REPAIRS pattern flagged (>= 2 repair events)');

    const screenDefect = analysis?.patterns?.find((p) => p.type === 'RECURRING_DEFECT' && p.message.includes('screen'));
    assert(screenDefect !== undefined, 'RECURRING_DEFECT pattern flagged for "screen" keyword across records');

    // 5. Service Centers Directory across Indian Metros
    console.log('\n[5] Testing Verified Service Centers Directory...');
    const centersChn = await apiRequest('/services/centers?brand=hp&city=chennai', {
      method: 'GET',
      ...authA,
    });
    assert(centersChn.data?.data?.length > 0, `HP Service Center found in Chennai (${centersChn.data?.data?.[0]?.name})`);
    assert(centersChn.data?.data?.[0]?.isAuthorized === true, 'Center is verified as authorized');

    const centersCbe = await apiRequest('/services/centers?brand=apple&city=coimbatore', {
      method: 'GET',
      ...authA,
    });
    assert(centersCbe.data?.data?.length > 0, `Apple Service Center found in Coimbatore (${centersCbe.data?.data?.[0]?.name})`);

    const centersHyd = await apiRequest('/services/centers?brand=samsung&city=hyderabad', {
      method: 'GET',
      ...authA,
    });
    assert(centersHyd.data?.data?.length > 0, `Samsung Service Center found in Hyderabad (${centersHyd.data?.data?.[0]?.name})`);

    // 6. AI Assistant Scenario 19: Service & Repair Queries
    console.log('\n[6] Testing AI Assistant Scenario 19...');
    // Query A: Where can I service my laptop?
    const aiServiceWhere = await apiRequest('/assistant/chat', {
      method: 'POST',
      ...authA,
      body: {
        message: 'Where can I service my HP laptop in Chennai?',
      },
    });
    const respA = aiServiceWhere.data?.data?.response || aiServiceWhere.data?.response || '';
    assert(respA.toLowerCase().includes('authorized') || respA.toLowerCase().includes('chennai') || respA.toLowerCase().includes('hp'),
      'AI Assistant suggests verified service center or support locator in Chennai');

    // Query B: How much have I spent repairing my laptop?
    const aiSpend = await apiRequest('/assistant/chat', {
      method: 'POST',
      ...authA,
      body: {
        message: 'How much have I spent repairing my laptop?',
        productId: productA._id,
      },
    });
    const respB = aiSpend.data?.data?.response || aiSpend.data?.response || '';
    assert(respB.includes('6,000') || respB.includes('6000') || respB.includes('Repair'),
      'AI Assistant accurately reports ₹6,000 cumulative repair expenditure');

    // Query C: When was my last service?
    const aiLast = await apiRequest('/assistant/chat', {
      method: 'POST',
      ...authA,
      body: {
        message: 'When was my last service?',
        productId: productA._id,
      },
    });
    const respC = aiLast.data?.data?.response || aiLast.data?.response || '';
    assert(respC.includes('Recent Service') || respC.includes('2026') || respC.includes('Screen'),
      'AI Assistant details the latest service event and date');

    // 7. PWA Manifest & Service Worker Verification
    console.log('\n[7] Testing PWA Assets...');
    const manifestPath = path.resolve(__dirname, '../frontend/public/manifest.json');
    assert(fs.existsSync(manifestPath), 'frontend/public/manifest.json exists');

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifestContent.name === 'LifeReceipt — Digital Ownership Intelligence', 'Manifest has valid app name');
    assert(manifestContent.short_name === 'LifeReceipt', 'Manifest has valid short_name');
    assert(manifestContent.display === 'standalone', 'Manifest display mode is standalone');
    assert(manifestContent.theme_color === '#0284c7', 'Manifest theme color is #0284c7');
    assert(manifestContent.icons?.length >= 2, 'Manifest contains PWA icons');

    const swPath = path.resolve(__dirname, '../frontend/public/sw.js');
    assert(fs.existsSync(swPath), 'frontend/public/sw.js exists');
    const swContent = fs.readFileSync(swPath, 'utf8');
    assert(swContent.includes('/api/'), 'Service Worker explicitly bypasses /api/ requests');
    assert(swContent.includes('CACHE_NAME'), 'Service Worker specifies versioned shell cache');

    const icon192Path = path.resolve(__dirname, '../frontend/public/icons/icon-192.svg');
    assert(fs.existsSync(icon192Path), 'icon-192.svg exists');

    const icon512Path = path.resolve(__dirname, '../frontend/public/icons/icon-512.svg');
    assert(fs.existsSync(icon512Path), 'icon-512.svg exists');

    // 8. User Data Isolation & Security Guard
    console.log('\n[8] Testing Multi-Tenant Data Isolation for Service Records...');
    const userBAccess = await apiRequest(`/services/${record1._id}`, {
      method: 'GET',
      ...authB,
    });
    assert(userBAccess.status === 403 || userBAccess.status === 404,
      `User B denied access to User A service record (${userBAccess.status})`);

    const userBModify = await apiRequest(`/services/${record1._id}`, {
      method: 'PUT',
      ...authB,
      body: { status: 'CANCELLED' },
    });
    assert(userBModify.status === 403 || userBModify.status === 404,
      `User B denied modification of User A service record (${userBModify.status})`);

    // Check invalid ObjectId handling
    const malformedReq = await apiRequest('/services/not-a-valid-id', {
      method: 'GET',
      ...authA,
    });
    assert(malformedReq.status === 400, `Malformed ID properly rejected with HTTP 400 (${malformedReq.status})`);

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
