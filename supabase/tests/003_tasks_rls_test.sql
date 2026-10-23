-- Westeel Buildings: Test 003 - Tasks and Issues RLS Verification
-- Verifies per T5 spec:
-- 1. Employee sees only own tasks (assigned or created by them)
-- 2. PM sees tasks of assigned projects
-- 3. Employee cannot update tasks assigned to other employees
-- 4. Director sees all tasks

BEGIN;

CREATE TEMP TABLE test_results (
  test_num INT,
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results TO authenticated;

-- Insert all test users and profiles
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('44444444-4444-4444-4444-444444444444', 'site_eng@westeel.test', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'sales_person@westeel.test', 'authenticated', 'authenticated'),
  ('66666666-6666-6666-6666-666666666666', 'purchase_user@westeel.test', 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', 'director_boss@westeel.test', 'authenticated', 'authenticated'),
  ('88888888-8888-8888-8888-888888888888', 'pm_user@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, is_active) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Site Engineer Test', true),
  ('55555555-5555-5555-5555-555555555555', 'Sales Person Test', true),
  ('66666666-6666-6666-6666-666666666666', 'Purchase User Test', true),
  ('77777777-7777-7777-7777-777777777777', 'Director Boss Test', true),
  ('88888888-8888-8888-8888-888888888888', 'PM User Test', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('44444444-4444-4444-4444-444444444444', 'site_engineer'),
  ('55555555-5555-5555-5555-555555555555', 'sales'),
  ('66666666-6666-6666-6666-666666666666', 'purchase'),
  ('77777777-7777-7777-7777-777777777777', 'director'),
  ('88888888-8888-8888-8888-888888888888', 'project_manager')
ON CONFLICT (user_id, role) DO NOTHING;

-- Project for testing
INSERT INTO public.projects (id, code, name, site_location, start_date, planned_completion_date, status)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'WB-2026-TEST-T5',
  'PM Test Project',
  'Cuttack Industrial Zone',
  CURRENT_DATE,
  CURRENT_DATE + 30,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Assign PM to this project
INSERT INTO public.project_members (project_id, user_id, member_role)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '88888888-8888-8888-8888-888888888888',
  'project_manager'
) ON CONFLICT (project_id, user_id) DO NOTHING;

-- Create Tasks:
-- Task 1: Assigned to Sales User, no project
INSERT INTO public.tasks (id, title, priority, status, assignee_id, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Follow up with client for design signoff',
  'high',
  'open',
  '55555555-5555-5555-5555-555555555555',
  '77777777-7777-7777-7777-777777777777'
) ON CONFLICT (id) DO NOTHING;

-- Task 2: Linked to PM Test Project, assigned to Purchase User
INSERT INTO public.tasks (id, project_id, title, priority, status, assignee_id, created_by)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Order high tensile anchor bolts',
  'critical',
  'open',
  '66666666-6666-6666-6666-666666666666',
  '88888888-8888-8888-8888-888888888888'
) ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- TEST 1: Site Engineer (44444444...) sees ONLY own tasks
-- (Has 0 tasks assigned -> must return 0 rows)
-- -------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  1,
  'Unassigned employee sees 0 tasks',
  (COUNT(*) = 0),
  'Returned ' || COUNT(*) || ' rows'
FROM public.tasks
WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- -------------------------------------------------------------
-- TEST 2: Sales User sees ONLY own assigned task (Task 1, not Task 2)
-- -------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  2,
  'Employee sees own assigned task but not others',
  (COUNT(*) = 1 AND bool_and(id = '11111111-1111-1111-1111-111111111111')),
  'Returned ' || COUNT(*) || ' rows'
FROM public.tasks
WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- -------------------------------------------------------------
-- TEST 3: PM sees tasks belonging to their assigned project (Task 2)
-- -------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  3,
  'PM sees tasks on assigned project even if assigned to someone else',
  (COUNT(*) = 1 AND bool_and(id = '22222222-2222-2222-2222-222222222222')),
  'Returned ' || COUNT(*) || ' rows'
FROM public.tasks
WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- -------------------------------------------------------------
-- TEST 4: Employee cannot update task assigned to another person
-- (Sales user tries to update Task 2 assigned to Purchase -> 0 rows updated)
-- -------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

UPDATE public.tasks
SET status = 'blocked', blocked_reason = 'Unauthorized tamper'
WHERE id = '22222222-2222-2222-2222-222222222222';

-- Switch to Director to verify the record was untouched
SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  4,
  'Nobody edits others tasks (tamper blocked)',
  (status = 'open' AND blocked_reason IS NULL),
  'Status is ' || status
FROM public.tasks
WHERE id = '22222222-2222-2222-2222-222222222222';

-- -------------------------------------------------------------
-- TEST 5: Director sees all tasks
-- -------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';

INSERT INTO test_results (test_num, test_name, passed, details)
SELECT
  5,
  'Director sees all tasks',
  (COUNT(*) = 2),
  'Returned ' || COUNT(*) || ' rows'
FROM public.tasks
WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

RESET ROLE;

SELECT test_num, test_name, passed, details FROM test_results ORDER BY test_num;

ROLLBACK;
