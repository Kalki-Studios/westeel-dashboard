-- Test Suite 005: Site Reports RLS Matrix and Rule R6 Lifecycle Verification
-- Tests:
-- 1. Engineer A cannot read Engineer B's report on unassigned project
-- 2. Engineer A sees own reports on assigned project
-- 3. Engineer A can edit report when status is 'submitted' or 'correction_required'
-- 4. Engineer A CANNOT edit report once status is 'reviewed' (locked per Rule R6)
-- 5. Reviewer (PM / Director) can view and review reports

CREATE TEMP TABLE IF NOT EXISTS test_results (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
);
GRANT ALL ON test_results TO authenticated;
TRUNCATE test_results;

-- 1. Setup test users in auth.users
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'eng_a@westeel.test', 'authenticated', 'authenticated'),
  ('a2222222-2222-2222-2222-222222222222', 'eng_b@westeel.test', 'authenticated', 'authenticated'),
  ('a3333333-3333-3333-3333-333333333333', 'pm_test@westeel.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- 2. Setup profiles
INSERT INTO public.profiles (id, full_name, is_active) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Site Engineer A', true),
  ('a2222222-2222-2222-2222-222222222222', 'Site Engineer B', true),
  ('a3333333-3333-3333-3333-333333333333', 'Project Manager Test', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

-- 3. Assign roles
INSERT INTO public.user_roles (user_id, role) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'site_engineer'),
  ('a2222222-2222-2222-2222-222222222222', 'site_engineer'),
  ('a3333333-3333-3333-3333-333333333333', 'project_manager')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Create test projects
INSERT INTO public.projects (id, code, name, site_location, start_date, planned_completion_date, status)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 'WB-2026-SR-P1', 'Assigned Project 1', 'Bhubaneswar', CURRENT_DATE, CURRENT_DATE + 30, 'active'),
  ('b2222222-2222-2222-2222-222222222222', 'WB-2026-SR-P2', 'Unassigned Project 2', 'Cuttack', CURRENT_DATE, CURRENT_DATE + 30, 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Memberships: Eng A and PM on Proj 1; Eng B on Proj 2
INSERT INTO public.project_members (project_id, user_id, member_role) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'site_engineer'),
  ('b1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 'project_manager'),
  ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'site_engineer')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Clean existing test reports
DELETE FROM public.site_reports WHERE project_id IN ('b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222');

-- 6. Insert Reports
-- Eng A Report on Proj 1 (submitted)
INSERT INTO public.site_reports (
  id, project_id, report_date, submitted_by, work_completed, own_headcount, subcontractor_headcount, status
) VALUES (
  'c1111111-1111-1111-1111-111111111111',
  'b1111111-1111-1111-1111-111111111111',
  CURRENT_DATE - 1,
  'a1111111-1111-1111-1111-111111111111',
  'Anchor bolt grouting completed by Eng A',
  5, 10,
  'submitted'
);

-- Eng A Report on Proj 1 (reviewed / locked)
INSERT INTO public.site_reports (
  id, project_id, report_date, submitted_by, work_completed, own_headcount, subcontractor_headcount, status, reviewed_by, reviewed_at
) VALUES (
  'c2222222-2222-2222-2222-222222222222',
  'b1111111-1111-1111-1111-111111111111',
  CURRENT_DATE - 2,
  'a1111111-1111-1111-1111-111111111111',
  'Foundation civil work reviewed',
  4, 8,
  'reviewed',
  'a3333333-3333-3333-3333-333333333333',
  now()
);

-- Eng B Report on Proj 2 (submitted)
INSERT INTO public.site_reports (
  id, project_id, report_date, submitted_by, work_completed, own_headcount, subcontractor_headcount, status
) VALUES (
  'c3333333-3333-3333-3333-333333333333',
  'b2222222-2222-2222-2222-222222222222',
  CURRENT_DATE - 1,
  'a2222222-2222-2222-2222-222222222222',
  'Site grading on Proj 2 by Eng B',
  6, 12,
  'submitted'
);

-------------------------------------------------------------
-- TEST 1: Engineer A cannot read Engineer B report on Proj 2
-------------------------------------------------------------
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "a1111111-1111-1111-1111-111111111111"}';

INSERT INTO test_results (test_name, passed, details)
SELECT
  'Engineer A blocked from Engineer B report',
  (COUNT(*) = 0),
  'Rows visible: ' || COUNT(*)::text
FROM public.site_reports
WHERE submitted_by = 'a2222222-2222-2222-2222-222222222222';

-------------------------------------------------------------
-- TEST 2: Engineer A reads own reports on assigned project
-------------------------------------------------------------
INSERT INTO test_results (test_name, passed, details)
SELECT
  'Engineer A reads own assigned reports',
  (COUNT(*) = 2),
  'Rows visible: ' || COUNT(*)::text
FROM public.site_reports
WHERE project_id = 'b1111111-1111-1111-1111-111111111111';

-------------------------------------------------------------
-- TEST 3: Engineer A CAN update own report while submitted
-------------------------------------------------------------
UPDATE public.site_reports
SET work_completed = 'Grouting completed and cured'
WHERE id = 'c1111111-1111-1111-1111-111111111111';

INSERT INTO test_results (test_name, passed, details)
SELECT
  'Engineer A can edit submitted report',
  (COUNT(*) = 1),
  'Rows updated: ' || COUNT(*)::text
FROM public.site_reports
WHERE id = 'c1111111-1111-1111-1111-111111111111'
  AND work_completed = 'Grouting completed and cured';

-------------------------------------------------------------
-- TEST 4: Engineer A CANNOT update report once status is 'reviewed' (Rule R6 lock)
-------------------------------------------------------------
UPDATE public.site_reports
SET work_completed = 'Attempted edit on locked reviewed report'
WHERE id = 'c2222222-2222-2222-2222-222222222222';

INSERT INTO test_results (test_name, passed, details)
SELECT
  'Submitter locked from editing reviewed report (R6)',
  (COUNT(*) = 0),
  'Rows tampered: ' || COUNT(*)::text
FROM public.site_reports
WHERE id = 'c2222222-2222-2222-2222-222222222222'
  AND work_completed = 'Attempted edit on locked reviewed report';

-------------------------------------------------------------
-- TEST 5: Project Manager reads all reports on assigned project
-------------------------------------------------------------
SET request.jwt.claims TO '{"sub": "a3333333-3333-3333-3333-333333333333"}';

INSERT INTO test_results (test_name, passed, details)
SELECT
  'Project Manager reads assigned project reports',
  (COUNT(*) = 2),
  'Rows visible to PM: ' || COUNT(*)::text
FROM public.site_reports
WHERE project_id = 'b1111111-1111-1111-1111-111111111111';

-- Output final results
RESET ROLE;
SELECT * FROM test_results;
