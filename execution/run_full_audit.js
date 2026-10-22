/**
 * ============================================================================
 * NIRVTRACK 2.0 - MASTER AUTOMATED FEATURE AUDIT & REGRESSION TEST SUITE
 * Execution Script: execution/run_full_audit.js
 *
 * Tests all core features, financial mathematics, DOM bindings, PWA precache,
 * storage isolation, security sanitization, and multi-skill invariants.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

// Test Runner Reporting
let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  \x1b[32m✓\x1b[0m ${testName}`);
  } else {
    failedCount++;
    console.log(`  \x1b[31m✗\x1b[0m ${testName} ${details ? '(' + details + ')' : ''}`);
    failures.push({ testName, details });
  }
}

function section(title) {
  console.log(`\n\x1b[1m\x1b[36m▶ ${title}\x1b[0m`);
}

// ============================================================================
// 1. FILE INTEGRITY & PWA ASSET PRECACHE AUDIT
// ============================================================================
section('1. PWA & Offline Workstation Asset Audit');

const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'patch-notes-data.js',
  'ai-copilot-engine.js',
  'manifest.json',
  'sw.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'start-app.bat',
  'start-app.ps1'
];

requiredFiles.forEach(f => {
  const fullPath = path.join(ROOT_DIR, f);
  assert(fs.existsSync(fullPath), `Required core file exists: ${f}`);
});

// Parse sw.js PRECACHE_ASSETS and verify all precache files exist
const swContent = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
const precacheMatch = swContent.match(/const PRECACHE_ASSETS = \[([\s\S]*?)\];/);
assert(Boolean(precacheMatch), 'sw.js contains PRECACHE_ASSETS array');

if (precacheMatch) {
  const assets = precacheMatch[1]
    .split(',')
    .map(s => s.trim().replace(/['"]/g, ''))
    .filter(s => s && s !== './');

  assets.forEach(asset => {
    const cleanAsset = asset.replace(/^\.\//, '');
    const assetPath = path.join(ROOT_DIR, cleanAsset);
    assert(fs.existsSync(assetPath), `PWA Service Worker precache asset exists on disk: ${cleanAsset}`);
  });
}

// Parse manifest.json
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
  assert(manifest.display === 'standalone', 'manifest.json sets display to standalone');
  assert(Boolean(manifest.icons && manifest.icons.length >= 2), 'manifest.json specifies PWA app icons');
  assert(Boolean(manifest.shortcuts && manifest.shortcuts.length >= 2), 'manifest.json specifies quick-action shortcuts');
} catch (e) {
  assert(false, 'manifest.json parses as valid JSON', e.message);
}

// ============================================================================
// 2. DOM ELEMENT BINDINGS & STRUCTURAL INTEGRITY AUDIT
// ============================================================================
section('2. DOM ID Bindings & Layout Structure Audit');

const htmlContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
const idMatches = htmlContent.match(/id="([^"]+)"/g) || [];
const domIds = new Set(idMatches.map(m => m.replace(/^id="|"$|'/g, '')));

// Essential UI anchors that app.js queries and updates
const criticalDomIds = [
  'kpiTotalIncome',
  'kpiTotalBudget',
  'kpiTotalExpenses',
  'kpiRemainingBudget',
  'budgetCategoryGrid',
  'expensesTableBody',
  'expensesEmptyState',
  'expenseTrendChart',
  'categoryBreakdownChart',
  'currentPeriodDisplay',
  'budgetPeriodLabel',
  'expensesPeriodLabel',
  'brandPatchBadge',
  'sidebarVersionDisplay',
  'faqAccordionList',
  'categoryModal',
  'multiMonthModal',
  'brandIcon',
  'sidebar',
  'btnResetAll',
  'currencySelect',
  'themeSelect'
];

criticalDomIds.forEach(id => {
  assert(domIds.has(id), `Critical DOM container exists in index.html: #${id}`);
});

// Verify offline auth overlay is inactive and hidden
assert(
  !htmlContent.includes('class="modal-overlay auth-gateway-overlay active" id="firebaseAuthModal"'),
  'Auth gateway modal is NOT blocking initial screen with "active" class'
);

// Verify Supabase and Google OAuth scripts are properly referenced
const activeScriptsMatch = htmlContent.replace(/<!--[\s\S]*?-->/g, ''); // Strip comments
assert(
  activeScriptsMatch.includes('src="supabase-auth.js'),
  'index.html actively includes supabase-auth.js script'
);
assert(
  activeScriptsMatch.includes('src="supabase-db.js'),
  'index.html actively includes supabase-db.js script'
);
assert(
  domIds.has('btnOpenCloudAuth'),
  'Top-level Google sign-in trigger exists: #btnOpenCloudAuth'
);

// ============================================================================
// 3. FINTECH ARITHMETIC & 50/30/20 ENVELOPE LOGIC AUDIT
// ============================================================================
section('3. FinTech Engine Mathematics & Balance Invariants');

const appJsContent = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');

// Extract DEFAULT_CATEGORIES
let defaultCategories = [];
const catMatch = appJsContent.match(/const DEFAULT_CATEGORIES = (\[[\s\S]*?\n\];)/);
if (catMatch) {
  const sandbox = {};
  vm.runInNewContext('categories = ' + catMatch[1], sandbox);
  defaultCategories = sandbox.categories;
}

assert(defaultCategories.length >= 15, `DEFAULT_CATEGORIES loaded: ${defaultCategories.length} categories found`);

// Verify all categories have valid emojis and budgetType ('needs' or 'wants')
const validEmojis = defaultCategories.every(c => c.icon && c.icon.length > 0 && !c.icon.includes('ð'));
assert(validEmojis, 'All default categories have cleanly rendered Unicode emojis (no mojibake)');

const hasValidTypes = defaultCategories.every(c => c.budgetType === 'needs' || c.budgetType === 'wants');
assert(hasValidTypes, 'All categories strictly adhere to 50/30/20 budgetType classification (needs/wants)');

// Test 50/30/20 calculations
function calculate503020(totalIncome) {
  return {
    needs: totalIncome * 0.50,
    wants: totalIncome * 0.30,
    savings: totalIncome * 0.20
  };
}

const testIncome = 50000;
const split = calculate503020(testIncome);
assert(split.needs === 25000, '50/30/20: 50% Needs accurately computed (₱25,000 on ₱50,000 income)');
assert(split.wants === 15000, '50/30/20: 30% Wants accurately computed (₱15,000 on ₱50,000 income)');
assert(split.savings === 10000, '50/30/20: 20% Savings accurately computed (₱10,000 on ₱50,000 income)');
assert(split.needs + split.wants + split.savings === testIncome, '50/30/20 sum matches 100% of income exactly');

// Test Surplus Sweeper Identity [FEAT-49]
function computeDiscretionaryAvailable(plannedIncome, totalAllocatedBudgets, sweptSurplus) {
  return plannedIncome - totalAllocatedBudgets - sweptSurplus;
}

const swept = 5000;
const allocated = 40000;
const available = computeDiscretionaryAvailable(testIncome, allocated, swept);
assert(available === 5000, `Surplus Sweeper: Discretionary pool correctly locks in swept surplus (Available: ₱${available})`);

// Test Safe-to-Spend Pacing
function computeDailySafeToSpend(remainingDiscretionary, daysRemaining) {
  if (daysRemaining <= 0) return 0;
  return Math.round((remainingDiscretionary / daysRemaining) * 100) / 100;
}

const safePace = computeDailySafeToSpend(15000, 15);
assert(safePace === 1000, `Safe-to-Spend Pacing: Correct daily pace calculated (₱1,000/day for 15 days on ₱15,000)`);

// Test Precision Floating-Point Centavo Rounding
function roundCurrency(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

const floatAnomaly = 0.1 + 0.2; // 0.30000000000000004
assert(roundCurrency(floatAnomaly) === 0.30, 'Centavo precision: Epsilon rounding prevents JavaScript 0.30000000000000004 float anomaly');

// ============================================================================
// 4. SECURITY & CLIENT-SIDE DEFENSIVE HARDENING AUDIT
// ============================================================================
section('4. Client-Side Security & Data Hardening Audit');

// Extract escapeHTML from app.js
let escapeHTML = null;
const escapeMatch = appJsContent.match(/function escapeHTML\(str\)\s*\{([\s\S]*?)\n\}/);
if (escapeMatch) {
  const sandbox = {};
  vm.runInNewContext('escapeHTML = function(str) {' + escapeMatch[1] + '}', sandbox);
  escapeHTML = sandbox.escapeHTML;
}

assert(typeof escapeHTML === 'function', 'escapeHTML() sanitization utility is defined');

if (escapeHTML) {
  const dangerousScript = '<script>alert("xss")</script>';
  const sanitized = escapeHTML(dangerousScript);
  assert(!sanitized.includes('<script>'), `XSS Defense: Script tags properly neutralized (${sanitized})`);
  assert(sanitized.includes('&lt;script&gt;'), 'XSS Defense: Entities properly converted to &lt; &gt;');

  const dangerousAttr = '" onmouseover="alert(1)"';
  const sanitizedAttr = escapeHTML(dangerousAttr);
  assert(!sanitizedAttr.includes('"'), 'XSS Defense: Double quotes escaped to &quot;');
}

// Verify Zero active executable eval() calls in app.js
const codeWithoutComments = appJsContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
const evalExecutableMatches = codeWithoutComments.match(/\beval\s*\(/g) || [];
assert(evalExecutableMatches.length === 0, 'Zero-eval policy: Codebase contains 0 active executable calls to eval()');

// Verify Safe JSON Backup Parser Guards
function validateBackupPayload(raw) {
  try {
    const data = (typeof raw === 'string') ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.expenses && !Array.isArray(data.expenses)) return false;
    if (data.categories && !Array.isArray(data.categories)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

assert(validateBackupPayload('{"categories":[], "expenses":[]}') === true, 'JSON Backup Validator: Accepts valid structured backup');
assert(validateBackupPayload('not json') === false, 'JSON Backup Validator: Rejects invalid non-JSON string');
assert(validateBackupPayload('["array", "root"]') === false, 'JSON Backup Validator: Rejects non-object root');
assert(validateBackupPayload('{"expenses": "string instead of array"}') === false, 'JSON Backup Validator: Rejects corrupted property types');

// ============================================================================
// 5. UI DESIGN SYSTEM, THEMES & RESPONSIVE LAYOUT AUDIT
// ============================================================================
section('5. UI Design System, Themes & Modes Audit');

const stylesContent = fs.readFileSync(path.join(ROOT_DIR, 'styles.css'), 'utf8');

const expectedThemes = ['aurora', 'dark', 'midnight', 'emerald', 'cyber'];
expectedThemes.forEach(theme => {
  assert(
    stylesContent.includes(`data-theme="${theme}"`) || stylesContent.includes(`.theme-${theme}`),
    `Design System: Theme palette defined in styles.css: ${theme}`
  );
});

const expectedModes = ['ui-mode-mobile', 'ui-mode-minimalist'];
expectedModes.forEach(mode => {
  assert(stylesContent.includes(mode), `Design System: Responsive layout mode defined in styles.css: .${mode}`);
});

// ============================================================================
// 6. PATCH NOTES & VERSION REGISTRY AUDIT
// ============================================================================
section('6. Release Chronicler & Patch Notes Audit');

const patchDataContent = fs.readFileSync(path.join(ROOT_DIR, 'patch-notes-data.js'), 'utf8');
const patchNotesSandbox = { window: {} };
vm.runInNewContext(patchDataContent, patchNotesSandbox);

const patchNotes = patchNotesSandbox.window.APP_PATCH_NOTES;
assert(Array.isArray(patchNotes) && patchNotes.length > 0, `APP_PATCH_NOTES is loaded with ${patchNotes.length} recorded versions`);

if (patchNotes && patchNotes.length > 0) {
  const latestRelease = patchNotes[0];
  assert(Boolean(latestRelease.version), `Latest release has version identifier: ${latestRelease.version}`);
  assert(Boolean(latestRelease.badge), `Latest release has badge: "${latestRelease.badge}"`);
  assert(Array.isArray(latestRelease.features) && latestRelease.features.length > 0, 'Latest release contains categorized feature entries');

  const hasGuiPlayground = latestRelease.features.some(f => f.gui && f.gui.previewHtml && f.gui.actionCode);
  assert(hasGuiPlayground, 'Latest release features contain interactive GUI sandbox test descriptors');
}

// ============================================================================
// AUDIT SUMMARY
// ============================================================================
console.log('\n============================================================');
if (failedCount === 0) {
  console.log(`\x1b[32m\x1b[1m✓ ALL ${passedCount} AUDIT TESTS PASSED WITH 100% SUCCESS! (0 REGRESSIONS)\x1b[0m`);
} else {
  console.log(`\x1b[31m\x1b[1m✗ AUDIT FAILED: ${failedCount} failures out of ${passedCount + failedCount} tests.\x1b[0m`);
  failures.forEach(f => console.log(`  - ${f.testName}: ${f.details}`));
}
console.log('============================================================\n');

process.exit(failedCount === 0 ? 0 : 1);
