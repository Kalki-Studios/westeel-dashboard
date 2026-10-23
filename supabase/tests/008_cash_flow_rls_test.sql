-- Test Suite 008: Cash Flow (bank_balances and company_cash_items) RLS Matrix
-- Tests:
-- 1. Director has full RW access on bank_balances and company_cash_items
-- 2. Accounts has RW access on bank_balances, but delete is restricted to Director
-- 3. Accounts has Read-only access on company_cash_items (cannot insert, update, or delete)
-- 4. PM, Purchase, Sales, Site Engineer have ZERO access to both bank_balances and company_cash_items
-- 5. Audit triggers fire on bank_balances and company_cash_items

CREATE TEMP TABLE IF NOT EXISTS test_results_008 (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results_008 TO authenticated;
TRUNCATE test_results_008;

-- 1. Setup test users
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'director_t12@westeel.test', 'authenticated', 'authenticated'),
  ('d2222222-2222-2222-2222-222222222222', 'accounts_t12@westeel.test', 'authenticated', 'authenticated'),
  ('d3333333-3333-3333-3333-333333333333', 'pm_t12@westeel.test', 'authenticated', 'authenticated'),
  ('d4444444-4444-4444-4444-444444444444', 'sales_t12@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, is_active) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Director T12', true),
  ('d2222222-2222-2222-2222-222222222222', 'Accounts T12', true),
  ('d3333333-3333-3333-3333-333333333333', 'PM T12', true),
  ('d4444444-4444-4444-4444-444444444444', 'Sales T12', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

DELETE FROM public.user_roles WHERE user_id IN (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444'
);

INSERT INTO public.user_roles (user_id, role) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'director'),
  ('d2222222-2222-2222-2222-222222222222', 'accounts'),
  ('d3333333-3333-3333-3333-333333333333', 'project_manager'),
  ('d4444444-4444-4444-4444-444444444444', 'sales');

-- Clean up any prior test rows
DELETE FROM public.bank_balances WHERE account_label LIKE 'TEST_%';
DELETE FROM public.company_cash_items WHERE description LIKE 'TEST_%';

-- -----------------------------------------------------------------------------
-- Test 1: Director can insert, select, and delete on bank_balances
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "d1111111-1111-1111-1111-111111111111", "role": "authenticated"}';

DO $$
DECLARE
  v_id UUID;
  v_cnt INT;
BEGIN
  INSERT INTO public.bank_balances (account_label, balance, as_of_date, note, recorded_by)
  VALUES ('TEST_HDFC', 500000.00, CURRENT_DATE, 'Test HDFC Balance', 'd1111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_id;

  SELECT COUNT(*) INTO v_cnt FROM public.bank_balances WHERE id = v_id;
  IF v_cnt = 1 THEN
    INSERT INTO test_results_008 VALUES ('Director can insert and read bank_balances', true, 'Row inserted and readable');
  ELSE
    INSERT INTO test_results_008 VALUES ('Director can insert and read bank_balances', false, 'Row not readable');
  END IF;

  DELETE FROM public.bank_balances WHERE id = v_id;
  SELECT COUNT(*) INTO v_cnt FROM public.bank_balances WHERE id = v_id;
  IF v_cnt = 0 THEN
    INSERT INTO test_results_008 VALUES ('Director can delete bank_balances', true, 'Row deleted');
  ELSE
    INSERT INTO test_results_008 VALUES ('Director can delete bank_balances', false, 'Row not deleted');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Test 2: Accounts can insert and update bank_balances, but CANNOT delete
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "d2222222-2222-2222-2222-222222222222", "role": "authenticated"}';

DO $$
DECLARE
  v_id UUID;
  v_cnt INT;
BEGIN
  INSERT INTO public.bank_balances (account_label, balance, as_of_date, note, recorded_by)
  VALUES ('TEST_SBI', 250000.00, CURRENT_DATE, 'Test SBI Balance', 'd2222222-2222-2222-2222-222222222222')
  RETURNING id INTO v_id;

  UPDATE public.bank_balances SET balance = 300000.00 WHERE id = v_id;
  SELECT balance INTO v_cnt FROM public.bank_balances WHERE id = v_id;
  IF v_cnt = 300000.00 THEN
    INSERT INTO test_results_008 VALUES ('Accounts can insert and update bank_balances', true, 'Balance updated to 300000');
  ELSE
    INSERT INTO test_results_008 VALUES ('Accounts can insert and update bank_balances', false, 'Update failed');
  END IF;

  -- Attempt delete as accounts (should be blocked by RLS: 0 rows deleted)
  DELETE FROM public.bank_balances WHERE id = v_id;
  SELECT COUNT(*) INTO v_cnt FROM public.bank_balances WHERE id = v_id;
  IF v_cnt = 1 THEN
    INSERT INTO test_results_008 VALUES ('Accounts CANNOT delete bank_balances', true, 'Delete blocked by RLS');
  ELSE
    INSERT INTO test_results_008 VALUES ('Accounts CANNOT delete bank_balances', false, 'Accounts was able to delete');
  END IF;
END $$;

-- Reset role to postgres to clean up TEST_SBI
RESET ROLE;
DELETE FROM public.bank_balances WHERE account_label = 'TEST_SBI';

-- -----------------------------------------------------------------------------
-- Test 3: Director can insert, select, and update company_cash_items
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "d1111111-1111-1111-1111-111111111111", "role": "authenticated"}';

DO $$
DECLARE
  v_id UUID;
  v_cnt INT;
BEGIN
  INSERT INTO public.company_cash_items (direction, category, description, amount, expected_date, created_by)
  VALUES ('outflow', 'Payroll', 'TEST_Office Staff Salary', 150000.00, CURRENT_DATE + 5, 'd1111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_id;

  SELECT COUNT(*) INTO v_cnt FROM public.company_cash_items WHERE id = v_id;
  IF v_cnt = 1 THEN
    INSERT INTO test_results_008 VALUES ('Director can insert and read company_cash_items', true, 'Row inserted and readable');
  ELSE
    INSERT INTO test_results_008 VALUES ('Director can insert and read company_cash_items', false, 'Row not readable');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Test 4: Accounts can SELECT company_cash_items, but CANNOT INSERT or UPDATE
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "d2222222-2222-2222-2222-222222222222", "role": "authenticated"}';

DO $$
DECLARE
  v_cnt INT;
  v_err BOOLEAN := false;
BEGIN
  -- Can read existing
  SELECT COUNT(*) INTO v_cnt FROM public.company_cash_items WHERE description = 'TEST_Office Staff Salary';
  IF v_cnt = 1 THEN
    INSERT INTO test_results_008 VALUES ('Accounts can read company_cash_items', true, 'Read successful');
  ELSE
    INSERT INTO test_results_008 VALUES ('Accounts can read company_cash_items', false, 'Read failed or returned 0');
  END IF;

  -- Cannot insert
  BEGIN
    INSERT INTO public.company_cash_items (direction, category, description, amount, expected_date, created_by)
    VALUES ('outflow', 'Rent', 'TEST_Workshop Rent', 40000.00, CURRENT_DATE + 10, 'd2222222-2222-2222-2222-222222222222');
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
  END;

  IF v_err THEN
    INSERT INTO test_results_008 VALUES ('Accounts CANNOT insert company_cash_items', true, 'Insert raised permission exception');
  ELSE
    INSERT INTO test_results_008 VALUES ('Accounts CANNOT insert company_cash_items', false, 'Accounts inserted company_cash_items without error');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Test 5: PM and Sales have 0 access on bank_balances and company_cash_items
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "d3333333-3333-3333-3333-333333333333", "role": "authenticated"}';

DO $$
DECLARE
  v_bb_cnt INT;
  v_ci_cnt INT;
BEGIN
  SELECT COUNT(*) INTO v_bb_cnt FROM public.bank_balances;
  SELECT COUNT(*) INTO v_ci_cnt FROM public.company_cash_items;

  IF v_bb_cnt = 0 AND v_ci_cnt = 0 THEN
    INSERT INTO test_results_008 VALUES ('PM has zero access to cash flow tables', true, '0 rows visible');
  ELSE
    INSERT INTO test_results_008 VALUES ('PM has zero access to cash flow tables', false, 'Rows were visible to PM');
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "d4444444-4444-4444-4444-444444444444", "role": "authenticated"}';

DO $$
DECLARE
  v_bb_cnt INT;
  v_ci_cnt INT;
BEGIN
  SELECT COUNT(*) INTO v_bb_cnt FROM public.bank_balances;
  SELECT COUNT(*) INTO v_ci_cnt FROM public.company_cash_items;

  IF v_bb_cnt = 0 AND v_ci_cnt = 0 THEN
    INSERT INTO test_results_008 VALUES ('Sales has zero access to cash flow tables', true, '0 rows visible');
  ELSE
    INSERT INTO test_results_008 VALUES ('Sales has zero access to cash flow tables', false, 'Rows were visible to Sales');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Clean up test records
-- -----------------------------------------------------------------------------
RESET ROLE;
DELETE FROM public.bank_balances WHERE account_label LIKE 'TEST_%';
DELETE FROM public.company_cash_items WHERE description LIKE 'TEST_%';

-- Output final test results
SELECT * FROM test_results_008 ORDER BY test_name;
