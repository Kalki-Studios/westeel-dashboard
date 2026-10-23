-- ==============================================================================
-- Test Suite 010: Task T15 Full RLS Permissions Matrix Verification
-- Tests every business area x every application role per PROJECT_BRIEF.md Section 5.
-- Roles: director, project_manager, sales, purchase, site_engineer, accounts
-- ==============================================================================

CREATE TEMP TABLE IF NOT EXISTS test_matrix_results (
  area TEXT,
  role_name TEXT,
  operation TEXT,
  expected TEXT,
  actual TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_matrix_results TO authenticated;
TRUNCATE test_matrix_results;

DO $$
DECLARE
  v_dir_id UUID := 'f1111111-1111-1111-1111-111111111111';
  v_pm_id UUID := 'f2222222-2222-2222-2222-222222222222';
  v_sales_id UUID := 'f3333333-3333-3333-3333-333333333333';
  v_other_sales_id UUID := 'f3333333-3333-3333-3333-333333333334';
  v_purch_id UUID := 'f4444444-4444-4444-4444-444444444444';
  v_site_id UUID := 'f5555555-5555-5555-5555-555555555555';
  v_acc_id UUID := 'f6666666-6666-6666-6666-666666666666';

  v_p1_id UUID := 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_p2_id UUID := 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  v_cust_id UUID := 'fccccccc-cccc-cccc-cccc-cccccccccccc';
  v_enq_own_id UUID := 'fddddddd-dddd-dddd-dddd-dddddddddddd';
  v_enq_other_id UUID := 'feeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  v_cat_id UUID;
  v_stage_id UUID;
  v_order_id UUID := 'f1110000-0000-0000-0000-000000000001';
  v_bill_id UUID := 'f1110000-0000-0000-0000-000000000002';
  v_inv_id UUID := 'f1110000-0000-0000-0000-000000000003';
  v_rep_id UUID := 'f1110000-0000-0000-0000-000000000004';

  v_cnt INTEGER;
  v_err TEXT;
BEGIN
  -- 1. Setup Test Users
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_dir_id, 'director_t15@westeel.test', 'authenticated', 'authenticated'),
    (v_pm_id, 'pm_t15@westeel.test', 'authenticated', 'authenticated'),
    (v_sales_id, 'sales_t15@westeel.test', 'authenticated', 'authenticated'),
    (v_other_sales_id, 'sales_other_t15@westeel.test', 'authenticated', 'authenticated'),
    (v_purch_id, 'purchase_t15@westeel.test', 'authenticated', 'authenticated'),
    (v_site_id, 'site_t15@westeel.test', 'authenticated', 'authenticated'),
    (v_acc_id, 'accounts_t15@westeel.test', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, is_active) VALUES
    (v_dir_id, 'Director T15', true),
    (v_pm_id, 'Project Manager T15', true),
    (v_sales_id, 'Sales Rep T15', true),
    (v_other_sales_id, 'Other Sales Rep T15', true),
    (v_purch_id, 'Purchase Officer T15', true),
    (v_site_id, 'Site Engineer T15', true),
    (v_acc_id, 'Accountant T15', true)
  ON CONFLICT (id) DO UPDATE SET is_active = true;

  DELETE FROM public.user_roles WHERE user_id IN (v_dir_id, v_pm_id, v_sales_id, v_other_sales_id, v_purch_id, v_site_id, v_acc_id);
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_dir_id, 'director'),
    (v_pm_id, 'project_manager'),
    (v_sales_id, 'sales'),
    (v_other_sales_id, 'sales'),
    (v_purch_id, 'purchase'),
    (v_site_id, 'site_engineer'),
    (v_acc_id, 'accounts');

  -- 2. Setup Seed Test Data
  SELECT id INTO v_cat_id FROM public.cost_categories LIMIT 1;
  SELECT id INTO v_stage_id FROM public.project_stages LIMIT 1;

  -- Customer
  DELETE FROM public.customers WHERE id = v_cust_id;
  INSERT INTO public.customers (id, name) VALUES (v_cust_id, 'T15 Matrix Customer');

  -- Projects: P1 assigned to PM & Site Eng; P2 unassigned
  DELETE FROM public.projects WHERE id IN (v_p1_id, v_p2_id);
  INSERT INTO public.projects (id, code, name, site_location, status, current_stage_id, start_date, planned_completion_date) VALUES
    (v_p1_id, 'WP-T15-P1', 'T15 Assigned Project 1', 'Dhamra Port', 'active', v_stage_id, '2026-10-01', '2026-11-30'),
    (v_p2_id, 'WP-T15-P2', 'T15 Unassigned Project 2', 'Paradeep', 'active', v_stage_id, '2026-10-01', '2026-11-30');

  DELETE FROM public.project_members WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.project_members (project_id, user_id, member_role) VALUES
    (v_p1_id, v_pm_id, 'project_manager'),
    (v_p1_id, v_site_id, 'site_engineer');

  -- Commercials & Variations on P1
  DELETE FROM public.project_commercials WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.project_commercials (project_id, contract_value_excl_gst) VALUES (v_p1_id, 10000000.00);

  DELETE FROM public.variation_orders WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.variation_orders (project_id, title, amount_excl_gst, status) VALUES (v_p1_id, 'T15 Variation', 500000.00, 'approved');

  -- Billing: Invoices & Receipts on P1
  DELETE FROM public.invoices WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.invoices (id, project_id, invoice_number, invoice_date, due_date, amount_excl_gst, gst_amount) VALUES
    (v_inv_id, v_p1_id, 'INV-T15-01', '2026-10-01', '2026-10-15', 1000000.00, 180000.00);

  DELETE FROM public.receipts WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.receipts (project_id, invoice_id, receipt_date, amount_received) VALUES
    (v_p1_id, v_inv_id, '2026-10-10', 500000.00);

  -- Costs: Vendor Order & Bill on P1
  DELETE FROM public.vendor_orders WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.vendor_orders (id, project_id, category_id, kind, vendor_name, description, amount_excl_gst, gst_amount, order_date, expected_delivery_date, fulfilment_status) VALUES
    (v_order_id, v_p1_id, v_cat_id, 'material', 'Tata Steel', 'Structural steel beams', 400000.00, 72000.00, '2026-10-01', '2026-10-15', 'ordered');

  DELETE FROM public.bills WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.bills (id, project_id, category_id, vendor_order_id, bill_type, vendor_name, bill_number, bill_date, due_date, amount_excl_gst, gst_amount) VALUES
    (v_bill_id, v_p1_id, v_cat_id, v_order_id, 'supplier_bill', 'Tata Steel', 'TB-T15-01', '2026-10-05', '2026-10-20', 200000.00, 36000.00);

  -- Cash: Bank Balances & Cash Items
  DELETE FROM public.bank_balances WHERE account_label LIKE '%T15 Matrix%';
  INSERT INTO public.bank_balances (account_label, balance, as_of_date, recorded_by) VALUES
    ('HDFC Bank T15 Matrix', 2500000.00, '2026-10-18', v_dir_id);

  DELETE FROM public.company_cash_items WHERE description LIKE '%T15 Matrix%';
  INSERT INTO public.company_cash_items (direction, category, description, amount, expected_date, status, created_by) VALUES
    ('outflow', 'Salary Total', 'T15 Matrix Salary', 800000.00, '2026-10-31', 'planned', v_dir_id);

  -- Sales: Enquiries
  DELETE FROM public.enquiries WHERE id IN (v_enq_own_id, v_enq_other_id);
  INSERT INTO public.enquiries (id, customer_id, title, expected_value_excl_gst, assigned_to, status) VALUES
    (v_enq_own_id, v_cust_id, 'T15 Own Enquiry', 1500000.00, v_sales_id, 'open'),
    (v_enq_other_id, v_cust_id, 'T15 Other Enquiry', 2500000.00, v_other_sales_id, 'open');

  -- Documents on P1
  DELETE FROM public.documents WHERE project_id IN (v_p1_id, v_p2_id) OR storage_path LIKE 't15-matrix/%';
  INSERT INTO public.documents (project_id, category, title, storage_path, mime_type, size_bytes, version_no, uploaded_by) VALUES
    (v_p1_id, 'drawing', 'T15 Layout Drawing', 't15-matrix/doc1.pdf', 'application/pdf', 1024, 1, v_dir_id),
    (v_p1_id, 'contract', 'T15 Restricted Contract', 't15-matrix/doc2.pdf', 'application/pdf', 1024, 1, v_dir_id);

  -- Site Report on P1
  DELETE FROM public.site_reports WHERE project_id IN (v_p1_id, v_p2_id);
  INSERT INTO public.site_reports (id, project_id, report_date, submitted_by, work_completed, status) VALUES
    (v_rep_id, v_p1_id, '2026-10-18', v_site_id, 'Erection of columns', 'submitted');

END $$;

-- ----------------------------------------------------------------------------
-- EXECUTE ROLE IMPERSONATIONS & MATRIX TESTS
-- ----------------------------------------------------------------------------

-- TEST 1: SITE ENGINEER (Role = site_engineer)
-- Should see: assigned projects (P1), own site reports, general drawings.
-- Should NOT see: unassigned projects (P2), financial tables (commercials, invoices, receipts, bills, bank_balances, cash items), customers, enquiries, restricted documents.
DO $$
DECLARE
  v_site_id UUID := 'f5555555-5555-5555-5555-555555555555';
  v_cnt INTEGER;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_site_id::text, true);

  -- Projects: Assigned P1 vs Unassigned P2
  SELECT count(*) INTO v_cnt FROM public.projects WHERE id = 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  INSERT INTO test_matrix_results VALUES ('Projects', 'site_engineer', 'SELECT (assigned)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Site engineer sees assigned project P1');

  SELECT count(*) INTO v_cnt FROM public.projects WHERE id = 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  INSERT INTO test_matrix_results VALUES ('Projects', 'site_engineer', 'SELECT (unassigned)', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Site engineer cannot see unassigned project P2');

  -- Commercials: Must be 0
  SELECT count(*) INTO v_cnt FROM public.project_commercials;
  INSERT INTO test_matrix_results VALUES ('Project Commercials', 'site_engineer', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: site engineer cannot read commercials');

  -- Invoices: Must be 0
  SELECT count(*) INTO v_cnt FROM public.invoices;
  INSERT INTO test_matrix_results VALUES ('Invoices', 'site_engineer', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: site engineer cannot read invoices');

  -- Bills: Must be 0
  SELECT count(*) INTO v_cnt FROM public.bills;
  INSERT INTO test_matrix_results VALUES ('Bills & Payables', 'site_engineer', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: site engineer cannot read vendor bills');

  -- Bank Balances: Must be 0
  SELECT count(*) INTO v_cnt FROM public.bank_balances;
  INSERT INTO test_matrix_results VALUES ('Bank Balances', 'site_engineer', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: site engineer cannot read bank balances');

  -- Company Cash Items: Must be 0
  SELECT count(*) INTO v_cnt FROM public.company_cash_items;
  INSERT INTO test_matrix_results VALUES ('Company Cash Items', 'site_engineer', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: site engineer cannot read cash flow or payroll');

  -- Customers: Must be 0
  SELECT count(*) INTO v_cnt FROM public.customers;
  INSERT INTO test_matrix_results VALUES ('Customers', 'site_engineer', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Sales isolation: site engineer cannot read customers');

  -- Restricted Documents (category = 'contract'): Must be 0
  SELECT count(*) INTO v_cnt FROM public.documents WHERE category = 'contract';
  INSERT INTO test_matrix_results VALUES ('Restricted Documents', 'site_engineer', 'SELECT (contract)', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Document isolation: site engineer cannot read contracts');

  -- General Documents (category = 'drawing') on assigned P1: Must be visible
  SELECT count(*) INTO v_cnt FROM public.documents WHERE category = 'drawing';
  INSERT INTO test_matrix_results VALUES ('General Documents', 'site_engineer', 'SELECT (drawing on P1)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Site engineer sees drawings on assigned project');

  -- Site Report: Own report on P1
  SELECT count(*) INTO v_cnt FROM public.site_reports WHERE id = 'f1110000-0000-0000-0000-000000000004';
  INSERT INTO test_matrix_results VALUES ('Site Reports', 'site_engineer', 'SELECT (own report)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Site engineer reads own site report');
END $$;

-- TEST 2: SALESPERSON (Role = sales)
-- Should see: own enquiries, assigned projects.
-- Should NOT see: other salesperson enquiries, financials, site reports, restricted documents.
DO $$
DECLARE
  v_sales_id UUID := 'f3333333-3333-3333-3333-333333333333';
  v_cnt INTEGER;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);

  -- Own Enquiry vs Other Sales Enquiry
  SELECT count(*) INTO v_cnt FROM public.enquiries WHERE id = 'fddddddd-dddd-dddd-dddd-dddddddddddd';
  INSERT INTO test_matrix_results VALUES ('Enquiries', 'sales', 'SELECT (own enquiry)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Sales rep sees own enquiry');

  SELECT count(*) INTO v_cnt FROM public.enquiries WHERE id = 'feeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  INSERT INTO test_matrix_results VALUES ('Enquiries', 'sales', 'SELECT (other rep enquiry)', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Sales rep strictly blocked from other rep enquiries');

  -- Financial isolation: Commercials, Invoices, Bills, Cash
  SELECT count(*) INTO v_cnt FROM public.project_commercials;
  INSERT INTO test_matrix_results VALUES ('Project Commercials', 'sales', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: sales rep cannot read commercials');

  SELECT count(*) INTO v_cnt FROM public.invoices;
  INSERT INTO test_matrix_results VALUES ('Invoices', 'sales', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: sales rep cannot read invoices');

  SELECT count(*) INTO v_cnt FROM public.bank_balances;
  INSERT INTO test_matrix_results VALUES ('Bank Balances', 'sales', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Financial isolation: sales rep cannot read bank balances');

  SELECT count(*) INTO v_cnt FROM public.site_reports;
  INSERT INTO test_matrix_results VALUES ('Site Reports', 'sales', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Sales rep cannot read site reports');
END $$;

-- TEST 3: PURCHASE OFFICER (Role = purchase)
-- Should see: all active projects (for procurement context), vendor orders, purchase documents.
-- Should NOT see: commercials, invoices, receipts, bank balances, company cash items, customers, enquiries.
DO $$
DECLARE
  v_purch_id UUID := 'f4444444-4444-4444-4444-444444444444';
  v_cnt INTEGER;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_purch_id::text, true);

  -- Projects: Can see active projects
  SELECT count(*) INTO v_cnt FROM public.projects WHERE status = 'active';
  INSERT INTO test_matrix_results VALUES ('Projects', 'purchase', 'SELECT (active projects)', 'Allowed (>0 rows)', v_cnt || ' row(s)', v_cnt > 0, 'Purchase sees active projects for order linking');

  -- Vendor Orders: Can see and manage orders
  SELECT count(*) INTO v_cnt FROM public.vendor_orders WHERE id = 'f1110000-0000-0000-0000-000000000001';
  INSERT INTO test_matrix_results VALUES ('Vendor Orders', 'purchase', 'SELECT (orders)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Purchase sees vendor orders');

  -- Commercials & Invoices: Must be denied
  SELECT count(*) INTO v_cnt FROM public.project_commercials;
  INSERT INTO test_matrix_results VALUES ('Project Commercials', 'purchase', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Purchase blocked from client commercials');

  SELECT count(*) INTO v_cnt FROM public.invoices;
  INSERT INTO test_matrix_results VALUES ('Invoices', 'purchase', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Purchase blocked from client invoices');

  SELECT count(*) INTO v_cnt FROM public.bank_balances;
  INSERT INTO test_matrix_results VALUES ('Bank Balances', 'purchase', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Purchase blocked from bank balances');

  SELECT count(*) INTO v_cnt FROM public.customers;
  INSERT INTO test_matrix_results VALUES ('Customers', 'purchase', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Purchase blocked from sales customers');
END $$;

-- TEST 4: ACCOUNTS (Role = accounts)
-- Should see: all projects, commercials (read), invoices/receipts (RW), bills/payments (RW), bank balances (RW), company cash (read), restricted documents.
-- Should NOT see: customers/enquiries, cannot write commercials.
DO $$
DECLARE
  v_acc_id UUID := 'f6666666-6666-6666-6666-666666666666';
  v_cnt INTEGER;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_acc_id::text, true);

  -- Commercials: Read only
  SELECT count(*) INTO v_cnt FROM public.project_commercials;
  INSERT INTO test_matrix_results VALUES ('Project Commercials', 'accounts', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Accounts reads commercials for billing verification');

  -- Invoices: Full RW
  SELECT count(*) INTO v_cnt FROM public.invoices WHERE id = 'f1110000-0000-0000-0000-000000000003';
  INSERT INTO test_matrix_results VALUES ('Invoices', 'accounts', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Accounts manages invoices');

  -- Bills & Payables: Full RW
  SELECT count(*) INTO v_cnt FROM public.bills WHERE id = 'f1110000-0000-0000-0000-000000000002';
  INSERT INTO test_matrix_results VALUES ('Bills & Payables', 'accounts', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Accounts manages vendor bills');

  -- Bank Balances: Full RW
  SELECT count(*) INTO v_cnt FROM public.bank_balances WHERE account_label LIKE '%T15 Matrix%';
  INSERT INTO test_matrix_results VALUES ('Bank Balances', 'accounts', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Accounts manages bank balances');

  -- Company Cash Items: Read only
  SELECT count(*) INTO v_cnt FROM public.company_cash_items WHERE description LIKE '%T15 Matrix%';
  INSERT INTO test_matrix_results VALUES ('Company Cash Items', 'accounts', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Accounts reads company cash items');

  -- Restricted Documents (Contract): Allowed for Accounts
  SELECT count(*) INTO v_cnt FROM public.documents WHERE category = 'contract';
  INSERT INTO test_matrix_results VALUES ('Restricted Documents', 'accounts', 'SELECT (contract)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Accounts reads contracts for financial verification');

  -- Customers & Enquiries: Denied
  SELECT count(*) INTO v_cnt FROM public.enquiries;
  INSERT INTO test_matrix_results VALUES ('Enquiries', 'accounts', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'Accounts blocked from sales enquiries');
END $$;

-- TEST 5: PROJECT MANAGER (Role = project_manager)
-- Should see: assigned projects (P1), assigned milestones, assigned site reports, assigned documents.
-- Should NOT see: unassigned projects (P2), commercials, invoices, bills, bank balances, company cash.
DO $$
DECLARE
  v_pm_id UUID := 'f2222222-2222-2222-2222-222222222222';
  v_cnt INTEGER;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_pm_id::text, true);

  -- Assigned P1 vs Unassigned P2
  SELECT count(*) INTO v_cnt FROM public.projects WHERE id = 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  INSERT INTO test_matrix_results VALUES ('Projects', 'project_manager', 'SELECT (assigned P1)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'PM reads assigned project');

  SELECT count(*) INTO v_cnt FROM public.projects WHERE id = 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  INSERT INTO test_matrix_results VALUES ('Projects', 'project_manager', 'SELECT (unassigned P2)', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'PM blocked from unassigned project');

  -- Site Reports: Can review on assigned project
  SELECT count(*) INTO v_cnt FROM public.site_reports WHERE id = 'f1110000-0000-0000-0000-000000000004';
  INSERT INTO test_matrix_results VALUES ('Site Reports', 'project_manager', 'SELECT (assigned P1)', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'PM reviews site report on assigned project');

  -- Financial isolation: Commercials, Invoices, Bank Balances
  SELECT count(*) INTO v_cnt FROM public.project_commercials;
  INSERT INTO test_matrix_results VALUES ('Project Commercials', 'project_manager', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'PM blocked from contract financials');

  SELECT count(*) INTO v_cnt FROM public.invoices;
  INSERT INTO test_matrix_results VALUES ('Invoices', 'project_manager', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'PM blocked from billing invoices');

  SELECT count(*) INTO v_cnt FROM public.bank_balances;
  INSERT INTO test_matrix_results VALUES ('Bank Balances', 'project_manager', 'SELECT', 'Denied (0 rows)', v_cnt || ' row(s)', v_cnt = 0, 'PM blocked from bank balances');
END $$;

-- TEST 6: DIRECTOR (Role = director)
-- Full visibility and management across all areas
DO $$
DECLARE
  v_dir_id UUID := 'f1111111-1111-1111-1111-111111111111';
  v_cnt INTEGER;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_dir_id::text, true);

  SELECT count(*) INTO v_cnt FROM public.projects WHERE id IN ('faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  INSERT INTO test_matrix_results VALUES ('Projects', 'director', 'SELECT (all)', 'Allowed (2 rows)', v_cnt || ' row(s)', v_cnt = 2, 'Director reads all projects');

  SELECT count(*) INTO v_cnt FROM public.project_commercials;
  INSERT INTO test_matrix_results VALUES ('Project Commercials', 'director', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Director reads commercials');

  SELECT count(*) INTO v_cnt FROM public.invoices;
  INSERT INTO test_matrix_results VALUES ('Invoices', 'director', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Director reads invoices');

  SELECT count(*) INTO v_cnt FROM public.bank_balances;
  INSERT INTO test_matrix_results VALUES ('Bank Balances', 'director', 'SELECT', 'Allowed (1 row)', v_cnt || ' row(s)', v_cnt = 1, 'Director reads bank balances');

  SELECT count(*) INTO v_cnt FROM public.enquiries;
  INSERT INTO test_matrix_results VALUES ('Enquiries', 'director', 'SELECT (all reps)', 'Allowed (2 rows)', v_cnt || ' row(s)', v_cnt = 2, 'Director reads all sales enquiries');

  SELECT count(*) INTO v_cnt FROM public.audit_log;
  INSERT INTO test_matrix_results VALUES ('Audit Log', 'director', 'SELECT', 'Allowed (>0 rows)', v_cnt || ' row(s)', v_cnt > 0, 'Director reads complete audit log');
END $$;

-- Reset role to postgres superuser
RESET ROLE;

-- Return full verification matrix
SELECT area, role_name, operation, expected, actual, passed, details FROM test_matrix_results ORDER BY area, role_name;
