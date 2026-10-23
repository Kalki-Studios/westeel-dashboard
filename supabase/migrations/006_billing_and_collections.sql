-- Westeel Buildings: Migration 006 - Customer Billing and Collections
-- Enums: variation_status, payment_mode
-- Tables: project_commercials, variation_orders, payment_milestones, invoices, receipts
-- Constraints: fk_documents_invoice
-- Triggers: audit triggers on all 5 tables
-- Row Level Security (RLS) policies per Section 5

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'variation_status') THEN
    CREATE TYPE variation_status AS ENUM (
      'proposed',
      'approved',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode') THEN
    CREATE TYPE payment_mode AS ENUM (
      'bank_transfer',
      'cheque',
      'cash',
      'upi',
      'other'
    );
  END IF;
END $$;

-- 2. Create project_commercials Table (Contract value lives here, separate from projects)
CREATE TABLE IF NOT EXISTS public.project_commercials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_value_excl_gst NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (contract_value_excl_gst >= 0),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create variation_orders Table (amount may be negative for deductions)
CREATE TABLE IF NOT EXISTS public.variation_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount_excl_gst NUMERIC(14,2) NOT NULL,
  status variation_status NOT NULL DEFAULT 'proposed',
  approved_by UUID REFERENCES public.profiles(id),
  approved_on DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create payment_milestones Table (Billing schedule)
CREATE TABLE IF NOT EXISTS public.payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_excl_gst NUMERIC(14,2) NOT NULL CHECK (amount_excl_gst >= 0),
  expected_date DATE NOT NULL,
  position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  payment_milestone_id UUID REFERENCES public.payment_milestones(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_excl_gst NUMERIC(14,2) NOT NULL CHECK (amount_excl_gst >= 0),
  gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create receipts Table (invoice_id NULL = advance not yet allocated per Rule F3)
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  receipt_date DATE NOT NULL,
  amount_received NUMERIC(14,2) NOT NULL CHECK (amount_received >= 0),
  tds_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
  mode payment_mode NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6b. Indexes on Foreign Keys and Filter Columns
CREATE INDEX IF NOT EXISTS idx_variation_orders_project_id ON public.variation_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_variation_orders_status ON public.variation_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_project_id ON public.payment_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_expected_date ON public.payment_milestones(expected_date);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_milestone_id ON public.invoices(payment_milestone_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_receipts_project_id ON public.receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON public.receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_date ON public.receipts(receipt_date);

-- 7. Add foreign key from documents to invoices if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_invoice'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT fk_documents_invoice
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Enable Audit Triggers on all 5 tables
DROP TRIGGER IF EXISTS project_commercials_audit_trigger ON public.project_commercials;
CREATE TRIGGER project_commercials_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.project_commercials
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS variation_orders_audit_trigger ON public.variation_orders;
CREATE TRIGGER variation_orders_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.variation_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS payment_milestones_audit_trigger ON public.payment_milestones;
CREATE TRIGGER payment_milestones_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_milestones
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS invoices_audit_trigger ON public.invoices;
CREATE TRIGGER invoices_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS receipts_audit_trigger ON public.receipts;
CREATE TRIGGER receipts_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 9. Enable Row Level Security (RLS) on all 5 tables
ALTER TABLE public.project_commercials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies: project_commercials
-- Director: Full access (RW)
DROP POLICY IF EXISTS "project_commercials_director_all" ON public.project_commercials;
CREATE POLICY "project_commercials_director_all"
  ON public.project_commercials
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Accounts: Read only (R) - CANNOT insert, update, or delete contract value!
DROP POLICY IF EXISTS "project_commercials_accounts_select" ON public.project_commercials;
CREATE POLICY "project_commercials_accounts_select"
  ON public.project_commercials
  FOR SELECT
  TO authenticated
  USING (public.has_role('accounts'));

-- 11. RLS Policies: variation_orders
-- Director: Full access (RW) - can propose, approve, reject
DROP POLICY IF EXISTS "variation_orders_director_all" ON public.variation_orders;
CREATE POLICY "variation_orders_director_all"
  ON public.variation_orders
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Accounts: Read only (R)
DROP POLICY IF EXISTS "variation_orders_accounts_select" ON public.variation_orders;
CREATE POLICY "variation_orders_accounts_select"
  ON public.variation_orders
  FOR SELECT
  TO authenticated
  USING (public.has_role('accounts'));

-- 12. RLS Policies: payment_milestones
-- Director: Full access (RW)
DROP POLICY IF EXISTS "payment_milestones_director_all" ON public.payment_milestones;
CREATE POLICY "payment_milestones_director_all"
  ON public.payment_milestones
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Accounts: Full access (RW)
DROP POLICY IF EXISTS "payment_milestones_accounts_all" ON public.payment_milestones;
CREATE POLICY "payment_milestones_accounts_all"
  ON public.payment_milestones
  FOR ALL
  TO authenticated
  USING (public.has_role('accounts'))
  WITH CHECK (public.has_role('accounts'));

-- 13. RLS Policies: invoices
-- Director: Full access (RW)
DROP POLICY IF EXISTS "invoices_director_all" ON public.invoices;
CREATE POLICY "invoices_director_all"
  ON public.invoices
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Accounts: Full access (RW)
DROP POLICY IF EXISTS "invoices_accounts_all" ON public.invoices;
CREATE POLICY "invoices_accounts_all"
  ON public.invoices
  FOR ALL
  TO authenticated
  USING (public.has_role('accounts'))
  WITH CHECK (public.has_role('accounts'));

-- 14. RLS Policies: receipts
-- Director: Full access (RW)
DROP POLICY IF EXISTS "receipts_director_all" ON public.receipts;
CREATE POLICY "receipts_director_all"
  ON public.receipts
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Accounts: Full access (RW)
DROP POLICY IF EXISTS "receipts_accounts_all" ON public.receipts;
CREATE POLICY "receipts_accounts_all"
  ON public.receipts
  FOR ALL
  TO authenticated
  USING (public.has_role('accounts'))
  WITH CHECK (public.has_role('accounts'));
