-- Sales split: sales_lead adds leads and books meetings, sales_field visits and closes.
-- Both users also keep the umbrella 'sales' role, so every existing sales policy still applies.

ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ;

-- Field salespeople cannot create leads.
DROP POLICY IF EXISTS "enquiries_insert" ON public.enquiries;
CREATE POLICY "enquiries_insert" ON public.enquiries
FOR INSERT TO authenticated
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND NOT public.has_role('sales_field'))
);

-- Lead generators cannot create or change quotations.
DROP POLICY IF EXISTS "quotations_insert" ON public.quotations;
CREATE POLICY "quotations_insert" ON public.quotations
FOR INSERT TO authenticated
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND NOT public.has_role('sales_lead') AND (
        enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
);

DROP POLICY IF EXISTS "quotations_update" ON public.quotations;
CREATE POLICY "quotations_update" ON public.quotations
FOR UPDATE TO authenticated
USING (
    public.is_director()
    OR (public.has_role('sales') AND NOT public.has_role('sales_lead') AND (
        created_by = auth.uid()
        OR enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
)
WITH CHECK (
    public.is_director()
    OR (public.has_role('sales') AND NOT public.has_role('sales_lead') AND (
        created_by = auth.uid()
        OR enquiry_id IN (SELECT id FROM public.enquiries WHERE assigned_to = auth.uid() OR created_by = auth.uid())
    ))
);

-- Lead generators cannot change an enquiry's outcome (quoted / won / lost).
CREATE OR REPLACE FUNCTION public.enquiries_guard_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND public.has_role('sales_lead')
       AND NOT public.is_director() THEN
        RAISE EXCEPTION 'Lead generation staff cannot change enquiry status';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enquiries_guard_status ON public.enquiries;
CREATE TRIGGER enquiries_guard_status
BEFORE UPDATE ON public.enquiries
FOR EACH ROW EXECUTE FUNCTION public.enquiries_guard_status();
