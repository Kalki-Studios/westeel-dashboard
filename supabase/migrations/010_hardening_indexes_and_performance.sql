-- ==============================================================================
-- Migration 010: Task T15 Hardening - Foreign Key & Filter Column Indexes
-- Ensures all relational foreign keys and high-frequency filter columns across
-- Priorities 1, 2, and 3 have high-performance B-tree indexes.
-- ==============================================================================

-- 1. Projects & Members
CREATE INDEX IF NOT EXISTS idx_projects_current_stage ON public.projects(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_quotation_id ON public.projects(quotation_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON public.projects(is_archived);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON public.projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_planned_comp ON public.projects(planned_completion_date);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

-- 2. Project Milestones
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_stage ON public.project_milestones(stage_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON public.project_milestones(status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_planned ON public.project_milestones(planned_date);

-- 3. Tasks & Issues
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_kind ON public.tasks(kind);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author ON public.task_comments(author_id);

-- 4. Site Reports
CREATE INDEX IF NOT EXISTS idx_site_reports_project ON public.site_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_site_reports_submitter ON public.site_reports(submitted_by);
CREATE INDEX IF NOT EXISTS idx_site_reports_date ON public.site_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_site_reports_status ON public.site_reports(status);
CREATE INDEX IF NOT EXISTS idx_site_reports_reviewer ON public.site_reports(reviewed_by);

-- 5. Documents & Drawings
CREATE INDEX IF NOT EXISTS idx_documents_project ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_review_status ON public.documents(review_status);
CREATE INDEX IF NOT EXISTS idx_documents_supersedes ON public.documents(supersedes_id);
CREATE INDEX IF NOT EXISTS idx_documents_quotation ON public.documents(quotation_id);
CREATE INDEX IF NOT EXISTS idx_documents_site_report ON public.documents(site_report_id);
CREATE INDEX IF NOT EXISTS idx_documents_invoice ON public.documents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_documents_bill ON public.documents(bill_id);
CREATE INDEX IF NOT EXISTS idx_documents_vendor_order ON public.documents(vendor_order_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploader ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_is_archived ON public.documents(is_archived);

-- 6. Customers & Sales Pipeline
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_archived ON public.customers(is_archived);

CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON public.enquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_assigned_to ON public.enquiries(assigned_to);
CREATE INDEX IF NOT EXISTS idx_enquiries_source ON public.enquiries(source_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_lost_reason ON public.enquiries(lost_reason_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_project ON public.enquiries(project_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON public.enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_next_followup ON public.enquiries(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON public.enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_won_at ON public.enquiries(won_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_lost_at ON public.enquiries(lost_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_archived ON public.enquiries(is_archived);

CREATE INDEX IF NOT EXISTS idx_enquiry_followups_enquiry ON public.enquiry_followups(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_followups_date ON public.enquiry_followups(followup_date);
CREATE INDEX IF NOT EXISTS idx_enquiry_followups_kind ON public.enquiry_followups(kind);
CREATE INDEX IF NOT EXISTS idx_enquiry_followups_creator ON public.enquiry_followups(created_by);

CREATE INDEX IF NOT EXISTS idx_quotations_enquiry ON public.quotations(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_validity ON public.quotations(validity_date);
CREATE INDEX IF NOT EXISTS idx_quotations_sent_at ON public.quotations(sent_at);
CREATE INDEX IF NOT EXISTS idx_quotations_accepted_at ON public.quotations(accepted_at);

-- 7. Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);
