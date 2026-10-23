-- Westeel Buildings: Test 002 - Projects RLS Verification
-- Verifies:
-- 1. Site engineer not on project cannot read it
-- 2. Sales sees only assigned projects
-- 3. Purchase sees all active projects
-- 4. Director sees all projects

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
  ('66666666-6666-6666-6666-666666666666', 'purchase_user@westeel.test', 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', 'director_boss@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Populate profiles
UPDATE public.profiles SET is_active = true WHERE id IN (
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777'
);

-- Populate roles
INSERT INTO public.user_roles (user_id, role) VALUES
  ('44444444-4444-4444-4444-444444444444', 'site_engineer'),
  ('55555555-5555-5555-5555-555555555555', 'sales'),
  ('66666666-6666-6666-6666-666666666666', 'purchase'),
  ('77777777-7777-7777-7777-777777777777', 'director')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create a test project
INSERT INTO public.projects (id, code, name, site_location, start_date, planned_completion_date, status)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'WB-2026-TEST',
  'Secret Warehouse Project',
  'Bhubaneswar Site A',
  CURRENT_DATE,
  CURRENT_DATE + 30,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Assign ONLY sales to this project
INSERT INTO public.project_members (project_id, user_id, member_role)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '55555555-5555-5555-5555-555555555555',
  'sales'
) ON CONFLICT (project_id, user_id) DO NOTHING;

-- TEST 1: Site Engineer NOT on project CANNOT see it
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM public.projects WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  INSERT INTO test_results VALUES (1, 'Unassigned site engineer cannot see project', cnt = 0, format('Returned %s rows', cnt));
END $$;

-- TEST 2: Assigned Sales user CAN see it
SET LOCAL "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM public.projects WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  INSERT INTO test_results VALUES (2, 'Assigned sales user can see project', cnt = 1, format('Returned %s rows', cnt));
END $$;

-- TEST 3: Purchase sees active project
SET LOCAL "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM public.projects WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  INSERT INTO test_results VALUES (3, 'Purchase can see active project', cnt = 1, format('Returned %s rows', cnt));
END $$;

-- TEST 4: Director sees all projects
SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM public.projects WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  INSERT INTO test_results VALUES (4, 'Director can see project', cnt = 1, format('Returned %s rows', cnt));
END $$;

RESET ROLE;

SELECT test_num, test_name, passed, details FROM test_results ORDER BY test_num;

ROLLBACK;
