/**
 * [FEAT-SUPABASE-DB] NirvTrack Supabase PostgreSQL Database & Real-Time Sync Adapter
 * Version: 2.0.20261023.105
 * 
 * Features:
 * 1. Local-First Background Synchronization: 0ms UI latency, background debounced upsert.
 * 2. Automated First-Login Migration: Transfers local storage data to PostgreSQL on first sign-in.
 * 3. Bidirectional Hydration: Loads cloud data into appState and local storage cache.
 * 4. Transaction Ledger Batching: High-performance chunked inserts for expenses.
 * 5. Offline Resiliency: Zero blocking or errors when offline or unauthenticated.
 */

let sbSyncTimer = null;
let isSavingToSupabase = false;
let hasSupabaseHydrated = false;
window.hasSupabaseHydrated = false;

// Official Default Supabase Project Credentials
const DEFAULT_SUPABASE_URL = 'https://jftyzfdmlkagyhxbrqab.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHl6ZmRtbGthZ3loeGJycWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODk5NDEsImV4cCI6MjEwODI2NTk0MX0.ly8iWjUnECn60NAUZfzXr5arb7qYD69EXXV5B4NvN1U';

document.addEventListener('DOMContentLoaded', () => {
  initSupabaseDb();
});

/**
 * Initializes the Supabase DB module
 */
function initSupabaseDb() {
  const url = localStorage.getItem('nirvtrack_supabase_url') || window.SUPABASE_CONFIG?.url || DEFAULT_SUPABASE_URL;
  const anonKey = localStorage.getItem('nirvtrack_supabase_anon_key') || window.SUPABASE_CONFIG?.anonKey || DEFAULT_SUPABASE_ANON_KEY;

  if (!url || !anonKey || typeof supabase === 'undefined') {
    updateSupabaseStatusUI('offline', '⚪ Offline Mode (Local-First)');
    return;
  }

  if (!window.sbClient && supabase.createClient) {
    try {
      window.sbClient = supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storage: window.localStorage
        }
      });
    } catch (e) {
      console.warn('Notice initializing Supabase in DB adapter:', e);
    }
  }

  if (window.sbClient) {
    updateSupabaseStatusUI('ready', '🟢 Supabase Connected');
  }
}
window.initSupabaseDb = initSupabaseDb;

/**
 * Debounced auto-save hook called from app.js saveData()
 */
function triggerSupabaseAutoSave() {
  const client = window.sbClient;
  const user = window.currentAuthenticatedUser;
  const uid = window.activeAuthUid || (user && user.id);

  // If not logged in with Supabase, gracefully exit
  if (!client || !user || !uid) return;

  // Clear previous pending debounced sync
  if (sbSyncTimer) {
    clearTimeout(sbSyncTimer);
  }

  // Debounce by 1500ms to batch rapid input modifications
  sbSyncTimer = setTimeout(async () => {
    try {
      await syncCurrentWorkspaceToSupabase();
    } catch (err) {
      console.warn('Debounced Supabase sync notice:', err);
    }
  }, 1500);
}
window.triggerSupabaseAutoSave = triggerSupabaseAutoSave;

/**
 * Synchronizes the active workspace container to Supabase PostgreSQL
 */
async function syncCurrentWorkspaceToSupabase() {
  const client = window.sbClient;
  const user = window.currentAuthenticatedUser;
  const uid = window.activeAuthUid || (user && user.id);

  if (!client || !user || !uid || isSavingToSupabase) return;

  const activeWsId = (typeof workspaceRegistry !== 'undefined' && workspaceRegistry.activeWorkspaceId)
    ? workspaceRegistry.activeWorkspaceId
    : 'ws_default';

  isSavingToSupabase = true;
  updateSupabaseStatusUI('syncing', '🟡 Cloud Syncing...');

  try {
    const nowIso = new Date().toISOString();

    // 1. Upsert Workspace Record
    const wsName = (typeof workspaceRegistry !== 'undefined' && workspaceRegistry.workspaces)
      ? (workspaceRegistry.workspaces.find(w => w.id === activeWsId)?.name || 'Default Workspace')
      : 'Default Workspace';

    await client.from('workspaces').upsert({
      id: activeWsId,
      user_id: uid,
      name: wsName,
      updated_at: nowIso
    }, { onConflict: 'user_id,id' });

    // 2. Upsert Categories
    if (Array.isArray(appState.categories) && appState.categories.length > 0) {
      const catRows = appState.categories.map((cat, idx) => ({
        id: cat.id || `cat_${idx}`,
        workspace_id: activeWsId,
        user_id: uid,
        name: cat.name || 'Category',
        group_name: ['Needs', 'Wants', 'Savings'].includes(cat.group) ? cat.group : 'Needs',
        icon: cat.icon || '🏷️',
        color: cat.color || '#06b6d4',
        allocated_amount: Number(cat.allocated || 0),
        sort_order: idx,
        updated_at: nowIso
      }));

      await client.from('categories').upsert(catRows, { onConflict: 'user_id,id' });
    }

    // 3. Upsert Monthly Incomes
    if (appState.incomes && typeof appState.incomes === 'object') {
      const incomeRows = Object.keys(appState.incomes).map(monthKey => {
        const inc = appState.incomes[monthKey] || {};
        return {
          id: `${activeWsId}_inc_${monthKey}`,
          workspace_id: activeWsId,
          user_id: uid,
          month: monthKey,
          paycheck1: Number(inc.paycheck1 || 0),
          paycheck2: Number(inc.paycheck2 || 0),
          other_income: Number(inc.other || 0),
          updated_at: nowIso
        };
      });

      if (incomeRows.length > 0) {
        await client.from('incomes').upsert(incomeRows, { onConflict: 'user_id,id' });
      }
    }

    // 4. Upsert Monthly Budgets
    if (appState.budgets && typeof appState.budgets === 'object') {
      const budgetRows = [];
      Object.keys(appState.budgets).forEach(monthKey => {
        const monthMap = appState.budgets[monthKey] || {};
        Object.keys(monthMap).forEach(catId => {
          budgetRows.push({
            id: `${activeWsId}_bgt_${catId}_${monthKey}`,
            workspace_id: activeWsId,
            user_id: uid,
            category_id: catId,
            month: monthKey,
            amount: Number(monthMap[catId] || 0),
            updated_at: nowIso
          });
        });
      });

      if (budgetRows.length > 0) {
        await client.from('budgets').upsert(budgetRows, { onConflict: 'user_id,id' });
      }
    }

    // 5. Upsert Expenses Ledger (batching in chunks of 150)
    if (Array.isArray(appState.expenses) && appState.expenses.length > 0) {
      const expenseRows = appState.expenses.map(exp => ({
        id: String(exp.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`),
        workspace_id: activeWsId,
        user_id: uid,
        category_id: exp.categoryId || null,
        amount: Number(exp.amount || 0),
        date: exp.date || nowIso.split('T')[0],
        month: (exp.date ? exp.date.substring(0, 7) : nowIso.substring(0, 7)),
        description: exp.description || exp.notes || '',
        wallet: exp.wallet || 'Cash',
        is_recurring: Boolean(exp.isRecurring),
        tags: Array.isArray(exp.tags) ? exp.tags : [],
        updated_at: nowIso
      }));

      const CHUNK_SIZE = 150;
      for (let i = 0; i < expenseRows.length; i += CHUNK_SIZE) {
        const chunk = expenseRows.slice(i, i + CHUNK_SIZE);
        await client.from('expenses').upsert(chunk, { onConflict: 'user_id,id' });
      }
    }

    // 6. Upsert Recurring Bills
    if (Array.isArray(appState.recurringBills) && appState.recurringBills.length > 0) {
      const billRows = appState.recurringBills.map((b, idx) => ({
        id: String(b.id || `bill_${idx}`),
        workspace_id: activeWsId,
        user_id: uid,
        category_id: b.categoryId || null,
        name: b.name || 'Unnamed Bill',
        amount: Number(b.amount || 0),
        due_day: Number(b.dueDay || 1),
        auto_deduct: Boolean(b.autoDeduct),
        is_paid: Boolean(b.isPaid),
        last_paid_month: b.lastPaidMonth || null,
        updated_at: nowIso
      }));

      await client.from('recurring_bills').upsert(billRows, { onConflict: 'user_id,id' });
    }

    // 7. Upsert Planned Expenses
    if (Array.isArray(appState.plannedExpenses) && appState.plannedExpenses.length > 0) {
      const planRows = appState.plannedExpenses.map((p, idx) => ({
        id: String(p.id || `plan_${idx}`),
        workspace_id: activeWsId,
        user_id: uid,
        category_id: p.categoryId || null,
        name: p.name || p.description || 'Planned Item',
        amount: Number(p.amount || 0),
        planned_date: p.date || p.plannedDate || nowIso.split('T')[0],
        is_approved: Boolean(p.isApproved),
        updated_at: nowIso
      }));

      await client.from('planned_expenses').upsert(planRows, { onConflict: 'user_id,id' });
    }

    updateSupabaseStatusUI('synced', '🟢 Cloud Synced');
  } catch (err) {
    console.error('Supabase Auto-Save Error:', err);
    updateSupabaseStatusUI('error', '⚠️ Cloud Sync Friction');
  } finally {
    isSavingToSupabase = false;
  }
}
window.syncCurrentWorkspaceToSupabase = syncCurrentWorkspaceToSupabase;

/**
 * Deletes an expense from Supabase PostgreSQL
 */
async function deleteExpenseFromSupabase(expenseId) {
  const client = window.sbClient;
  const uid = window.activeAuthUid;
  if (!client || !uid || !expenseId) return;

  try {
    await client
      .from('expenses')
      .delete()
      .eq('id', String(expenseId))
      .eq('user_id', uid);
  } catch (err) {
    console.warn('Notice deleting expense from Supabase:', err);
  }
}
window.deleteExpenseFromSupabase = deleteExpenseFromSupabase;

/**
 * Handles initial login sync vs hydration:
 * - If Supabase has data, hydrate it into appState.
 * - If Supabase is empty, migrate current local storage data into Supabase!
 */
async function syncOrHydrateOnLogin(user) {
  const client = window.sbClient;
  const uid = user?.id || window.activeAuthUid;
  if (!client || !uid) return;

  const activeWsId = (typeof workspaceRegistry !== 'undefined' && workspaceRegistry.activeWorkspaceId)
    ? workspaceRegistry.activeWorkspaceId
    : 'ws_default';

  try {
    updateSupabaseStatusUI('syncing', '🟡 Checking cloud data...');

    // Check if cloud records exist for this user in active workspace
    const { data: cloudExpenses, error: expErr } = await client
      .from('expenses')
      .select('id')
      .eq('user_id', uid)
      .eq('workspace_id', activeWsId)
      .limit(1);

    const { data: cloudCategories, error: catErr } = await client
      .from('categories')
      .select('id')
      .eq('user_id', uid)
      .eq('workspace_id', activeWsId)
      .limit(1);

    const hasCloudData = (cloudExpenses && cloudExpenses.length > 0) || (cloudCategories && cloudCategories.length > 0);

    if (hasCloudData) {
      // Hydrate from Supabase
      console.log('📥 Existing cloud records found. Hydrating workstation from Supabase...');
      await hydrateAppStateFromSupabase(activeWsId);
      if (typeof showToast === 'function') {
        showToast('🟢 Synchronized records loaded from Supabase Cloud', 'success');
      }
    } else {
      // Empty cloud account: Auto-migrate local data to Supabase
      console.log('🚀 First sign-in detected with empty cloud account. Migrating local data to Supabase...');
      await syncCurrentWorkspaceToSupabase();
      hasSupabaseHydrated = true;
      window.hasSupabaseHydrated = true;
      if (typeof showToast === 'function') {
        showToast('🚀 Migrated your local data to Supabase PostgreSQL!', 'success');
      }
    }
  } catch (err) {
    console.error('Error during login sync/hydrate:', err);
    updateSupabaseStatusUI('error', '⚠️ Sync Notice');
  }
}
window.syncOrHydrateOnLogin = syncOrHydrateOnLogin;

/**
 * Hydrates appState from Supabase PostgreSQL tables
 */
async function hydrateAppStateFromSupabase(workspaceId) {
  const client = window.sbClient;
  const uid = window.activeAuthUid;
  if (!client || !uid) return false;

  try {
    updateSupabaseStatusUI('syncing', '🟡 Downloading from cloud...');

    // 1. Fetch categories
    const { data: categories } = await client
      .from('categories')
      .select('*')
      .eq('user_id', uid)
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true });

    if (categories && categories.length > 0) {
      appState.categories = categories.map(c => ({
        id: c.id,
        name: c.name,
        group: c.group_name,
        icon: c.icon || '🏷️',
        color: c.color || '#06b6d4',
        allocated: Number(c.allocated_amount || 0)
      }));
    }

    // 2. Fetch incomes
    const { data: incomes } = await client
      .from('incomes')
      .select('*')
      .eq('user_id', uid)
      .eq('workspace_id', workspaceId);

    if (incomes && incomes.length > 0) {
      appState.incomes = {};
      incomes.forEach(inc => {
        appState.incomes[inc.month] = {
          paycheck1: Number(inc.paycheck1 || 0),
          paycheck2: Number(inc.paycheck2 || 0),
          other: Number(inc.other_income || 0)
        };
      });
    }

    // 3. Fetch budgets
    const { data: budgets } = await client
      .from('budgets')
      .select('*')
      .eq('user_id', uid)
      .eq('workspace_id', workspaceId);

    if (budgets && budgets.length > 0) {
      appState.budgets = {};
      budgets.forEach(b => {
        if (!appState.budgets[b.month]) appState.budgets[b.month] = {};
        appState.budgets[b.month][b.category_id] = Number(b.amount || 0);
      });
    }

    // 4. Fetch expenses (latest 3,000)
    const { data: expenses } = await client
      .from('expenses')
      .select('*')
      .eq('user_id', uid)
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: false })
      .limit(3000);

    if (expenses && expenses.length > 0) {
      appState.expenses = expenses.map(e => ({
        id: e.id,
        amount: Number(e.amount || 0),
        date: e.date,
        description: e.description || '',
        categoryId: e.category_id,
        wallet: e.wallet || 'Cash',
        isRecurring: Boolean(e.is_recurring),
        tags: Array.isArray(e.tags) ? e.tags : []
      }));
    }

    // 5. Fetch recurring bills
    const { data: bills } = await client
      .from('recurring_bills')
      .select('*')
      .eq('user_id', uid)
      .eq('workspace_id', workspaceId);

    if (bills && bills.length > 0) {
      appState.recurringBills = bills.map(b => ({
        id: b.id,
        name: b.name,
        amount: Number(b.amount || 0),
        dueDay: Number(b.due_day || 1),
        categoryId: b.category_id,
        autoDeduct: Boolean(b.auto_deduct),
        isPaid: Boolean(b.is_paid),
        lastPaidMonth: b.last_paid_month
      }));
    }

    // 6. Fetch planned expenses
    const { data: planned } = await client
      .from('planned_expenses')
      .select('*')
      .eq('user_id', uid)
      .eq('workspace_id', workspaceId);

    if (planned && planned.length > 0) {
      appState.plannedExpenses = planned.map(p => ({
        id: p.id,
        name: p.name,
        amount: Number(p.amount || 0),
        date: p.planned_date,
        categoryId: p.category_id,
        isApproved: Boolean(p.is_approved)
      }));
    }

    hasSupabaseHydrated = true;
    window.hasSupabaseHydrated = true;

    // Persist snapshot to local storage cache
    if (typeof saveActiveWorkspaceContainer === 'function') {
      saveActiveWorkspaceContainer();
    }

    // Re-render views
    if (typeof populateCategorySelects === 'function') populateCategorySelects();
    if (typeof populateIncomeInputs === 'function') populateIncomeInputs();
    if (typeof renderBudgetGrid === 'function') renderBudgetGrid();
    if (typeof updateAllViews === 'function') updateAllViews();

    updateSupabaseStatusUI('synced', '🟢 Cloud Synced');
    return true;
  } catch (err) {
    console.error('Error hydrating from Supabase:', err);
    updateSupabaseStatusUI('error', '⚠️ Hydration Notice');
    return false;
  }
}
window.hydrateAppStateFromSupabase = hydrateAppStateFromSupabase;

/**
 * Updates UI badge for Supabase connection
 */
function updateSupabaseStatusUI(status, label) {
  const badge = document.getElementById('supabaseSyncStatus');
  const textEl = document.getElementById('supabaseSyncText');
  if (badge) {
    badge.className = `supabase-sync-badge ${status}`;
  }
  if (textEl && label) {
    textEl.textContent = label;
  }
}
window.updateSupabaseStatusUI = updateSupabaseStatusUI;
