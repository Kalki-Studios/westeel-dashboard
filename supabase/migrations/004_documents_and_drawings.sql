-- Westeel Buildings: Migration 004 - Documents, Drawings, and Private Storage
-- Enums: doc_category, drawing_review_status
-- Tables: documents
-- Storage: private bucket project-files with RLS
-- Triggers: audit triggers, auto-supersede trigger per Rule R7
-- Row Level Security (RLS) policies per Rule R8

-- 1. Create Enums
CREATE TYPE doc_category AS ENUM (
  'contract',
  'quotation',
  'drawing',
  'customer_approval',
  'purchase_order',
  'invoice',
  'bill',
  'delivery_document',
  'site_photo',
  'inspection',
  'handover',
  'other'
);

CREATE TYPE drawing_review_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'superseded'
);

-- 2. Create Documents Table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  quotation_id UUID,
  site_report_id UUID,
  invoice_id UUID,
  bill_id UUID,
  vendor_order_id UUID,
  category doc_category NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  version_no INT NOT NULL DEFAULT 1,
  review_status drawing_review_status, -- Only for category drawing, else null
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  supersedes_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Trigger for Rule R7: Automatically set superseded on older revision
CREATE OR REPLACE FUNCTION public.handle_document_revision_supersede()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    UPDATE public.documents
    SET review_status = 'superseded',
        updated_at = now()
    WHERE id = NEW.supersedes_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER document_supersede_trigger
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_document_revision_supersede();

-- 4. Audit Trigger
CREATE TRIGGER audit_documents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 6. Helper check for document access per Rule R8
CREATE OR REPLACE FUNCTION public.can_access_document(doc_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = doc_id
      AND public.is_active_user()
      AND (
        -- Director & Accounts have full access to all categories (including restricted)
        public.is_director()
        OR public.has_role('accounts')
        OR (
          -- Restricted categories (contract, invoice, bill) are strictly forbidden to others
          d.category NOT IN ('contract', 'invoice', 'bill')
          AND (
            -- Purchase order access
            (d.category = 'purchase_order' AND (public.has_role('purchase') OR (public.has_role('project_manager') AND d.project_id IS NOT NULL AND public.is_project_member(d.project_id))))
            -- Delivery document access
            OR (d.category = 'delivery_document' AND (public.has_role('purchase') OR (d.project_id IS NOT NULL AND public.is_project_member(d.project_id))))
            -- General category access (drawings, photos, inspections, etc.)
            OR (d.project_id IS NOT NULL AND public.is_project_member(d.project_id))
            -- General doc uploaded by user
            OR (d.project_id IS NULL AND d.uploaded_by = auth.uid())
          )
        )
      )
  );
$$;

-- 7. Document RLS Policies

-- SELECT:
CREATE POLICY "documents_select"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR public.has_role('accounts')
      OR (
        category NOT IN ('contract', 'invoice', 'bill')
        AND (
          (category = 'purchase_order' AND (public.has_role('purchase') OR (public.has_role('project_manager') AND project_id IS NOT NULL AND public.is_project_member(project_id))))
          OR (category = 'delivery_document' AND (public.has_role('purchase') OR (project_id IS NOT NULL AND public.is_project_member(project_id))))
          OR (project_id IS NOT NULL AND public.is_project_member(project_id))
          OR (project_id IS NULL AND uploaded_by = auth.uid())
        )
      )
    )
  );

-- INSERT:
CREATE POLICY "documents_insert"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      public.is_director()
      OR (public.has_role('accounts') AND category IN ('invoice', 'bill', 'contract', 'other'))
      OR (public.has_role('purchase') AND category IN ('purchase_order', 'delivery_document', 'other'))
      OR (
        category NOT IN ('contract', 'invoice', 'bill')
        AND project_id IS NOT NULL
        AND public.is_project_member(project_id)
      )
    )
  );

-- UPDATE:
-- Director can update any document.
-- Project Manager can update drawing review status on assigned projects.
CREATE POLICY "documents_update"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR (
        category = 'drawing'
        AND public.has_role('project_manager')
        AND project_id IS NOT NULL
        AND public.is_project_member(project_id)
      )
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      public.is_director()
      OR (
        category = 'drawing'
        AND public.has_role('project_manager')
        AND project_id IS NOT NULL
        AND public.is_project_member(project_id)
      )
    )
  );

-- DELETE:
CREATE POLICY "documents_delete"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (public.is_director());

-- 8. Storage: Ensure private bucket 'project-files' exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files',
  'project-files',
  false, -- STRICTLY PRIVATE, NO PUBLIC URL
  26214400, -- 25MB max limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/acad',
    'application/x-acad',
    'application/autocad_dwg',
    'image/vnd.dwg',
    'image/x-dwg',
    'application/dwg',
    'application/x-dwg',
    'application/x-autocad',
    'image/vnd.dxf',
    'image/x-dxf'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 9. Storage Object Policies for 'project-files'
CREATE POLICY "project_files_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.is_active_user()
  );

CREATE POLICY "project_files_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND public.is_active_user()
  );
