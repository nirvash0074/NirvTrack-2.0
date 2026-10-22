-- ==============================================================================
-- NIRVTRACK ENTERPRISE DATABASE SCHEMA FOR SUPABASE (POSTGRESQL)
-- Version: 2.0.20261023.105
-- Platform: Supabase PostgreSQL 15+ with Native GoTrue Auth & Google OAuth 2.0
-- Security: Declarative Multi-Tenant Row-Level Security (RLS)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & IDENTITY RESOLUTION
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function to resolve the active user ID from Supabase Auth (or JWT claims fallback)
CREATE OR REPLACE FUNCTION public.current_app_user() 
RETURNS TEXT AS $$
BEGIN
  -- 1. Check native Supabase Auth UID
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid()::text;
  END IF;

  -- 2. Fallback to request JWT claims if invoking through custom gateway
  IF current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RETURN COALESCE(
      NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', ''),
      NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'user_id', '')
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 2. CORE USERS TABLE (User profile, Executive tier entitlements, preferences)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(128) PRIMARY KEY, -- Matches Supabase auth.users.id (UUID string)
  email VARCHAR(255),
  display_name VARCHAR(255),
  photo_url TEXT,
  provider VARCHAR(50) DEFAULT 'google',
  role VARCHAR(32) DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  tier VARCHAR(32) DEFAULT 'executive' CHECK (tier IN ('free', 'pro', 'executive')),
  currency VARCHAR(16) DEFAULT '$',
  theme VARCHAR(32) DEFAULT 'aurora',
  ui_mode VARCHAR(32) DEFAULT 'default',
  active_workspace_id VARCHAR(128) DEFAULT 'ws_default',
  gemini_api_key TEXT,
  gemini_model VARCHAR(64) DEFAULT 'auto',
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. WORKSPACES TABLE (Isolated budgets & ledgers per user container)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id VARCHAR(128) NOT NULL, -- e.g. ws_default, ws_business_...
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(32) DEFAULT '💼',
  mode VARCHAR(32) DEFAULT 'standard',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- ------------------------------------------------------------------------------
-- 4. CATEGORIES TABLE (50/30/20 Allocation: Needs, Wants, Savings)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id VARCHAR(128) NOT NULL, -- e.g. cat_housing, cat_food, cat_dining
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  group_name VARCHAR(32) NOT NULL CHECK (group_name IN ('Needs', 'Wants', 'Savings')),
  icon VARCHAR(32) DEFAULT '🏷️',
  color VARCHAR(32) DEFAULT '#06b6d4',
  allocated_amount NUMERIC(14, 2) DEFAULT 0.00,
  is_hidden BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 5. MONTHLY BUDGETS TABLE (Category limits per month)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budgets (
  id VARCHAR(128) NOT NULL, -- e.g. ws_default_cat_housing_2026-10
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id VARCHAR(128) NOT NULL,
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_user_workspace_category_month UNIQUE (user_id, workspace_id, category_id, month)
);

-- ------------------------------------------------------------------------------
-- 6. MONTHLY INCOMES TABLE (Paychecks & other earnings per month)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incomes (
  id VARCHAR(128) NOT NULL, -- e.g. ws_default_inc_2026-10
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  paycheck1 NUMERIC(14, 2) DEFAULT 0.00,
  paycheck2 NUMERIC(14, 2) DEFAULT 0.00,
  other_income NUMERIC(14, 2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_user_workspace_income_month UNIQUE (user_id, workspace_id, month)
);

-- ------------------------------------------------------------------------------
-- 7. EXPENSES LEDGER TABLE (High-performance normalized transaction stream)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id VARCHAR(128) NOT NULL, -- e.g. exp_1729600000000_123
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id VARCHAR(128),
  amount NUMERIC(14, 2) NOT NULL,
  date DATE NOT NULL,
  month VARCHAR(7) NOT NULL, -- Denormalized for ultra-fast partition/filter: YYYY-MM
  description TEXT NOT NULL DEFAULT '',
  wallet VARCHAR(64) DEFAULT 'Cash',
  is_recurring BOOLEAN DEFAULT FALSE,
  receipt_url TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 8. RECURRING BILLS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_bills (
  id VARCHAR(128) NOT NULL,
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  due_day INT CHECK (due_day >= 1 AND due_day <= 31),
  auto_deduct BOOLEAN DEFAULT FALSE,
  is_paid BOOLEAN DEFAULT FALSE,
  last_paid_month VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 9. SINKING FUNDS / SAVINGS GOALS TABLE (Target savings buckets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sinking_funds (
  id VARCHAR(128) NOT NULL,
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  target_amount NUMERIC(14, 2) NOT NULL,
  current_balance NUMERIC(14, 2) DEFAULT 0.00,
  target_date DATE,
  category_id VARCHAR(128),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 10. WALLETS & ACCOUNTS TABLE (Reconciliation & Net Worth Assets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  id VARCHAR(128) NOT NULL,
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) DEFAULT 'bank' CHECK (type IN ('bank', 'ewallet', 'cash', 'credit_card', 'investment')),
  starting_balance NUMERIC(14, 2) DEFAULT 0.00,
  current_balance NUMERIC(14, 2) DEFAULT 0.00,
  is_default BOOLEAN DEFAULT FALSE,
  last_reconciled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 11. PLANNED EXPENSES TABLE (Upcoming commitments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planned_expenses (
  id VARCHAR(128) NOT NULL,
  workspace_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  planned_date DATE NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workspace_id) REFERENCES public.workspaces(user_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------------
-- 12. AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id VARCHAR(128),
  event_type VARCHAR(64) NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. PERFORMANCE INDEXES (Sub-5ms query response)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON public.workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_ws_sort ON public.categories(user_id, workspace_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_budgets_user_ws_month ON public.budgets(user_id, workspace_id, month);
CREATE INDEX IF NOT EXISTS idx_incomes_user_ws_month ON public.incomes(user_id, workspace_id, month);
CREATE INDEX IF NOT EXISTS idx_expenses_user_ws_month_date ON public.expenses(user_id, workspace_id, month, date DESC);
CREATE INDEX IF NOT EXISTS idx_recurring_user_ws ON public.recurring_bills(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_sinking_user_ws ON public.sinking_funds(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_ws ON public.wallets(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_planned_user_ws_date ON public.planned_expenses(user_id, workspace_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON public.audit_logs(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 14. ROW-LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Users can only ever read, write, or delete their own data
-- ------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinking_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current requester is an app admin
CREATE OR REPLACE FUNCTION public.is_app_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = current_app_user() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- RLS Policy Definitions
CREATE POLICY "Users access own profile" ON public.users FOR ALL
  USING (id = current_app_user() OR is_app_admin()) 
  WITH CHECK (id = current_app_user() OR is_app_admin());

CREATE POLICY "Workspaces isolation" ON public.workspaces FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Categories isolation" ON public.categories FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Budgets isolation" ON public.budgets FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Incomes isolation" ON public.incomes FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Expenses isolation" ON public.expenses FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Recurring bills isolation" ON public.recurring_bills FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Sinking funds isolation" ON public.sinking_funds FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Wallets isolation" ON public.wallets FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Planned expenses isolation" ON public.planned_expenses FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

CREATE POLICY "Audit logs isolation" ON public.audit_logs FOR ALL
  USING (user_id = current_app_user() OR is_app_admin()) 
  WITH CHECK (user_id = current_app_user() OR is_app_admin());

-- ------------------------------------------------------------------------------
-- 15. AUTOMATIC NEW USER INITIALIZATION TRIGGER
-- Fires when a user signs in via Google OAuth in Supabase Auth (GoTrue)
-- Provisions public.users profile with Executive Tier and seeds 'ws_default'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user profile
  INSERT INTO public.users (
    id,
    email,
    display_name,
    photo_url,
    provider,
    tier,
    last_login_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'google'),
    'executive',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    photo_url = COALESCE(EXCLUDED.photo_url, public.users.photo_url),
    last_login_at = NOW();

  -- Provision default workspace container for the user
  INSERT INTO public.workspaces (id, user_id, name, icon, mode)
  VALUES (
    'ws_default',
    NEW.id::text,
    'Default Workspace',
    '💼',
    'standard'
  )
  ON CONFLICT (user_id, id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 16. SERVER-SIDE ANALYTICS RPC (High-Speed Financial Math)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_workspace_monthly_summary(
  p_workspace_id VARCHAR,
  p_month VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_income NUMERIC(14, 2) := 0;
  v_budget NUMERIC(14, 2) := 0;
  v_spent NUMERIC(14, 2) := 0;
  v_needs_spent NUMERIC(14, 2) := 0;
  v_wants_spent NUMERIC(14, 2) := 0;
  v_savings_spent NUMERIC(14, 2) := 0;
  v_user_id TEXT := current_app_user();
BEGIN
  -- Verify workspace belongs to current user
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = p_workspace_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized or workspace not found';
  END IF;

  -- 1. Calculate Income
  SELECT COALESCE(paycheck1, 0) + COALESCE(paycheck2, 0) + COALESCE(other_income, 0)
  INTO v_income
  FROM public.incomes
  WHERE user_id = v_user_id AND workspace_id = p_workspace_id AND month = p_month;
  v_income := COALESCE(v_income, 0);

  -- 2. Calculate Budget Limit
  SELECT COALESCE(SUM(amount), 0)
  INTO v_budget
  FROM public.budgets
  WHERE user_id = v_user_id AND workspace_id = p_workspace_id AND month = p_month;

  -- 3. Calculate Total & Group Spending
  SELECT 
    COALESCE(SUM(e.amount), 0),
    COALESCE(SUM(CASE WHEN c.group_name = 'Needs' THEN e.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.group_name = 'Wants' THEN e.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.group_name = 'Savings' THEN e.amount ELSE 0 END), 0)
  INTO v_spent, v_needs_spent, v_wants_spent, v_savings_spent
  FROM public.expenses e
  LEFT JOIN public.categories c ON e.category_id = c.id AND c.user_id = v_user_id
  WHERE e.user_id = v_user_id AND e.workspace_id = p_workspace_id AND e.month = p_month;

  RETURN jsonb_build_object(
    'month', p_month,
    'total_income', v_income,
    'total_budget', v_budget,
    'total_spent', v_spent,
    'remaining_balance', (v_income - v_spent),
    'budget_variance', (v_budget - v_spent),
    'breakdown', jsonb_build_object(
      'needs_spent', v_needs_spent,
      'wants_spent', v_wants_spent,
      'savings_spent', v_savings_spent
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
