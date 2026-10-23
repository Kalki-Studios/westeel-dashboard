-- Test Suite 009: Sales RLS Matrix & Rule S12 Conversion Transaction Tests
-- Verification per PROJECT_BRIEF.md Task T13:
-- 1. Sales A cannot read Sales B's enquiries by direct request
-- 2. Sales A cannot read Sales B's quotations by direct request
-- 3. Site Engineer cannot read customers (returns 0 rows)
-- 4. Director has full RW access on all sales tables
-- 5. Rule S12 conversion test:
--    - Successful conversion of accepted quotation -> creates project, commercials, sets enquiry won
--    - Double conversion of same quotation is blocked
--    - Converting non-accepted quotation is blocked
--    - Atomic rollback: failed conversion leaves no partial records

CREATE TEMP TABLE IF NOT EXISTS test_results_009 (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results_009 TO authenticated;
TRUNCATE test_results_009;

-- 1. Setup test users
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('e1111111-1111-1111-1111-111111111111', 'director_t13@westeel.test', 'authenticated', 'authenticated'),
  ('e2222222-2222-2222-2222-222222222222', 'sales_a_t13@westeel.test', 'authenticated', 'authenticated'),
  ('e3333333-3333-3333-3333-333333333333', 'sales_b_t13@westeel.test', 'authenticated', 'authenticated'),
  ('e4444444-4444-4444-4444-444444444444', 'site_eng_t13@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, is_active) VALUES
  ('e1111111-1111-1111-1111-111111111111', 'Director T13', true),
  ('e2222222-2222-2222-2222-222222222222', 'Sales Person A', true),
  ('e3333333-3333-3333-3333-333333333333', 'Sales Person B', true),
  ('e4444444-4444-4444-4444-444444444444', 'Site Engineer T13', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

DELETE FROM public.user_roles WHERE user_id IN (
  'e1111111-1111-1111-1111-111111111111',
  'e2222222-2222-2222-2222-222222222222',
  'e3333333-3333-3333-3333-333333333333',
  'e4444444-4444-4444-4444-444444444444'
);

INSERT INTO public.user_roles (user_id, role) VALUES
  ('e1111111-1111-1111-1111-111111111111', 'director'),
  ('e2222222-2222-2222-2222-222222222222', 'sales'),
  ('e3333333-3333-3333-3333-333333333333', 'sales'),
  ('e4444444-4444-4444-4444-444444444444', 'site_engineer');

-- Clean up any prior test sales data
DELETE FROM public.enquiries WHERE title LIKE '%Test T13%';
DELETE FROM public.customers WHERE name LIKE '%Test T13%';

-- 2. As Director: Create seed customer and enquiries for Sales A and Sales B
SET LOCAL ROLE postgres;
DO $$
DECLARE
  v_cust_a UUID;
  v_cust_b UUID;
  v_enq_a UUID;
  v_enq_b UUID;
  v_quote_b UUID;
  v_src UUID;
BEGIN
  SELECT id INTO v_src FROM public.lead_sources LIMIT 1;

  INSERT INTO public.customers (id, name, contact_person, phone, created_by)
  VALUES ('c1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Customer A Test T13', 'Contact A', '9876543210', 'e2222222-2222-2222-2222-222222222222')
  RETURNING id INTO v_cust_a;

  INSERT INTO public.customers (id, name, contact_person, phone, created_by)
  VALUES ('c2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Customer B Test T13', 'Contact B', '9876543211', 'e3333333-3333-3333-3333-333333333333')
  RETURNING id INTO v_cust_b;

  INSERT INTO public.enquiries (id, customer_id, title, expected_value_excl_gst, source_id, assigned_to, created_by, status)
  VALUES ('e1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v_cust_a, 'Enquiry A Test T13', 500000, v_src, 'e2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'open')
  RETURNING id INTO v_enq_a;

  INSERT INTO public.enquiries (id, customer_id, title, expected_value_excl_gst, source_id, assigned_to, created_by, status)
  VALUES ('e2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', v_cust_b, 'Enquiry B Test T13', 850000, v_src, 'e3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 'open')
  RETURNING id INTO v_enq_b;

  INSERT INTO public.quotations (id, enquiry_id, quote_number, version, amount_excl_gst, status, created_by)
  VALUES ('e7777777-bbbb-bbbb-bbbb-bbbbbbbbbbbb', v_enq_b, 'WQ-2026-TEST-B', 1, 850000, 'draft', 'e3333333-3333-3333-3333-333333333333')
  RETURNING id INTO v_quote_b;
END $$;

-- 3. TEST 1: Sales A cannot read Sales B's enquiries by direct request
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e2222222-2222-2222-2222-222222222222", "role": "authenticated"}';
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.enquiries
  WHERE id = 'e2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  IF v_count = 0 THEN
    INSERT INTO test_results_009 VALUES ('Sales A cannot read Sales B enquiries', true, '0 rows visible as required');
  ELSE
    INSERT INTO test_results_009 VALUES ('Sales A cannot read Sales B enquiries', false, 'Leak: ' || v_count || ' rows visible');
  END IF;
END $$;

-- 4. TEST 2: Sales A cannot read Sales B's quotations by direct request
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.quotations
  WHERE id = 'e7777777-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  IF v_count = 0 THEN
    INSERT INTO test_results_009 VALUES ('Sales A cannot read Sales B quotations', true, '0 rows visible as required');
  ELSE
    INSERT INTO test_results_009 VALUES ('Sales A cannot read Sales B quotations', false, 'Leak: ' || v_count || ' rows visible');
  END IF;
END $$;

-- 5. TEST 3: Site Engineer cannot read customers
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e4444444-4444-4444-4444-444444444444", "role": "authenticated"}';
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM public.customers;

  IF v_count = 0 THEN
    INSERT INTO test_results_009 VALUES ('Site Engineer cannot read customers', true, '0 customer rows returned');
  ELSE
    INSERT INTO test_results_009 VALUES ('Site Engineer cannot read customers', false, 'Leak: ' || v_count || ' customers readable');
  END IF;
END $$;

-- 6. TEST 4: Director has full visibility
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e1111111-1111-1111-1111-111111111111", "role": "authenticated"}';
DO $$
DECLARE
  v_cust_count INT;
  v_enq_count INT;
  v_quote_count INT;
BEGIN
  SELECT count(*) INTO v_cust_count FROM public.customers WHERE name LIKE '%Test T13%';
  SELECT count(*) INTO v_enq_count FROM public.enquiries WHERE title LIKE '%Test T13%';
  SELECT count(*) INTO v_quote_count FROM public.quotations WHERE quote_number LIKE '%TEST-B%';

  IF v_cust_count >= 2 AND v_enq_count >= 2 AND v_quote_count >= 1 THEN
    INSERT INTO test_results_009 VALUES ('Director has full visibility on sales tables', true, 'All test records visible to Director');
  ELSE
    INSERT INTO test_results_009 VALUES ('Director has full visibility on sales tables', false, 'Missing rows: cust=' || v_cust_count || ', enq=' || v_enq_count);
  END IF;
END $$;

-- 7. TEST 5: Rule S12 Conversion - Non-accepted quotation conversion is blocked
DO $$
DECLARE
  v_err TEXT := '';
BEGIN
  BEGIN
    PERFORM public.convert_quotation_to_project('e7777777-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  IF v_err ILIKE '%must be accepted%' THEN
    INSERT INTO test_results_009 VALUES ('S12: Non-accepted quotation conversion blocked', true, 'Blocked with message: ' || v_err);
  ELSE
    INSERT INTO test_results_009 VALUES ('S12: Non-accepted quotation conversion blocked', false, 'Did not block correctly: ' || v_err);
  END IF;
END $$;

-- 8. TEST 6: Rule S12 Conversion - Successful conversion of accepted quotation
DO $$
DECLARE
  v_res JSONB;
  v_proj_id UUID;
  v_enq RECORD;
  v_comm RECORD;
  v_stage_pos INT;
BEGIN
  -- Mark quotation as accepted
  UPDATE public.quotations
  SET status = 'accepted', accepted_at = now()
  WHERE id = 'e7777777-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  -- Convert to project
  v_res := public.convert_quotation_to_project('e7777777-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  v_proj_id := (v_res->>'project_id')::UUID;

  -- Verify project stage is position 2 (Contract confirmation)
  SELECT ps.position INTO v_stage_pos
  FROM public.projects p
  JOIN public.project_stages ps ON ps.id = p.current_stage_id
  WHERE p.id = v_proj_id;

  -- Verify commercials
  SELECT * INTO v_comm FROM public.project_commercials WHERE project_id = v_proj_id;

  -- Verify enquiry status is won with won_at and project_id set
  SELECT * INTO v_enq FROM public.enquiries WHERE id = 'e2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  IF v_stage_pos = 2 AND v_comm.contract_value_excl_gst = 850000 AND v_enq.status = 'won' AND v_enq.project_id = v_proj_id THEN
    INSERT INTO test_results_009 VALUES ('S12: Successful conversion creates project & sets status won', true, 'Project created at Stage 2, commercials = 850000, enquiry marked won');
  ELSE
    INSERT INTO test_results_009 VALUES ('S12: Successful conversion creates project & sets status won', false, 'Mismatch: stage=' || v_stage_pos || ', comm=' || v_comm.contract_value_excl_gst || ', enq_status=' || v_enq.status);
  END IF;
END $$;

-- 9. TEST 7: Rule S12 Conversion - Double conversion is blocked
DO $$
DECLARE
  v_err TEXT := '';
BEGIN
  BEGIN
    PERFORM public.convert_quotation_to_project('e7777777-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  IF v_err ILIKE '%already been converted%' THEN
    INSERT INTO test_results_009 VALUES ('S12: Double conversion of quotation blocked', true, 'Correctly blocked: ' || v_err);
  ELSE
    INSERT INTO test_results_009 VALUES ('S12: Double conversion of quotation blocked', false, 'Failed to block double conversion: ' || v_err);
  END IF;
END $$;

-- 10. TEST 8: Atomic rollback check - Failed conversion leaves 0 partial records
DO $$
DECLARE
  v_fake_quote UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_proj_count_before INT;
  v_proj_count_after INT;
  v_err TEXT := '';
BEGIN
  SELECT count(*) INTO v_proj_count_before FROM public.projects;

  BEGIN
    PERFORM public.convert_quotation_to_project(v_fake_quote);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  SELECT count(*) INTO v_proj_count_after FROM public.projects;

  IF v_proj_count_before = v_proj_count_after AND v_err != '' THEN
    INSERT INTO test_results_009 VALUES ('S12: Atomic rollback leaves no partial records', true, 'Zero partial records created upon failure');
  ELSE
    INSERT INTO test_results_009 VALUES ('S12: Atomic rollback leaves no partial records', false, 'Partial records leaked or no error raised');
  END IF;
END $$;

-- Clean up test records
SET LOCAL ROLE postgres;
DELETE FROM public.projects WHERE notes LIKE '%Converted from Quotation WQ-2026-TEST-B%';
DELETE FROM public.quotations WHERE quote_number LIKE '%TEST-B%';
DELETE FROM public.enquiries WHERE title LIKE '%Test T13%';
DELETE FROM public.customers WHERE name LIKE '%Test T13%';

-- Output final test results
SELECT test_name, passed, details FROM test_results_009;
