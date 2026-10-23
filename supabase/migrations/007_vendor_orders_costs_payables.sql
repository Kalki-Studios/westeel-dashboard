-- Westeel Buildings: Migration 007 - Vendor Orders, Project Costs, Payables
-- Enums: order_kind, fulfilment_status, bill_type
-- Tables: cost_categories, budget_lines, vendor_orders, bills, bill_payments
-- Seed: 11 default cost categories (A13)
-- Constraints: fk_documents_bill, fk_documents_vendor_order
-- Triggers: audit triggers on all 5 tables
-- Row Level Security (RLS) policies per Section 5

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_kind') THEN
    CREATE TYPE order_kind AS ENUM (
      'material',
      'fabrication',
      'subcontract',
      'service'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfilment_status') THEN
    CREATE TYPE fulfilment_status AS ENUM (
      'ordered',
      'in_progress',
      'partially_fulfilled',
      'fulfilled',
      'issue',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_type') THEN
    CREATE TYPE bill_type AS ENUM (
      'supplier_bill',
      'subcontractor_bill',
      'direct_expense'
    );
  END IF;
END $$;

-- 2. Create cost_categories Table (Manageable in Settings by Director)
CREATE TABLE IF NOT EXISTS public.cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial 11 cost categories from Assumption A13
INSERT INTO public.cost_categories (name, is_active) VALUES
  ('Steel and raw material', true),
  ('Sheeting and cladding', true),
  ('Outsourced fabrication', true),
  ('Bolts and accessories', true),
  ('Transport and logistics', true),
  ('Erection labour and subcontract', true),
  ('Crane and equipment', true),
  ('Civil and foundation', true),
  ('Site expenses', true),
  ('Design and engineering', true),
  ('Other', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Create budget_lines Table (ex-GST, unique per project & category)
CREATE TABLE IF NOT EXISTS public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.cost_categories(id),
  amount_excl_gst NUMERIC(14,2) NOT NULL CHECK (amount_excl_gst >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_lines_project_category UNIQUE (project_id, category_id)
);

-- 4. Create vendor_orders Table (ex-GST + gst_amount, expected_delivery_date, fulfilment_status)
CREATE TABLE IF NOT EXISTS public.vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.cost_categories(id),
  kind order_kind NOT NULL,
  vendor_name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_excl_gst NUMERIC(14,2) NOT NULL CHECK (amount_excl_gst >= 0),
  gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE NOT NULL,
  fulfilment_status fulfilment_status NOT NULL DEFAULT 'ordered',
  delivery_note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create bills Table (may link to vendor_order_id, soft cancellation via is_cancelled)
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.cost_categories(id),
  vendor_order_id UUID REFERENCES public.vendor_orders(id) ON DELETE SET NULL,
  bill_type bill_type NOT NULL,
  vendor_name TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_excl_gst NUMERIC(14,2) NOT NULL CHECK (amount_excl_gst >= 0),
  gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create bill_payments Table (cash out including GST, explicit TDS deduction per A12)
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount_paid NUMERIC(14,2) NOT NULL CHECK (amount_paid > 0),
  tds_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
  mode payment_mode NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Add foreign key constraints from documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_documents_bill' AND table_name = 'documents'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT fk_documents_bill FOREIGN KEY (bill_id)
      REFERENCES public.bills(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_documents_vendor_order' AND table_name = 'documents'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT fk_documents_vendor_order FOREIGN KEY (vendor_order_id)
      REFERENCES public.vendor_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Add Indexes on foreign keys and filter columns
CREATE INDEX IF NOT EXISTS idx_budget_lines_project ON public.budget_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_category ON public.budget_lines(category_id);

CREATE INDEX IF NOT EXISTS idx_vendor_orders_project ON public.vendor_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_category ON public.vendor_orders(category_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_status ON public.vendor_orders(fulfilment_status);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_delivery ON public.vendor_orders(expected_delivery_date);

CREATE INDEX IF NOT EXISTS idx_bills_project ON public.bills(project_id);
CREATE INDEX IF NOT EXISTS idx_bills_category ON public.bills(category_id);
CREATE INDEX IF NOT EXISTS idx_bills_order ON public.bills(vendor_order_id);
CREATE INDEX IF NOT EXISTS idx_bills_cancelled ON public.bills(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills(due_date);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON public.bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON public.bill_payments(payment_date);

-- 9. Attach Audit Triggers
DROP TRIGGER IF EXISTS audit_cost_categories_trigger ON public.cost_categories;
CREATE TRIGGER audit_cost_categories_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.cost_categories
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_budget_lines_trigger ON public.budget_lines;
CREATE TRIGGER audit_budget_lines_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.budget_lines
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_vendor_orders_trigger ON public.vendor_orders;
CREATE TRIGGER audit_vendor_orders_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_bills_trigger ON public.bills;
CREATE TRIGGER audit_bills_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_bill_payments_trigger ON public.bill_payments;
CREATE TRIGGER audit_bill_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.bill_payments
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies per Section 5

-- 11.1 cost_categories Policies
-- Director has full control; Accounts, Purchase, and Project Manager can read
DROP POLICY IF EXISTS "Director manage cost_categories" ON public.cost_categories;
CREATE POLICY "Director manage cost_categories" ON public.cost_categories
FOR ALL TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Staff view active cost_categories" ON public.cost_categories;
CREATE POLICY "Staff view active cost_categories" ON public.cost_categories
FOR SELECT TO authenticated
USING (
  public.has_role('accounts')
  OR public.has_role('purchase')
  OR public.has_role('project_manager')
);

-- 11.2 budget_lines Policies
-- Director has full control; Accounts has read-only access; others none
DROP POLICY IF EXISTS "Director manage budget_lines" ON public.budget_lines;
CREATE POLICY "Director manage budget_lines" ON public.budget_lines
FOR ALL TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Accounts view budget_lines" ON public.budget_lines;
CREATE POLICY "Accounts view budget_lines" ON public.budget_lines
FOR SELECT TO authenticated
USING (public.has_role('accounts'));

-- 11.3 vendor_orders Policies
-- Director has full control
DROP POLICY IF EXISTS "Director manage vendor_orders" ON public.vendor_orders;
CREATE POLICY "Director manage vendor_orders" ON public.vendor_orders
FOR ALL TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

-- Purchase has full create/update/read on all vendor orders
DROP POLICY IF EXISTS "Purchase manage vendor_orders" ON public.vendor_orders;
CREATE POLICY "Purchase manage vendor_orders" ON public.vendor_orders
FOR ALL TO authenticated
USING (public.has_role('purchase'))
WITH CHECK (public.has_role('purchase'));

-- Accounts has read-only access to all vendor orders
DROP POLICY IF EXISTS "Accounts view vendor_orders" ON public.vendor_orders;
CREATE POLICY "Accounts view vendor_orders" ON public.vendor_orders
FOR SELECT TO authenticated
USING (public.has_role('accounts'));

-- Project Manager has read-only access on assigned projects
DROP POLICY IF EXISTS "PM view assigned vendor_orders" ON public.vendor_orders;
CREATE POLICY "PM view assigned vendor_orders" ON public.vendor_orders
FOR SELECT TO authenticated
USING (
  public.has_role('project_manager')
  AND public.is_project_member(project_id)
);

-- 11.4 bills Policies
-- Director has full control
DROP POLICY IF EXISTS "Director manage bills" ON public.bills;
CREATE POLICY "Director manage bills" ON public.bills
FOR ALL TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

-- Accounts has full read and write access on bills
DROP POLICY IF EXISTS "Accounts manage bills" ON public.bills;
CREATE POLICY "Accounts manage bills" ON public.bills
FOR ALL TO authenticated
USING (public.has_role('accounts'))
WITH CHECK (public.has_role('accounts'));

-- 11.5 bill_payments Policies
-- Director has full control
DROP POLICY IF EXISTS "Director manage bill_payments" ON public.bill_payments;
CREATE POLICY "Director manage bill_payments" ON public.bill_payments
FOR ALL TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

-- Accounts has full read and write access on bill payments
DROP POLICY IF EXISTS "Accounts manage bill_payments" ON public.bill_payments;
CREATE POLICY "Accounts manage bill_payments" ON public.bill_payments
FOR ALL TO authenticated
USING (public.has_role('accounts'))
WITH CHECK (public.has_role('accounts'));
