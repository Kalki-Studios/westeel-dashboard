-- ==============================================================================
-- Migration 009: Sales Data Capture and Conversion (Task T13)
-- Priority 3 Block: Sales Tracker (Rules S1, S2, S3, S4, S5, S11, S12, S13)
-- ==============================================================================

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    CREATE TYPE public.enquiry_status AS ENUM (
        'open',
        'quoted',
        'won',
        'lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.followup_kind AS ENUM (
        'call',
        'meeting',
        'site_visit',
        'message',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.quotation_status AS ENUM (
        'draft',
        'sent',
        'negotiating',
        'accepted',
        'rejected',
        'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Lead Sources (Assumption A16)
CREATE TABLE IF NOT EXISTS public.lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Seed Default Lead Sources (A16)
INSERT INTO public.lead_sources (name, is_active) VALUES
    ('Referral', true),
    ('Existing customer', true),
    ('Walk-in', true),
    ('Website', true),
    ('Online marketplace', true),
    ('Social media', true),
    ('Cold call', true),
    ('Other', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Lost Reasons (Assumption A16)
CREATE TABLE IF NOT EXISTS public.lost_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Seed Default Lost Reasons (A16)
INSERT INTO public.lost_reasons (name, is_active) VALUES
    ('Price too high', true),
    ('Lost to competitor', true),
    ('Project postponed or cancelled', true),
    ('No response', true),
    ('Requirement mismatch', true),
    ('Other', true)
ON CONFLICT (name) DO NOTHING;

-- 4. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Add Foreign Key constraint from projects.customer_id -> customers.id if not present
DO $$ BEGIN
    ALTER TABLE public.projects
    ADD CONSTRAINT fk_projects_customer
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Enquiries Table (Rule S1)
CREATE TABLE IF NOT EXISTS public.enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    requirement TEXT,
    expected_value_excl_gst NUMERIC(14,2) DEFAULT 0,
    source_id UUID REFERENCES public.lead_sources(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status public.enquiry_status NOT NULL DEFAULT 'open',
    lost_reason_id UUID REFERENCES public.lost_reasons(id) ON DELETE SET NULL,
    lost_note TEXT,
    next_followup_date DATE,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT check_enquiry_lost_reason CHECK (status != 'lost' OR lost_reason_id IS NOT NULL)
);

-- 6. Enquiry Follow-ups Table (Rule S2, Assumption A14)
CREATE TABLE IF NOT EXISTS public.enquiry_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
    kind public.followup_kind NOT NULL,
    followup_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attendees TEXT,
    note TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. Quotations Table (Rule S3, S11, S12)
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL UNIQUE,
    version INT NOT NULL DEFAULT 1,
    amount_excl_gst NUMERIC(14,2) NOT NULL DEFAULT 0,
    validity_date DATE,
    status public.quotation_status NOT NULL DEFAULT 'draft',
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (enquiry_id, version)
);

-- Add Foreign Key constraint from documents.quotation_id -> quotations.id if not present
DO $$ BEGIN
    ALTER TABLE public.documents
    ADD CONSTRAINT fk_documents_quotation
    FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Block converting same quotation twice at database level (Rule S12)
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_quotation_id
ON public.projects (quotation_id)
WHERE quotation_id IS NOT NULL;

-- 8. Unique Quotation Number Generator Function (format WQ-YYYY-NNN)
CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_year TEXT := to_char(now(), 'YYYY');
    prefix TEXT := 'WQ-' || current_year || '-';
    max_num INT := 0;
    next_num TEXT;
BEGIN
    SELECT COALESCE(
        MAX(
            NULLIF(
                regexp_replace(quote_number, '^WQ-[0-9]{4}-([0-9]{3})(.*)$', '\1'),
                quote_number
            )::INT
        ),
        0
    )
    INTO max_num
    FROM public.quotations
    WHERE quote_number LIKE prefix || '%';

    next_num := prefix || lpad((max_num + 1)::TEXT, 3, '0');
    RETURN next_num;
END;
$$;

-- 9. Trigger for Rule S3 (Quotation sent updates enquiry to quoted) and S5 (Lost sets lost_at)
CREATE OR REPLACE FUNCTION public.handle_quotation_status_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Rule S3: Setting quotation to sent sets sent_at and moves enquiry to quoted if open
    IF NEW.status = 'sent' AND (OLD IS NULL OR OLD.status != 'sent') THEN
        IF NEW.sent_at IS NULL THEN
            NEW.sent_at := now();
        END IF;

        UPDATE public.enquiries
        SET status = 'quoted', updated_at = now()
        WHERE id = NEW.enquiry_id AND status = 'open';
    END IF;

    -- Setting quotation to accepted sets accepted_at
    IF NEW.status = 'accepted' AND (OLD IS NULL OR OLD.status != 'accepted') THEN
        IF NEW.accepted_at IS NULL THEN
            NEW.accepted_at := now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_lifecycle ON public.quotations;
CREATE TRIGGER trg_quotation_lifecycle
    BEFORE INSERT OR UPDATE ON public.quotations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_quotation_status_lifecycle();

CREATE OR REPLACE FUNCTION public.handle_enquiry_status_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Rule S5: Lost requires lost_reason_id and sets lost_at
    IF NEW.status = 'lost' AND (OLD IS NULL OR OLD.status != 'lost') THEN
        IF NEW.lost_reason_id IS NULL THEN
            RAISE EXCEPTION 'Rule S5: A lost reason is strictly required when marking an enquiry as lost';
        END IF;
        IF NEW.lost_at IS NULL THEN
            NEW.lost_at := now();
        END IF;
    END IF;

    -- Won sets won_at
    IF NEW.status = 'won' AND (OLD IS NULL OR OLD.status != 'won') THEN
        IF NEW.won_at IS NULL THEN
            NEW.won_at := now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enquiry_lifecycle ON public.enquiries;
CREATE TRIGGER trg_enquiry_lifecycle
    BEFORE INSERT OR UPDATE ON public.enquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_enquiry_status_lifecycle();

-- 10. Single-Transaction Conversion Function (Rule S12)
CREATE OR REPLACE FUNCTION public.convert_quotation_to_project(
    p_quotation_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_planned_completion_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_quote RECORD;
    v_enquiry RECORD;
    v_customer RECORD;
    v_stage_id UUID;
    v_project_code TEXT;
    v_new_project_id UUID;
    v_planned_completion DATE;
BEGIN
    -- 1. Check permissions (Director or Sales)
    IF NOT (public.is_director() OR public.has_role('sales')) THEN
        RAISE EXCEPTION 'Unauthorized: only Director or Sales can convert quotations to projects';
    END IF;

    -- 2. Fetch and lock quotation
    SELECT * INTO v_quote FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation % not found', p_quotation_id;
    END IF;

    -- Verify quotation status is accepted
    IF v_quote.status != 'accepted' THEN
        RAISE EXCEPTION 'Rule S12: Quotation % cannot be converted because status is %, must be accepted', p_quotation_id, v_quote.status;
    END IF;

    -- Block converting the same quotation twice
    IF EXISTS (SELECT 1 FROM public.projects WHERE quotation_id = p_quotation_id) THEN
        RAISE EXCEPTION 'Rule S12: Quotation % has already been converted to a project', p_quotation_id;
    END IF;

    -- 3. Fetch and lock associated enquiry
    SELECT * INTO v_enquiry FROM public.enquiries WHERE id = v_quote.enquiry_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated enquiry % not found', v_quote.enquiry_id;
    END IF;

    -- If sales user, verify ownership
    IF NOT public.is_director() THEN
        IF v_enquiry.assigned_to != auth.uid() AND v_enquiry.created_by != auth.uid() AND v_quote.created_by != auth.uid() THEN
            RAISE EXCEPTION 'Unauthorized: you can only convert your own assigned quotations';
        END IF;
    END IF;

    -- Fetch customer
    SELECT * INTO v_customer FROM public.customers WHERE id = v_enquiry.customer_id;

    -- Stage 2: Contract confirmation per Rule S12
    SELECT id INTO v_stage_id FROM public.project_stages WHERE position = 2;
    IF v_stage_id IS NULL THEN
        SELECT id INTO v_stage_id FROM public.project_stages ORDER BY position ASC LIMIT 1;
    END IF;

    -- Generate new unique project code
    v_project_code := public.generate_project_code();

    -- Planned completion date default 90 days from start date
    v_planned_completion := COALESCE(p_planned_completion_date, p_start_date + INTERVAL '90 days');

    -- 4. Create project
    INSERT INTO public.projects (
        code,
        name,
        customer_id,
        quotation_id,
        site_location,
        site_contact_name,
        site_contact_phone,
        current_stage_id,
        start_date,
        planned_completion_date,
        status,
        notes,
        created_by
    ) VALUES (
        v_project_code,
        v_enquiry.title,
        v_enquiry.customer_id,
        v_quote.id,
        COALESCE(v_customer.address, 'Site Location Pending'),
        v_customer.contact_person,
        v_customer.phone,
        v_stage_id,
        p_start_date,
        v_planned_completion,
        'active',
        'Converted from Quotation ' || v_quote.quote_number || ' (Enquiry: ' || v_enquiry.title || ')',
        auth.uid()
    )
    RETURNING id INTO v_new_project_id;

    -- 5. Create project_commercials with contract_value_excl_gst = quotation amount
    INSERT INTO public.project_commercials (
        project_id,
        contract_value_excl_gst,
        updated_by
    ) VALUES (
        v_new_project_id,
        v_quote.amount_excl_gst,
        auth.uid()
    )
    ON CONFLICT (project_id) DO UPDATE SET
        contract_value_excl_gst = EXCLUDED.contract_value_excl_gst,
        updated_by = EXCLUDED.updated_by;

    -- 6. Set enquiry status = won, won_at, project_id
    UPDATE public.enquiries
    SET
        status = 'won',
        won_at = COALESCE(won_at, now()),
        project_id = v_new_project_id,
        updated_at = now()
    WHERE id = v_enquiry.id;

    -- Ensure quotation accepted_at is populated
    IF v_quote.accepted_at IS NULL THEN
        UPDATE public.quotations
        SET accepted_at = now(), updated_at = now()
        WHERE id = v_quote.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'project_id', v_new_project_id,
        'project_code', v_project_code,
        'quotation_id', v_quote.id,
        'enquiry_id', v_enquiry.id
    );
END;
$$;

-- 11. Attach Generic Audit Trigger to All New Tables
CREATE TRIGGER audit_lead_sources_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lead_sources
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_lost_reasons_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lost_reasons
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_customers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_enquiries_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.enquiries
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_enquiry_followups_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.enquiry_followups
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_quotations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.quotations
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 12. Enable Row Level Security (RLS) on all Sales tables
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiry_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS POLICIES (Section 5 Matrix)
-- -----------------------------------------------------------------------------

-- 12.1 lead_sources & lost_reasons: Director has full RW; PM & Sales have read-only; others none
DROP POLICY IF EXISTS "lead_sources_select" ON public.lead_sources;
CREATE POLICY "lead_sources_select" ON public.lead_sources
FOR SELECT TO authenticated
USING (public.is_director() OR public.has_role('sales') OR public.has_role('project_manager'));

DROP POLICY IF EXISTS "lead_sources_director_manage" ON public.lead_sources;
CREATE POLICY "lead_sources_director_manage" ON public.lead_sources
FOR ALL TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "lost_reasons_select" ON public.lost_reasons;
CREATE POLICY "lost_reasons_select" ON public.lost_reasons
FOR SELECT TO authenticated
USING (public.is_director() OR public.has_role('sales') OR public.has_role('project_manager'));

DROP POLICY IF EXISTS "lost_reasons_director_manage" ON public.lost_reasons;
CREATE POLICY "lost_reasons_director_manage" ON public.lost_reasons
FOR ALL TO authenticated
USING (public.is_director())
WITH CHECK (public.is_director());

-- 12.2 customers: Director has full RW; Sales has RW own; PM has R if linked to assigned project; others none
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers
FOR SELECT TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND (
        created_by = auth.uid()
        OR id IN (SELECT customer_id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
    OR (public.has_role('project_manager') AND (
        id IN (SELECT customer_id FROM public.projects WHERE id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()))
    ))
);

DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
    public.is_director()
    OR public.has_role('sales')
);

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers
FOR UPDATE TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND (
        created_by = auth.uid()
        OR id IN (SELECT customer_id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
)
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND (
        created_by = auth.uid()
        OR id IN (SELECT customer_id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
);

DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_delete" ON public.customers
FOR DELETE TO authenticated
USING (public.is_director());

-- 12.3 enquiries: Director has full RW; Sales has RW own; PM has R if linked to assigned project; others none
DROP POLICY IF EXISTS "enquiries_select" ON public.enquiries;
CREATE POLICY "enquiries_select" ON public.enquiries
FOR SELECT TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
    ))
    OR (public.has_role('project_manager') AND (
        project_id IS NOT NULL AND project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
    ))
);

DROP POLICY IF EXISTS "enquiries_insert" ON public.enquiries;
CREATE POLICY "enquiries_insert" ON public.enquiries
FOR INSERT TO authenticated
WITH CHECK (
    public.is_director()
    OR public.has_role('sales')
);

DROP POLICY IF EXISTS "enquiries_update" ON public.enquiries;
CREATE POLICY "enquiries_update" ON public.enquiries
FOR UPDATE TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
    ))
)
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
    ))
);

DROP POLICY IF EXISTS "enquiries_delete" ON public.enquiries;
CREATE POLICY "enquiries_delete" ON public.enquiries
FOR DELETE TO authenticated
USING (public.is_director());

-- 12.4 enquiry_followups: Director has full RW; Sales has RW own; PM has R if linked to assigned project; others none
DROP POLICY IF EXISTS "followups_select" ON public.enquiry_followups;
CREATE POLICY "followups_select" ON public.enquiry_followups
FOR SELECT TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND (
        created_by = auth.uid()
        OR enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
    OR (public.has_role('project_manager') AND (
        enquiry_id IN (
            SELECT id FROM public.enquiries WHERE project_id IS NOT NULL AND project_id IN (
                SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
            )
        )
    ))
);

DROP POLICY IF EXISTS "followups_insert" ON public.enquiry_followups;
CREATE POLICY "followups_insert" ON public.enquiry_followups
FOR INSERT TO authenticated
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND (
        enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
);

DROP POLICY IF EXISTS "followups_update" ON public.enquiry_followups;
CREATE POLICY "followups_update" ON public.enquiry_followups
FOR UPDATE TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND created_by = auth.uid())
)
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "followups_delete" ON public.enquiry_followups;
CREATE POLICY "followups_delete" ON public.enquiry_followups
FOR DELETE TO authenticated
USING (public.is_director());

-- 12.5 quotations: Director has full RW; Sales has RW own; PM has R if linked to assigned project; others none
DROP POLICY IF EXISTS "quotations_select" ON public.quotations;
CREATE POLICY "quotations_select" ON public.quotations
FOR SELECT TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND (
        created_by = auth.uid()
        OR enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
    OR (public.has_role('project_manager') AND (
        enquiry_id IN (
            SELECT id FROM public.enquiries WHERE project_id IS NOT NULL AND project_id IN (
                SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
            )
        )
    ))
);

DROP POLICY IF EXISTS "quotations_insert" ON public.quotations;
CREATE POLICY "quotations_insert" ON public.quotations
FOR INSERT TO authenticated
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND (
        enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
);

DROP POLICY IF EXISTS "quotations_update" ON public.quotations;
CREATE POLICY "quotations_update" ON public.quotations
FOR UPDATE TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND (
        created_by = auth.uid()
        OR enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
)
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND (
        created_by = auth.uid()
        OR enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
);

DROP POLICY IF EXISTS "quotations_delete" ON public.quotations;
CREATE POLICY "quotations_delete" ON public.quotations
FOR DELETE TO authenticated
USING (public.is_director());

-- 12.6 documents: Enable sales to read and upload quotation category documents
DROP POLICY IF EXISTS "documents_sales_quotations_select" ON public.documents;
CREATE POLICY "documents_sales_quotations_select" ON public.documents
FOR SELECT TO authenticated
USING (
    category = 'quotation' AND (
        public.is_director()
        OR (public.has_role('sales') AND (
            uploaded_by = auth.uid()
            OR quotation_id IN (
                SELECT id FROM public.quotations
                WHERE created_by = auth.uid()
                   OR enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
            )
        ))
    )
);

DROP POLICY IF EXISTS "documents_sales_quotations_insert" ON public.documents;
CREATE POLICY "documents_sales_quotations_insert" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
    category = 'quotation' AND (
        public.is_director()
        OR public.has_role('sales')
    )
);
