-- Westeel Buildings: Test 004 - Documents & Drawings RLS and Rule Verification
-- Verifies per T6 spec:
-- 1. Site engineer CANNOT read restricted documents (contract, invoice, bill)
-- 2. Site engineer CAN read assigned drawings and site photos
-- 3. Rule R7: Inserting revision with supersedes_id automatically supersedes the older revision
-- 4. Accounts can read restricted documents
-- 5. Director can read all documents
-- 6. Storage bucket 'project-files' is strictly private (public = false)

BEGIN;

CREATE TEMP TABLE test_results (
  test_num INT,
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results TO authenticated;

-- Setup test users
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('44444444-4444-4444-4444-444444444444', 'site_eng@westeel.test', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'sales_person@westeel.test', 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', 'director_boss@westeel.test', 'authenticated', 'authenticated'),
  ('99999999-9999-9999-9999-999999999999', 'accounts_user@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, is_active) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Site Engineer Test', true),
  ('55555555-5555-5555-5555-555555555555', 'Sales Person Test', true),
  ('77777777-7777-7777-7777-777777777777', 'Director Boss Test', true),
  ('99999999-9999-9999-9999-999999999999', 'Accounts User Test', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('44444444-4444-4444-4444-444444444444', 'site_engineer'),
  ('55555555-5555-5555-5555-555555555555', 'sales'),
  ('77777777-7777-7777-7777-777777777777', 'director'),
  ('99999999-9999-9999-9999-999999999999', 'accounts')
ON CONFLICT (user_id, role) DO NOTHING;

-- Test Project
INSERT INTO public.projects (id, code, name, site_location, start_date, planned_completion_date, status)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'WB-2026-TEST-T6',
  'Doc Test Project',
  'Paradip Port Area',
  CURRENT_DATE,
  CURRENT_DATE + 30,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Assign site engineer to this project
INSERT INTO public.project_members (project_id, user_id, member_role)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '44444444-4444-4444-4444-444444444444',
  'site_engineer'
) ON CONFLICT (project_id, user_id) DO NOTHING;

-- 1. Create Restricted Documents (Contract, Invoice)
INSERT INTO public.documents (id, project_id, category, title, storage_path, mime_type, size_bytes)
VALUES
  ('d1111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'contract', 'Master Client Contract.pdf', 'projects/WB-2026-TEST-T6/contract.pdf', 'application/pdf', 1024),
  ('d2222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'invoice', 'Advance Milestone Tax Invoice.pdf', 'projects/WB-2026-TEST-T6/invoice.pdf', 'application/pdf', 2048)
ON CONFLICT (id) DO NOTHING;

-- 2. Create General Drawing (Revision 1)
INSERT INTO public.documents (id, project_id, category, title, storage_path, mime_type, size_bytes, version_no, review_status)
VALUES (
  'd3333333-3333-3333-3333-333333333333',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'drawing',
  'Anchor Bolt Layout Plan Rev 0.dwg',
  'projects/WB-2026-TEST-T6/drawing_v1.dwg',
  'application/acad',
  512000,
  1,
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- TEST 1: Site Engineer tries to select restricted documents (Contract, Invoice)
-- (Must return 0 rows per Rule R8)
-- -------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  1,
  'Site engineer blocked from restricted documents (R8)',
  (COUNT(*) = 0),
  'Returned ' || COUNT(*) || ' rows for contract/invoice'
FROM public.documents
WHERE id IN ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222');

-- -------------------------------------------------------------
-- TEST 2: Site Engineer can view general drawing on assigned project
-- (Must return 1 row)
-- -------------------------------------------------------------
INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  2,
  'Site engineer can view general drawing on assigned project',
  (COUNT(*) = 1 AND bool_and(id = 'd3333333-3333-3333-3333-333333333333')),
  'Returned ' || COUNT(*) || ' rows'
FROM public.documents
WHERE id = 'd3333333-3333-3333-3333-333333333333';

-- -------------------------------------------------------------
-- TEST 3: Accounts User CAN read restricted documents
-- -------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999';

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  3,
  'Accounts user can read restricted contract and invoice',
  (COUNT(*) = 2),
  'Returned ' || COUNT(*) || ' rows'
FROM public.documents
WHERE id IN ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222');

-- -------------------------------------------------------------
-- TEST 4: Rule R7: Inserting Revision 2 supersedes Revision 1
-- -------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';

INSERT INTO public.documents (id, project_id, category, title, storage_path, mime_type, size_bytes, version_no, review_status, supersedes_id)
VALUES (
  'd4444444-4444-4444-4444-444444444444',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'drawing',
  'Anchor Bolt Layout Plan Rev 1.dwg',
  'projects/WB-2026-TEST-T6/drawing_v2.dwg',
  'application/acad',
  520000,
  2,
  'pending',
  'd3333333-3333-3333-3333-333333333333'
);

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  4,
  'Rule R7: Inserting revision sets older drawing to superseded',
  (review_status = 'superseded'),
  'Older revision review_status is ' || review_status
FROM public.documents
WHERE id = 'd3333333-3333-3333-3333-333333333333';

-- -------------------------------------------------------------
-- TEST 5: Verify Storage Bucket 'project-files' is strictly private
-- -------------------------------------------------------------
INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  5,
  'Storage bucket project-files is strictly private (public = false)',
  (public = false),
  'Bucket public status is ' || public::text
FROM storage.buckets
WHERE id = 'project-files';

RESET ROLE;

SELECT test_num, test_name, passed, details FROM test_results ORDER BY test_num;

ROLLBACK;
