-- Westeel Buildings: Migration 002 - Projects, Stages, Members, Milestones
-- Enums: project_status, milestone_status, delay_reason
-- Tables: project_stages, projects, project_members, project_milestones
-- Functions: generate_project_code(), is_project_member(project_id)
-- Triggers: audit triggers on projects, project_members, project_milestones
-- Row Level Security (RLS) policies

-- 1. Create Enums
CREATE TYPE project_status AS ENUM (
  'active',
  'on_hold',
  'closed',
  'cancelled'
);

CREATE TYPE milestone_status AS ENUM (
  'pending',
  'done'
);

CREATE TYPE delay_reason AS ENUM (
  'weather',
  'client_site_not_ready',
  'material_delay',
  'drawings_pending',
  'labour_shortage',
  'payment_delay',
  'other'
);

-- 2. Create Project Stages Table (9 Fixed Stages)
CREATE TABLE public.project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position INT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the 9 fixed stages exactly as specified in PROJECT_BRIEF.md Section 6
INSERT INTO public.project_stages (position, name) VALUES
  (1, 'Enquiry and quotation'),
  (2, 'Contract confirmation'),
  (3, 'Engineering and drawing approvals'),
  (4, 'Procurement and outsourced fabrication'),
  (5, 'Dispatch and material delivery'),
  (6, 'Site readiness'),
  (7, 'Erection and installation'),
  (8, 'Inspection and defect correction'),
  (9, 'Handover and project closure')
ON CONFLICT (position) DO NOTHING;

-- 3. Create Projects Table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  customer_id UUID, -- Foreign key added in T13 migration when sales tables exist
  quotation_id UUID,
  site_location TEXT NOT NULL,
  site_contact_name TEXT,
  site_contact_phone TEXT,
  current_stage_id UUID REFERENCES public.project_stages(id),
  start_date DATE NOT NULL,
  planned_completion_date DATE NOT NULL,
  actual_completion_date DATE,
  status project_status NOT NULL DEFAULT 'active',
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Project Members Table (Unique pair: project_id, user_id)
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- 5. Create Project Milestones Table
CREATE TABLE public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.project_stages(id),
  title TEXT NOT NULL,
  planned_date DATE,
  actual_date DATE,
  status milestone_status NOT NULL DEFAULT 'pending',
  delay_reason delay_reason,
  delay_note TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Helper Functions

-- Project code generator format WB-YYYY-NNN (e.g. WB-2026-001)
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_year TEXT := to_char(now(), 'YYYY');
  prefix TEXT := 'WB-' || current_year || '-';
  max_num INT := 0;
  next_code TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(code, '^WB-[0-9]{4}-([0-9]{3})$', '\1'),
        code
      )::INT
    ),
    0
  )
  INTO max_num
  FROM public.projects
  WHERE code LIKE prefix || '%';

  next_code := prefix || lpad((max_num + 1)::TEXT, 3, '0');
  RETURN next_code;
END;
$$;

-- Check if current authenticated user is assigned to project
CREATE OR REPLACE FUNCTION public.is_project_member(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.profiles pr ON pr.id = pm.user_id
    WHERE pm.project_id = p_id
      AND pm.user_id = auth.uid()
      AND pr.is_active = true
  );
$$;

-- 7. Audit Triggers on Project Tables
CREATE TRIGGER audit_projects_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_project_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_project_milestones_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies

-- STAGES
-- All active authenticated users can view stages
CREATE POLICY "project_stages_read_all"
  ON public.project_stages
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- PROJECTS
-- Director sees all projects.
-- Accounts sees all projects.
-- Purchase sees all active projects.
-- Project Manager, Site Engineer, Sales see only assigned projects.
CREATE POLICY "projects_select"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR public.has_role('accounts')
      OR (public.has_role('purchase') AND status = 'active')
      OR public.is_project_member(id)
    )
  );

-- Director can insert and update all projects
CREATE POLICY "projects_director_insert"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_director());

CREATE POLICY "projects_director_update"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Assigned Project Manager can update assigned project
CREATE POLICY "projects_pm_update"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND public.has_role('project_manager')
    AND public.is_project_member(id)
  )
  WITH CHECK (
    public.is_active_user()
    AND public.has_role('project_manager')
    AND public.is_project_member(id)
  );

-- PROJECT MEMBERS
-- Director can read all members; assigned members and accounts can view team
CREATE POLICY "project_members_select"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR public.has_role('accounts')
      OR public.is_project_member(project_id)
    )
  );

-- Director can manage all project members
CREATE POLICY "project_members_director_all"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Assigned Project Manager can add or remove members in their project
CREATE POLICY "project_members_pm_all"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (
    public.is_active_user()
    AND public.has_role('project_manager')
    AND public.is_project_member(project_id)
  )
  WITH CHECK (
    public.is_active_user()
    AND public.has_role('project_manager')
    AND public.is_project_member(project_id)
  );

-- PROJECT MILESTONES
-- Director, accounts, or assigned members can read milestones
-- (Purchase role does NOT see milestones)
CREATE POLICY "project_milestones_select"
  ON public.project_milestones
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR public.has_role('accounts')
      OR (
        NOT public.has_role('purchase')
        AND public.is_project_member(project_id)
      )
    )
  );

-- Director can manage all milestones
CREATE POLICY "project_milestones_director_all"
  ON public.project_milestones
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Assigned Project Manager can manage milestones in their project
CREATE POLICY "project_milestones_pm_all"
  ON public.project_milestones
  FOR ALL
  TO authenticated
  USING (
    public.is_active_user()
    AND public.has_role('project_manager')
    AND public.is_project_member(project_id)
  )
  WITH CHECK (
    public.is_active_user()
    AND public.has_role('project_manager')
    AND public.is_project_member(project_id)
  );
