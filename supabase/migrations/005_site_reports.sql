-- Westeel Buildings: Migration 005 - Site Reports & Rule R6 Lifecycle
-- Enums: site_report_status
-- Tables: site_reports
-- Constraints: documents(site_report_id) foreign key
-- Triggers: audit trigger
-- Row Level Security (RLS) policies per Rule R6 and Section 5

-- 1. Create site_report_status Enum
CREATE TYPE site_report_status AS ENUM (
  'submitted',
  'correction_required',
  'reviewed'
);

-- 2. Create site_reports Table
CREATE TABLE public.site_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  work_completed TEXT NOT NULL,
  progress_note TEXT,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  own_headcount INT NOT NULL DEFAULT 0 CHECK (own_headcount >= 0),
  subcontractor_headcount INT NOT NULL DEFAULT 0 CHECK (subcontractor_headcount >= 0),
  materials_received TEXT,
  materials_required TEXT,
  problems_delays TEXT,
  delay_reason delay_reason,
  action_required TEXT,
  responsible_party TEXT,
  status site_report_status NOT NULL DEFAULT 'submitted',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_report_date UNIQUE (project_id, report_date)
);

-- 3. Add Foreign Key from documents to site_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_site_report'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT fk_documents_site_report
      FOREIGN KEY (site_report_id) REFERENCES public.site_reports(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Enable Audit Trigger on site_reports
CREATE TRIGGER site_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.site_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.site_reports ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Policy 1: Director can read all site reports
CREATE POLICY "director_read_site_reports"
  ON public.site_reports
  FOR SELECT
  USING (public.is_director());

-- Policy 2: Director can update / review all site reports
CREATE POLICY "director_update_site_reports"
  ON public.site_reports
  FOR UPDATE
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Policy 3: Project Manager can read reports of assigned projects
CREATE POLICY "pm_read_assigned_site_reports"
  ON public.site_reports
  FOR SELECT
  USING (
    public.has_role('project_manager') AND public.is_project_member(project_id)
  );

-- Policy 4: Project Manager can review reports of assigned projects
CREATE POLICY "pm_review_assigned_site_reports"
  ON public.site_reports
  FOR UPDATE
  USING (
    public.has_role('project_manager') AND public.is_project_member(project_id)
  )
  WITH CHECK (
    public.has_role('project_manager') AND public.is_project_member(project_id)
  );

-- Policy 5: Site Engineer can view ONLY own reports on assigned projects
CREATE POLICY "engineer_read_own_site_reports"
  ON public.site_reports
  FOR SELECT
  USING (
    submitted_by = auth.uid() AND public.is_project_member(project_id)
  );

-- Policy 6: Site Engineer can submit report on assigned projects
CREATE POLICY "engineer_insert_site_reports"
  ON public.site_reports
  FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid() AND public.is_project_member(project_id)
  );

-- Policy 7: Site Engineer can update own report ONLY while status is 'submitted' or 'correction_required'
-- Once status is 'reviewed', this policy forbids any edit by the submitter (Rule R6)
CREATE POLICY "engineer_update_own_site_reports"
  ON public.site_reports
  FOR UPDATE
  USING (
    submitted_by = auth.uid()
    AND public.is_project_member(project_id)
    AND status IN ('submitted', 'correction_required')
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.is_project_member(project_id)
    AND status = 'submitted'
  );
