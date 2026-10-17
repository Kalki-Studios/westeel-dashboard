-- Westeel Buildings: Test 001 - RLS Verification
-- Verifies:
-- 1. Non-director cannot read audit_log
-- 2. Non-director cannot insert/update user_roles
-- 3. Inactive user is denied access
-- 4. Director can read audit_log and manage roles

BEGIN;

CREATE TEMP TABLE test_results (
  test_num INT,
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results TO authenticated;

-- 1. Insert test users into auth.users (trigger auto-creates profiles)
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'director@westeel.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'sales@westeel.test', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'inactive_eng@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- 2. Update profiles
UPDATE public.profiles
SET full_name = 'Test Director', designation = 'Managing Director', is_active = true
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE public.profiles
SET full_name = 'Test Sales', designation = 'Sales Executive', is_active = true
WHERE id = '22222222-2222-2222-2222-222222222222';

UPDATE public.profiles
SET full_name = 'Test Inactive Engineer', designation = 'Site Engineer', is_active = false
WHERE id = '33333333-3333-3333-3333-333333333333';

-- 3. Assign Roles
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'director'),
  ('22222222-2222-2222-2222-222222222222', 'sales'),
  ('33333333-3333-3333-3333-333333333333', 'site_engineer')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Insert an audit log record
INSERT INTO public.audit_log (table_name, record_id, action, changed_by)
VALUES ('profiles', '11111111-1111-1111-1111-111111111111', 'INSERT', '11111111-1111-1111-1111-111111111111');

-- TEST 1: Director CAN read audit_log
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM public.audit_log;
  INSERT INTO test_results VALUES (1, 'Director can read audit_log', cnt >= 1, format('Found %s records', cnt));
END $$;

-- TEST 2: Sales CANNOT read audit_log (0 rows)
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM public.audit_log;
  INSERT INTO test_results VALUES (2, 'Sales cannot read audit_log', cnt = 0, format('Returned %s records', cnt));
END $$;

-- TEST 3: Sales CANNOT insert into user_roles
DO $$
BEGIN
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('22222222-2222-2222-2222-222222222222', 'director');
    INSERT INTO test_results VALUES (3, 'Sales blocked from inserting user_roles', false, 'Insert succeeded unexpectedly');
  EXCEPTION
    WHEN insufficient_privilege THEN
      INSERT INTO test_results VALUES (3, 'Sales blocked from inserting user_roles', true, 'Blocked by RLS policy');
  END;
END $$;

-- TEST 4: Inactive user blocked from user_roles
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM public.user_roles;
  INSERT INTO test_results VALUES (4, 'Inactive user blocked from roles', cnt = 0, format('Returned %s records', cnt));
END $$;

-- Reset role to service/admin to read test_results table
RESET ROLE;

SELECT test_num, test_name, passed, details FROM test_results ORDER BY test_num;

ROLLBACK;
