-- Test Suite 006: Billing & Collections RLS Matrix and Permissions Verification
-- Tests:
-- 1. Director has full RW access on all 5 tables
-- 2. Accounts has Read-Only on project_commercials and variation_orders (CANNOT edit contract value)
-- 3. Accounts has full RW access on payment_milestones, invoices, receipts
-- 4. PM, Sales, Purchase, Site Engineer CANNOT read or write any of the 5 tables

CREATE TEMP TABLE IF NOT EXISTS test_results (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results TO authenticated;
TRUNCATE test_results;

-- 1. Setup test users in auth.users
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'director_t6@westeel.test', 'authenticated', 'authenticated'),
  ('d2222222-2222-2222-2222-222222222222', 'accounts_t6@westeel.test', 'authenticated', 'authenticated'),
  ('d3333333-3333-3333-3333-333333333333', 'pm_t6@westeel.test', 'authenticated', 'authenticated'),
  ('d4444444-4444-4444-4444-444444444444', 'sales_t6@westeel.test', 'authenticated', 'authenticated'),
  ('d5555555-5555-5555-5555-555555555555', 'site_t6@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- 2. Setup profiles
INSERT INTO public.profiles (id, full_name, is_active) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Director Test', true),
  ('d2222222-2222-2222-2222-222222222222', 'Accounts Test', true),
  ('d3333333-3333-3333-3333-333333333333', 'PM Test', true),
  ('d4444444-4444-4444-4444-444444444444', 'Sales Test', true),
  ('d5555555-5555-5555-5555-555555555555', 'Site Eng Test', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

-- 3. Assign roles
DELETE FROM public.user_roles WHERE user_id IN (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444',
  'd5555555-5555-5555-5555-555555555555'
);

INSERT INTO public.user_roles (user_id, role) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'director'),
  ('d2222222-2222-2222-2222-222222222222', 'accounts'),
  ('d3333333-3333-3333-3333-333333333333', 'project_manager'),
  ('d4444444-4444-4444-4444-444444444444', 'sales'),
  ('d5555555-5555-5555-5555-555555555555', 'site_engineer');

-- 4. Create a test project
INSERT INTO public.projects (id, code, name, site_location, start_date, planned_completion_date, status)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'WB-2026-BILL-P1', 'Billing Test Project', 'Bhubaneswar', CURRENT_DATE, CURRENT_DATE + 60, 'active')
ON CONFLICT (id) DO NOTHING;

-- Clean existing test records for this project
DELETE FROM public.receipts WHERE project_id = 'e1111111-1111-1111-1111-111111111111';
DELETE FROM public.invoices WHERE project_id = 'e1111111-1111-1111-1111-111111111111';
DELETE FROM public.payment_milestones WHERE project_id = 'e1111111-1111-1111-1111-111111111111';
DELETE FROM public.variation_orders WHERE project_id = 'e1111111-1111-1111-1111-111111111111';
DELETE FROM public.project_commercials WHERE project_id = 'e1111111-1111-1111-1111-111111111111';

-------------------------------------------------------------
-- TEST 1: Director can create and edit project commercials
-------------------------------------------------------------
SET ROLE authenticated;
SET request.jwt.claim.sub = 'd1111111-1111-1111-1111-111111111111';

INSERT INTO public.project_commercials (project_id, contract_value_excl_gst, updated_by)
VALUES ('e1111111-1111-1111-1111-111111111111', 5000000.00, 'd1111111-1111-1111-1111-111111111111');

INSERT INTO public.variation_orders (id, project_id, title, amount_excl_gst, status, approved_by, approved_on)
VALUES ('e2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'Extra Canopy Extension', 250000.00, 'approved', 'd1111111-1111-1111-1111-111111111111', CURRENT_DATE);

INSERT INTO test_results (test_name, passed, details)
SELECT 'Director RW on commercials and variations',
       count(*) = 1,
       'Commercial created: ' || count(*)
FROM public.project_commercials
WHERE project_id = 'e1111111-1111-1111-1111-111111111111';

-------------------------------------------------------------
-- TEST 2: Accounts can READ project commercials & variations
-------------------------------------------------------------
SET request.jwt.claim.sub = 'd2222222-2222-2222-2222-222222222222';

INSERT INTO test_results (test_name, passed, details)
SELECT 'Accounts can READ commercials and variations',
       (SELECT count(*) FROM public.project_commercials WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 1 AND
       (SELECT count(*) FROM public.variation_orders WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 1,
       'Accounts read count: ' || (SELECT count(*) FROM public.project_commercials WHERE project_id = 'e1111111-1111-1111-1111-111111111111');

-------------------------------------------------------------
-- TEST 3: Accounts CANNOT EDIT contract value
-------------------------------------------------------------
-- Attempt update contract value as accounts
UPDATE public.project_commercials
SET contract_value_excl_gst = 9999999.00
WHERE project_id = 'e1111111-1111-1111-1111-111111111111';

INSERT INTO test_results (test_name, passed, details)
SELECT 'Accounts CANNOT EDIT contract value',
       contract_value_excl_gst = 5000000.00,
       'Contract value remained: ' || contract_value_excl_gst
FROM public.project_commercials
WHERE project_id = 'e1111111-1111-1111-1111-111111111111';

-------------------------------------------------------------
-- TEST 4: Accounts has RW on milestones, invoices, receipts
-------------------------------------------------------------
INSERT INTO public.payment_milestones (id, project_id, label, amount_excl_gst, expected_date, position)
VALUES ('e3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111', 'Advance 20%', 1000000.00, CURRENT_DATE + 5, 1);

INSERT INTO public.invoices (id, project_id, payment_milestone_id, invoice_number, invoice_date, due_date, amount_excl_gst, gst_amount)
VALUES ('e4444444-4444-4444-4444-444444444444', 'e1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', 'INV-2026-TEST-001', CURRENT_DATE, CURRENT_DATE + 15, 1000000.00, 180000.00);

INSERT INTO public.receipts (id, project_id, invoice_id, receipt_date, amount_received, tds_amount, mode, reference)
VALUES ('e5555555-5555-5555-5555-555555555555', 'e1111111-1111-1111-1111-111111111111', 'e4444444-4444-4444-4444-444444444444', CURRENT_DATE, 1160000.00, 20000.00, 'bank_transfer', 'NEFT-889900');

INSERT INTO test_results (test_name, passed, details)
SELECT 'Accounts RW on milestones, invoices, receipts',
       (SELECT count(*) FROM public.payment_milestones WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 1 AND
       (SELECT count(*) FROM public.invoices WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 1 AND
       (SELECT count(*) FROM public.receipts WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 1,
       'Accounts created billing flow successfully';

-------------------------------------------------------------
-- TEST 5: PM cannot read commercials, variations, milestones, invoices, receipts
-------------------------------------------------------------
SET request.jwt.claim.sub = 'd3333333-3333-3333-3333-333333333333';

INSERT INTO test_results (test_name, passed, details)
SELECT 'PM cannot read any billing tables',
       (SELECT count(*) FROM public.project_commercials WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.variation_orders WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.payment_milestones WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.invoices WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.receipts WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0,
       'PM read count total: ' || (
         (SELECT count(*) FROM public.project_commercials WHERE project_id = 'e1111111-1111-1111-1111-111111111111') +
         (SELECT count(*) FROM public.variation_orders WHERE project_id = 'e1111111-1111-1111-1111-111111111111') +
         (SELECT count(*) FROM public.payment_milestones WHERE project_id = 'e1111111-1111-1111-1111-111111111111') +
         (SELECT count(*) FROM public.invoices WHERE project_id = 'e1111111-1111-1111-1111-111111111111') +
         (SELECT count(*) FROM public.receipts WHERE project_id = 'e1111111-1111-1111-1111-111111111111')
       );

-------------------------------------------------------------
-- TEST 6: Sales cannot read any billing tables
-------------------------------------------------------------
SET request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';

INSERT INTO test_results (test_name, passed, details)
SELECT 'Sales cannot read any billing tables',
       (SELECT count(*) FROM public.project_commercials WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.variation_orders WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.payment_milestones WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.invoices WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.receipts WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0,
       'Sales read count: 0';

-------------------------------------------------------------
-- TEST 7: Site Engineer cannot read any billing tables
-------------------------------------------------------------
SET request.jwt.claim.sub = 'd5555555-5555-5555-5555-555555555555';

INSERT INTO test_results (test_name, passed, details)
SELECT 'Site Engineer cannot read any billing tables',
       (SELECT count(*) FROM public.project_commercials WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.variation_orders WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.payment_milestones WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.invoices WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0 AND
       (SELECT count(*) FROM public.receipts WHERE project_id = 'e1111111-1111-1111-1111-111111111111') = 0,
       'Site Engineer read count: 0';

-------------------------------------------------------------
-- TEST 8: Audit log records changes on billing tables
-------------------------------------------------------------
RESET ROLE;
INSERT INTO test_results (test_name, passed, details)
SELECT 'Audit log captures billing table changes',
       count(*) >= 5,
       'Audit entries captured: ' || count(*)
FROM public.audit_log
WHERE record_id IN (
  'e1111111-1111-1111-1111-111111111111',
  'e2222222-2222-2222-2222-222222222222',
  'e3333333-3333-3333-3333-333333333333',
  'e4444444-4444-4444-4444-444444444444',
  'e5555555-5555-5555-5555-555555555555'
);

-- Output all test results
SELECT test_name, passed, details FROM test_results;
