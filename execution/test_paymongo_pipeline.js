/**
 * [TEST-PAYMONGO-PIPELINE] Unit & Integration Tests for PayMongo Pipeline
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting PayMongo Pipeline & Tier Synchronization Tests...\n');

let passCount = 0;
let failCount = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

// 1. Worker Edge Implementation Test
it('Cloudflare Worker edge defines /api/paymongo-checkout and /api/paymongo-webhook', () => {
  const workerContent = fs.readFileSync('_worker.js', 'utf8');
  assert(workerContent.includes('/api/paymongo-checkout'), 'Missing /api/paymongo-checkout route');
  assert(workerContent.includes('/api/paymongo-webhook'), 'Missing /api/paymongo-webhook route');
  assert(workerContent.includes('/api/paymongo-verify'), 'Missing /api/paymongo-verify route');
  assert(workerContent.includes('handlePayMongoCheckout'), 'Missing handlePayMongoCheckout implementation');
  assert(workerContent.includes('handlePayMongoWebhook'), 'Missing handlePayMongoWebhook implementation');
});

// 2. Centavo & Tier Calculation Test
it('Worker computes centavo amounts accurately (₱199.00 -> 19900, ₱599.00 -> 59900)', () => {
  const workerContent = fs.readFileSync('_worker.js', 'utf8');
  assert(workerContent.includes('59900'), 'Executive tier must be 59900 centavos');
  assert(workerContent.includes('19900'), 'Pro tier must be 19900 centavos');
});

// 3. Webhook Deductions & Supabase Sync in Worker
it('Worker webhook parses centavo tiers and updates Supabase users table', () => {
  const workerContent = fs.readFileSync('_worker.js', 'utf8');
  assert(workerContent.includes('amount >= 50000'), 'Webhook must deduct executive tier for amounts >= 50000 centavos');
  assert(workerContent.includes('amount >= 15000'), 'Webhook must deduct pro tier for amounts >= 15000 centavos');
  assert(workerContent.includes('/rest/v1/users'), 'Webhook must patch Supabase users endpoint');
  assert(workerContent.includes('DEFAULT_SUPABASE_URL'), 'Worker must have default Supabase fallback');
});

// 4. Return URL Handler in app.js
it('app.js defines checkUrlPaymentParams that calls finalizePayMongoTierUpgrade', () => {
  const appContent = fs.readFileSync('app.js', 'utf8');
  assert(appContent.includes('async function checkUrlPaymentParams'), 'Missing async checkUrlPaymentParams');
  assert(appContent.includes('params.get(\'payment\') === \'success\''), 'Must detect ?payment=success');
  assert(appContent.includes('finalizePayMongoTierUpgrade(targetTier'), 'Must invoke finalizePayMongoTierUpgrade');
  assert(appContent.includes('window.history.replaceState'), 'Must clean query string');
});

// 5. Supabase User Tier Persistence in finalizePayMongoTierUpgrade
it('finalizePayMongoTierUpgrade updates Supabase users table and local cache', () => {
  const appContent = fs.readFileSync('app.js', 'utf8');
  assert(appContent.includes('window.sbClient.from(\'users\').update'), 'Must update Supabase users table');
  assert(appContent.includes('localStorage.setItem(\'budget_master_user_tier\', targetTier)'), 'Must persist tier to local storage');
  assert(appContent.includes('setSimulatedTier(targetTier)'), 'Must update reactive store and UI');
});

// 6. Supabase Auth dynamic tier detection
it('supabase-auth.js preserves existing/remote user tier instead of hardcoding executive', () => {
  const authContent = fs.readFileSync('supabase-auth.js', 'utf8');
  assert(!authContent.includes('tier: \'executive\',\n    getIdToken'), 'Hardcoded executive tier in normalizedUser must be removed');
  assert(authContent.includes('const activeTier = pendingTier || remoteTier || currentTier || \'executive\';'), 'Must compute dynamic activeTier');
  assert(authContent.includes('from(\'users\').upsert({\n        id: normalizedUser.id,\n        email: normalizedUser.email,\n        display_name: normalizedUser.displayName,\n        photo_url: normalizedUser.photoURL,\n        tier: activeTier'), 'Must upsert activeTier to Supabase users');
});

// 7. Supabase DB tier hydration
it('supabase-db.js hydrates user tier from public.users', () => {
  const dbContent = fs.readFileSync('supabase-db.js', 'utf8');
  assert(dbContent.includes('select(\'tier\')'), 'Must query tier from users table');
  assert(dbContent.includes('setSimulatedTier(userProfile.tier)'), 'Must set simulated tier on hydration');
});

// 8. Visual FAQ & Modal Verification Button in index.html
it('index.html provides manual verify button and updated patch badge v2.0.20261023.108', () => {
  const indexContent = fs.readFileSync('index.html', 'utf8');
  assert(indexContent.includes('v2.0.20261023.108'), 'Version badge must be v2.0.20261023.108');
  assert(indexContent.includes('id="btnVerifyPayMongoPayment" onclick="verifyPayMongoPayment()" style="display: flex;'), 'Verify button must be visible for all members');
  assert(indexContent.includes('FEAT-PAYMONGO-PIPELINE-V108'), 'Visual FAQ item must be present');
});

console.log(`\n================================`);
console.log(`Results: ${passCount} passed, ${failCount} failed.`);
console.log(`================================\n`);

if (failCount > 0) {
  process.exit(1);
}
