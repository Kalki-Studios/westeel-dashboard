-- ==============================================================================
-- Migration 008: Bank Balances, Company Cash Items, and Cash Flow (Task T12)
-- Priority 2: Money (Rules F11, F12, F13 and Section 5 Permissions)
-- ==============================================================================

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    CREATE TYPE public.cash_direction AS ENUM (
        'inflow',
        'outflow'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.cash_item_status AS ENUM (
        'planned',
        'done',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Bank Balances Table (Rule F11)
-- Stores dated entries per account_label (e.g. "HDFC Current", "SBI Cash Credit", "Petty Cash")
CREATE TABLE IF NOT EXISTS public.bank_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_label TEXT NOT NULL,
    balance NUMERIC(14,2) NOT NULL,
    as_of_date DATE NOT NULL,
    note TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Company Cash Items Table (Rule F12)
-- Non-project cash movements: payroll total, rent, EMI, GST payments, loan drawdowns, capital injections
-- Note: Salary must be entered as ONE total line, never per employee.
CREATE TABLE IF NOT EXISTS public.company_cash_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction public.cash_direction NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    expected_date DATE NOT NULL,
    status public.cash_item_status NOT NULL DEFAULT 'planned',
    recurring_group_id UUID,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. Audit Triggers (Rule R10)
DROP TRIGGER IF EXISTS trg_audit_bank_balances ON public.bank_balances;
CREATE TRIGGER trg_audit_bank_balances
AFTER INSERT OR UPDATE OR DELETE ON public.bank_balances
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_company_cash_items ON public.company_cash_items;
CREATE TRIGGER trg_audit_company_cash_items
AFTER INSERT OR UPDATE OR DELETE ON public.company_cash_items
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bank_balances_account ON public.bank_balances(account_label, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_balances_as_of ON public.bank_balances(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_items_date ON public.company_cash_items(expected_date);
CREATE INDEX IF NOT EXISTS idx_cash_items_status ON public.company_cash_items(status);
CREATE INDEX IF NOT EXISTS idx_cash_items_direction ON public.company_cash_items(direction);
CREATE INDEX IF NOT EXISTS idx_cash_items_recurring ON public.company_cash_items(recurring_group_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.bank_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_cash_items ENABLE ROW LEVEL SECURITY;

-- 7. Section 5 Access Control Policies

-- -----------------------------------------------------------------------------
-- bank_balances: Director and Accounts have full RW; others have no access
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "bank_balances_select" ON public.bank_balances;
CREATE POLICY "bank_balances_select" ON public.bank_balances
FOR SELECT TO authenticated
USING (public.is_director() OR public.has_role('accounts'));

DROP POLICY IF EXISTS "bank_balances_insert" ON public.bank_balances;
CREATE POLICY "bank_balances_insert" ON public.bank_balances
FOR INSERT TO authenticated
WITH CHECK (public.is_director() OR public.has_role('accounts'));

DROP POLICY IF EXISTS "bank_balances_update" ON public.bank_balances;
CREATE POLICY "bank_balances_update" ON public.bank_balances
FOR UPDATE TO authenticated
USING (public.is_director() OR public.has_role('accounts'))
WITH CHECK (public.is_director() OR public.has_role('accounts'));

DROP POLICY IF EXISTS "bank_balances_delete" ON public.bank_balances;
CREATE POLICY "bank_balances_delete" ON public.bank_balances
FOR DELETE TO authenticated
USING (public.is_director());

-- -----------------------------------------------------------------------------
-- company_cash_items: Director has full RW; Accounts has read-only; others have no access
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "cash_items_select" ON public.company_cash_items;
CREATE POLICY "cash_items_select" ON public.company_cash_items
FOR SELECT TO authenticated
USING (public.is_director() OR public.has_role('accounts'));

DROP POLICY IF EXISTS "cash_items_insert" ON public.company_cash_items;
CREATE POLICY "cash_items_insert" ON public.company_cash_items
FOR INSERT TO authenticated
WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "cash_items_update" ON public.company_cash_items;
CREATE POLICY "cash_items_update" ON public.company_cash_items
FOR UPDATE TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "cash_items_delete" ON public.company_cash_items;
CREATE POLICY "cash_items_delete" ON public.company_cash_items
FOR DELETE TO authenticated
USING (public.is_director());
