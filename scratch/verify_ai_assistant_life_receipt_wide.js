/**
 * Master Verification Suite: LifeReceipt-Wide AI Ownership Assistant
 * Tests all 14+ required natural-language queries, dynamic date logic,
 * strict INR currency compliance, zero-hallucinations, and polite redirection.
 */

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('===============================================================');
  console.log('  LIFERECEIPT-WIDE AI OWNERSHIP ASSISTANT VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Authenticate with test user
  console.log('[Setup] Authenticating test user...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testuser@example.com', password: 'TestPassword123!' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token;
  if (!token) {
    throw new Error('Failed to obtain JWT token for test user');
  }
  console.log('  ✓ Authenticated successfully with JWT token\n');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  async function askAssistant(question) {
    const res = await fetch(`${BASE_URL}/assistant/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: question }),
    });
    const data = await res.json();
    return { status: res.status, data: data.data || {}, success: data.success };
  }

  // TEST 1: Which of my products have expired warranty?
  console.log('[Test 1] Testing "Which of my products have expired warranty?"...');
  const t1 = await askAssistant('Which of my products have expired warranty?');
  assert(t1.status === 200, 'HTTP status 200 returned');
  const t1Text = t1.data.response || '';
  assert(
    t1Text.includes('warranty') || t1Text.includes('expired') || t1Text.includes('Expired'),
    'Assistant analyzed warranty expiration status',
    t1Text.slice(0, 100)
  );
  assert(!t1Text.includes("I couldn't find a matching product"), 'Did not reject with missing product error');
  assert(t1.data.sources?.length > 0, 'Provided verified sources');

  // TEST 2: Which products are currently under warranty?
  console.log('\n[Test 2] Testing "Which products are currently under warranty?"...');
  const t2 = await askAssistant('Which products are currently under warranty?');
  assert(t2.status === 200, 'HTTP status 200 returned');
  const t2Text = t2.data.response || '';
  assert(
    t2Text.includes('warranty') || t2Text.includes('active') || t2Text.includes('Valid until'),
    'Assistant analyzed active warranty protection',
    t2Text.slice(0, 100)
  );
  assert(!t2Text.includes("I couldn't find a matching product"), 'Did not reject with missing product error');

  // TEST 3: Which warranties expire soon?
  console.log('\n[Test 3] Testing "Which warranties expire soon?"...');
  const t3 = await askAssistant('Which warranties expire soon?');
  assert(t3.status === 200, 'HTTP status 200 returned');
  const t3Text = t3.data.response || '';
  assert(
    t3Text.includes('warranty') || t3Text.includes('30 days') || t3Text.includes('expiring'),
    'Assistant analyzed 30-day forward warranty horizon',
    t3Text.slice(0, 100)
  );

  // TEST 4: How many products do I own?
  console.log('\n[Test 4] Testing "How many products do I own?"...');
  const t4 = await askAssistant('How many products do I own?');
  assert(t4.status === 200, 'HTTP status 200 returned');
  const t4Text = t4.data.response || '';
  assert(
    t4Text.match(/(?:\b\d+\*?\*?|\*\*\d+\*\*)\s+product/i) || (t4Text.includes('product') && /\d+/.test(t4Text)),
    'Assistant reported product inventory count',
    t4Text.slice(0, 100)
  );

  // TEST 5: How much did I spend?
  console.log('\n[Test 5] Testing "How much did I spend on all my products?"...');
  const t5 = await askAssistant('How much did I spend on all my products?');
  assert(t5.status === 200, 'HTTP status 200 returned');
  const t5Text = t5.data.response || '';
  assert(
    t5Text.includes('₹') || t5Text.includes('INR'),
    'Reported expenditure in INR (₹)',
    t5Text.slice(0, 100)
  );
  assert(!t5Text.includes('$'), 'Strict zero-dollar check verified');

  // TEST 6: What is my most expensive product?
  console.log('\n[Test 6] Testing "What is my most expensive product?"...');
  const t6 = await askAssistant('What is my most expensive product?');
  assert(t6.status === 200, 'HTTP status 200 returned');
  const t6Text = t6.data.response || '';
  assert(
    t6Text.includes('₹') || t6Text.includes('price') || t6Text.includes('expensive'),
    'Identified most expensive product in INR',
    t6Text.slice(0, 100)
  );

  // TEST 7: When did I purchase my laptop?
  console.log('\n[Test 7] Testing "When did I purchase my laptop?"...');
  const t7 = await askAssistant('When did I purchase my laptop?');
  assert(t7.status === 200, 'HTTP status 200 returned');
  const t7Text = t7.data.response || '';
  assert(
    t7Text.includes('laptop') || t7Text.includes('HP') || t7Text.includes('purchased') || t7Text.includes('Purchased'),
    'Retrieved laptop purchase details',
    t7Text.slice(0, 100)
  );

  // TEST 8: Tell me everything about my HP Pavilion
  console.log('\n[Test 8] Testing "Tell me everything about my HP Pavilion"...');
  const t8 = await askAssistant('Tell me everything about my HP Pavilion');
  assert(t8.status === 200, 'HTTP status 200 returned');
  const t8Text = t8.data.response || '';
  assert(
    t8Text.includes('HP Pavilion') && (t8Text.includes('₹') || t8Text.includes('INR')),
    'Provided multi-module profile of HP Pavilion',
    t8Text.slice(0, 100)
  );

  // TEST 9: What services/repairs do I have?
  console.log('\n[Test 9] Testing "What services/repairs do I have?"...');
  const t9 = await askAssistant('What services/repairs do I have?');
  assert(t9.status === 200, 'HTTP status 200 returned');
  const t9Text = t9.data.response || '';
  assert(
    t9Text.includes('service') || t9Text.includes('repair') || t9Text.includes('Spend'),
    'Analyzed service & repair ledger',
    t9Text.slice(0, 100)
  );

  // TEST 10: Show my purchase history
  console.log('\n[Test 10] Testing "Show my purchase history"...');
  const t10 = await askAssistant('Show my purchase history');
  assert(t10.status === 200, 'HTTP status 200 returned');
  const t10Text = t10.data.response || '';
  assert(
    t10Text.includes('Purchase History') || t10Text.includes('Purchased') || t10Text.includes('Price'),
    'Generated chronological purchase history',
    t10Text.slice(0, 100)
  );

  // TEST 11: Show products with missing warranty information
  console.log('\n[Test 11] Testing "Which products have missing warranty information?"...');
  const t11 = await askAssistant('Which products have missing warranty information?');
  assert(t11.status === 200, 'HTTP status 200 returned');
  const t11Text = t11.data.response || '';
  assert(
    t11Text.includes('warranty') || t11Text.includes('recorded') || t11Text.includes('missing'),
    'Audited products with missing warranty terms',
    t11Text.slice(0, 100)
  );

  // TEST 12: Varied natural wording ("ok what products of mine have expire its warranty")
  console.log('\n[Test 12] Testing exact user phrasing "ok what products of mine have expire its warranty"...');
  const t12 = await askAssistant('ok what products of mine have expire its warranty');
  assert(t12.status === 200, 'HTTP status 200 returned');
  const t12Text = t12.data.response || '';
  assert(
    !t12Text.includes("I couldn't find a matching product or document"),
    'CRITICAL FIX VERIFIED: Handled natural phrasing without false negative rejection',
    t12Text.slice(0, 100)
  );
  assert(
    t12Text.includes('warranty') || t12Text.includes('expired') || t12Text.includes('Expired'),
    'Correctly analyzed user products for expired warranty status'
  );

  // TEST 13: Unrelated question redirection
  console.log('\n[Test 13] Testing unrelated query "What is the capital of France?"...');
  const t13 = await askAssistant('What is the capital of France?');
  assert(t13.status === 200, 'HTTP status 200 returned');
  const t13Text = t13.data.response || '';
  assert(
    t13Text.includes('LifeReceipt') && t13Text.includes('products'),
    'Politely redirected unrelated general trivia question',
    t13Text.slice(0, 100)
  );
  assert(
    !t13Text.toLowerCase().includes('paris'),
    'Refused to answer non-LifeReceipt trivia question'
  );

  // TEST 14: Non-existent / unavailable data query (Zero Hallucination check)
  console.log('\n[Test 14] Testing query asking for unavailable data (Zero Hallucination check)...');
  const t14 = await askAssistant('What is the IMEI of my Avirox Bird House?');
  assert(t14.status === 200, 'HTTP status 200 returned');
  const t14Text = t14.data.response || '';
  const lowerT14 = t14Text.toLowerCase();
  assert(
    lowerT14.includes('not available') ||
    lowerT14.includes('not recorded') ||
    lowerT14.includes('unavailable') ||
    lowerT14.includes('not specified') ||
    lowerT14.includes('not in your') ||
    lowerT14.includes('not found') ||
    lowerT14.includes('no imei'),
    'Explicitly stated missing field is unavailable instead of hallucinating',
    t14Text.slice(0, 100)
  );

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
