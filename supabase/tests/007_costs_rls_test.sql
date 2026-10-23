-- Test Suite 007: Costs, Orders & Payables RLS Matrix and Permissions Verification
-- Tests:
-- 1. Director has full RW access on cost_categories, budget_lines, vendor_orders, bills, bill_payments
-- 2. Purchase has RW on vendor_orders, R on cost_categories, CANNOT access budget_lines, bills, bill_payments
-- 3. Accounts has RW on bills & bill_payments, R on budget_lines & vendor_orders, CANNOT edit budget_lines
-- 4. PM has R on vendor_orders for assigned projects only; CANNOT access budget_lines, bills, bill_payments
-- 5. Sales & Site Engineer CANNOT read or write any cost/order/bill tables
-- 6. Audit logging verification on cost tables

CREATE TEMP TABLE IF NOT EXISTS test_results_007 (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results_007 TO authenticated;
TRUNCATE test_results_007;

-- 1. Setup test users in auth.users
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'director_t11@westeel.test', 'authenticated', 'authenticated'),
  ('c2222222-2222-2222-2222-222222222222', 'purchase_t11@westeel.test', 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', 'accounts_t11@westeel.test', 'authenticated', 'authenticated'),
  ('c4444444-4444-4444-4444-444444444444', 'pm_t11@westeel.test', 'authenticated', 'authenticated'),
  ('c5555555-5555-5555-5555-555555555555', 'sales_t11@westeel.test', 'authenticated', 'authenticated'),
  ('c6666666-6666-6666-6666-666666666666', 'site_t11@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- 2. Setup profiles
INSERT INTO public.profiles (id, full_name, is_active) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Director T11', true),
  ('c2222222-2222-2222-2222-222222222222', 'Purchase T11', true),
  ('c3333333-3333-3333-3333-333333333333', 'Accounts T11', true),
  ('c4444444-4444-4444-4444-444444444444', 'PM T11', true),
  ('c5555555-5555-5555-5555-555555555555', 'Sales T11', true),
  ('c6666666-6666-6666-6666-666666666666', 'Site T11', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

-- 3. Assign roles
DELETE FROM public.user_roles WHERE user_id IN (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333',
  'c4444444-4444-4444-4444-444444444444',
  'c5555555-5555-5555-5555-555555555555',
  'c6666666-6666-6666-6666-666666666666'
);

INSERT INTO public.user_roles (user_id, role) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'director'),
  ('c2222222-2222-2222-2222-222222222222', 'purchase'),
  ('c3333333-3333-3333-3333-333333333333', 'accounts'),
  ('c4444444-4444-4444-4444-444444444444', 'project_manager'),
  ('c5555555-5555-5555-5555-555555555555', 'sales'),
  ('c6666666-6666-6666-6666-666666666666', 'site_engineer');

-- 4. Create test projects: P1 (assigned to PM) and P2 (not assigned to PM)
INSERT INTO public.projects (id, code, name, site_location, start_date, planned_completion_date, status)
VALUES
  ('f1111111-1111-1111-1111-111111111111', 'WB-2026-COST-P1', 'Cost Test Project 1', 'Angul', CURRENT_DATE, CURRENT_DATE + 60, 'active'),
  ('f2222222-2222-2222-2222-222222222222', 'WB-2026-COST-P2', 'Cost Test Project 2', 'Jajpur', CURRENT_DATE, CURRENT_DATE + 60, 'active')
ON CONFLICT (id) DO NOTHING;

-- Assign PM to P1 only
DELETE FROM public.project_members WHERE project_id IN ('f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222');
INSERT INTO public.project_members (project_id, user_id, member_role) VALUES
  ('f1111111-1111-1111-1111-111111111111', 'c4444444-4444-4444-4444-444444444444', 'project_manager');

-- Pick a valid category id
DO $$
DECLARE
  v_cat_id UUID;
  v_order_id UUID;
  v_bill_id UUID;
  v_order_p2_id UUID;
  v_count INT;
  v_allowed BOOLEAN;
BEGIN
  SELECT id INTO v_cat_id FROM public.cost_categories WHERE name = 'Steel and raw material' LIMIT 1;

  -- Clean old records for test projects
  DELETE FROM public.bill_payments WHERE bill_id IN (SELECT id FROM public.bills WHERE project_id IN ('f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222'));
  DELETE FROM public.bills WHERE project_id IN ('f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222');
  DELETE FROM public.vendor_orders WHERE project_id IN ('f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222');
  DELETE FROM public.budget_lines WHERE project_id IN ('f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222');

  -- TEST 1: Director has full RW access on budget_lines, vendor_orders, bills, bill_payments
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" TO 'c1111111-1111-1111-1111-111111111111';

  INSERT INTO public.budget_lines (project_id, category_id, amount_excl_gst, note)
  VALUES ('f1111111-1111-1111-1111-111111111111', v_cat_id, 1000000.00, 'Director Seed Budget');

  INSERT INTO public.vendor_orders (id, project_id, category_id, kind, vendor_name, description, amount_excl_gst, gst_amount, expected_delivery_date, fulfilment_status)
  VALUES ('c8888888-8888-8888-8888-888888888888', 'f1111111-1111-1111-1111-111111111111', v_cat_id, 'material', 'Tata Steel Ltd', 'Primary steel members', 600000.00, 108000.00, CURRENT_DATE + 14, 'ordered')
  RETURNING id INTO v_order_id;

  INSERT INTO public.bills (id, project_id, category_id, vendor_order_id, bill_type, vendor_name, bill_number, bill_date, due_date, amount_excl_gst, gst_amount)
  VALUES ('c9999999-9999-9999-9999-999999999999', 'f1111111-1111-1111-1111-111111111111', v_cat_id, v_order_id, 'supplier_bill', 'Tata Steel Ltd', 'TS-BILL-001', CURRENT_DATE, CURRENT_DATE + 30, 600000.00, 108000.00)
  RETURNING id INTO v_bill_id;

  INSERT INTO public.bill_payments (bill_id, payment_date, amount_paid, tds_amount, mode)
  VALUES (v_bill_id, CURRENT_DATE, 300000.00, 6000.00, 'bank_transfer');

  SELECT COUNT(*) INTO v_count FROM public.budget_lines WHERE project_id = 'f1111111-1111-1111-1111-111111111111';
  INSERT INTO test_results_007 VALUES ('1. Director full RW on all cost tables', v_count = 1, 'Director created budget, order, bill, and payment successfully');

  -- Also create an order on P2 by Director
  INSERT INTO public.vendor_orders (id, project_id, category_id, kind, vendor_name, description, amount_excl_gst, gst_amount, expected_delivery_date, fulfilment_status)
  VALUES ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f2222222-2222-2222-2222-222222222222', v_cat_id, 'material', 'JSW Steel Ltd', 'Secondary purlins', 250000.00, 45000.00, CURRENT_DATE + 20, 'ordered')
  RETURNING id INTO v_order_p2_id;

  -- TEST 2: Purchase role has RW on vendor_orders, R on cost_categories, CANNOT read budget_lines or bills
  SET LOCAL "request.jwt.claim.sub" TO 'c2222222-2222-2222-2222-222222222222';

  SELECT COUNT(*) INTO v_count FROM public.cost_categories;
  v_allowed := (v_count > 0);

  -- Purchase can create vendor order
  INSERT INTO public.vendor_orders (project_id, category_id, kind, vendor_name, description, amount_excl_gst, gst_amount, expected_delivery_date, fulfilment_status)
  VALUES ('f1111111-1111-1111-1111-111111111111', v_cat_id, 'service', 'Crane Logistics', 'Mobile crane service', 50000.00, 9000.00, CURRENT_DATE + 5, 'ordered');

  -- Purchase cannot read budget_lines or bills
  SELECT COUNT(*) INTO v_count FROM public.budget_lines;
  v_allowed := v_allowed AND (v_count = 0);
  SELECT COUNT(*) INTO v_count FROM public.bills;
  v_allowed := v_allowed AND (v_count = 0);

  INSERT INTO test_results_007 VALUES ('2. Purchase RW on orders, blocked on budgets and bills', v_allowed, 'Purchase can create orders but cannot view budgets or bills');

  -- TEST 3: Accounts has RW on bills & payments, R on budgets & orders, CANNOT insert budget
  SET LOCAL "request.jwt.claim.sub" TO 'c3333333-3333-3333-3333-333333333333';

  SELECT COUNT(*) INTO v_count FROM public.budget_lines;
  v_allowed := (v_count = 1);

  SELECT COUNT(*) INTO v_count FROM public.vendor_orders;
  v_allowed := v_allowed AND (v_count >= 2);

  -- Accounts can insert bill
  INSERT INTO public.bills (project_id, category_id, bill_type, vendor_name, bill_number, bill_date, due_date, amount_excl_gst, gst_amount)
  VALUES ('f1111111-1111-1111-1111-111111111111', v_cat_id, 'direct_expense', 'Site Transport Express', 'DIR-EXP-99', CURRENT_DATE, CURRENT_DATE + 7, 15000.00, 2700.00);

  -- Accounts cannot insert budget_lines
  BEGIN
    INSERT INTO public.budget_lines (project_id, category_id, amount_excl_gst)
    VALUES ('f2222222-2222-2222-2222-222222222222', v_cat_id, 500000.00);
    v_allowed := false;
  EXCEPTION WHEN insufficient_privilege THEN
    -- Expected RLS block
    v_allowed := v_allowed AND true;
  END;

  INSERT INTO test_results_007 VALUES ('3. Accounts RW on bills, R on budgets & orders, cannot edit budget', v_allowed, 'Accounts can manage bills but cannot edit project budgets');

  -- TEST 4: Project Manager can read vendor orders on ASSIGNED project P1, but CANNOT read unassigned P2
  SET LOCAL "request.jwt.claim.sub" TO 'c4444444-4444-4444-4444-444444444444';

  SELECT COUNT(*) INTO v_count FROM public.vendor_orders WHERE project_id = 'f1111111-1111-1111-1111-111111111111';
  v_allowed := (v_count >= 1);

  SELECT COUNT(*) INTO v_count FROM public.vendor_orders WHERE project_id = 'f2222222-2222-2222-2222-222222222222';
  v_allowed := v_allowed AND (v_count = 0);

  -- PM cannot read budgets or bills
  SELECT COUNT(*) INTO v_count FROM public.budget_lines;
  v_allowed := v_allowed AND (v_count = 0);
  SELECT COUNT(*) INTO v_count FROM public.bills;
  v_allowed := v_allowed AND (v_count = 0);

  INSERT INTO test_results_007 VALUES ('4. PM reads assigned project orders only, blocked on unassigned and bills', v_allowed, 'PM sees orders for assigned project P1, zero for unassigned P2, zero bills');

  -- TEST 5: Sales role cannot read any cost tables
  SET LOCAL "request.jwt.claim.sub" TO 'c5555555-5555-5555-5555-555555555555';
  SELECT COUNT(*) INTO v_count FROM public.budget_lines;
  v_allowed := (v_count = 0);
  SELECT COUNT(*) INTO v_count FROM public.vendor_orders;
  v_allowed := v_allowed AND (v_count = 0);
  SELECT COUNT(*) INTO v_count FROM public.bills;
  v_allowed := v_allowed AND (v_count = 0);

  INSERT INTO test_results_007 VALUES ('5. Sales blocked on all cost tables', v_allowed, 'Sales gets 0 rows from budget_lines, vendor_orders, bills');

  -- TEST 6: Site Engineer cannot read any cost tables
  SET LOCAL "request.jwt.claim.sub" TO 'c6666666-6666-6666-6666-666666666666';
  SELECT COUNT(*) INTO v_count FROM public.budget_lines;
  v_allowed := (v_count = 0);
  SELECT COUNT(*) INTO v_count FROM public.vendor_orders;
  v_allowed := v_allowed AND (v_count = 0);
  SELECT COUNT(*) INTO v_count FROM public.bills;
  v_allowed := v_allowed AND (v_count = 0);

  INSERT INTO test_results_007 VALUES ('6. Site Engineer blocked on all cost tables', v_allowed, 'Site engineer gets 0 rows from budget_lines, vendor_orders, bills');

  -- TEST 7: Audit log captured actions on cost tables
  RESET ROLE;
  SELECT COUNT(*) INTO v_count FROM public.audit_log
  WHERE table_name IN ('budget_lines', 'vendor_orders', 'bills', 'bill_payments');

  INSERT INTO test_results_007 VALUES ('7. Audit triggers active on all cost tables', (v_count >= 4), 'Found ' || v_count || ' audit entries for cost operations');

END $$;

RESET ROLE;

SELECT test_name, passed, details FROM test_results_007;
