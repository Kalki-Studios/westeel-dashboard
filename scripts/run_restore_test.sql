-- ==============================================================================
-- WESTEEL BUILDINGS - TASK T15 COMPLETE RESTORE TEST (ALL 30 TABLES)
-- ==============================================================================

-- 1. Initialize clean restore_test isolated schema
DROP SCHEMA IF EXISTS restore_test CASCADE;
CREATE SCHEMA restore_test;

-- 2. Create identical table structures using INCLUDING ALL
CREATE TABLE restore_test.project_stages (LIKE public.project_stages INCLUDING ALL);
CREATE TABLE restore_test.cost_categories (LIKE public.cost_categories INCLUDING ALL);
CREATE TABLE restore_test.lead_sources (LIKE public.lead_sources INCLUDING ALL);
CREATE TABLE restore_test.lost_reasons (LIKE public.lost_reasons INCLUDING ALL);
CREATE TABLE restore_test.app_settings (LIKE public.app_settings INCLUDING ALL);
CREATE TABLE restore_test.profiles (LIKE public.profiles INCLUDING ALL);
CREATE TABLE restore_test.user_roles (LIKE public.user_roles INCLUDING ALL);
CREATE TABLE restore_test.customers (LIKE public.customers INCLUDING ALL);
CREATE TABLE restore_test.projects (LIKE public.projects INCLUDING ALL);
CREATE TABLE restore_test.project_members (LIKE public.project_members INCLUDING ALL);
CREATE TABLE restore_test.project_milestones (LIKE public.project_milestones INCLUDING ALL);
CREATE TABLE restore_test.project_commercials (LIKE public.project_commercials INCLUDING ALL);
CREATE TABLE restore_test.variation_orders (LIKE public.variation_orders INCLUDING ALL);
CREATE TABLE restore_test.payment_milestones (LIKE public.payment_milestones INCLUDING ALL);
CREATE TABLE restore_test.invoices (LIKE public.invoices INCLUDING ALL);
CREATE TABLE restore_test.receipts (LIKE public.receipts INCLUDING ALL);
CREATE TABLE restore_test.budget_lines (LIKE public.budget_lines INCLUDING ALL);
CREATE TABLE restore_test.vendor_orders (LIKE public.vendor_orders INCLUDING ALL);
CREATE TABLE restore_test.bills (LIKE public.bills INCLUDING ALL);
CREATE TABLE restore_test.bill_payments (LIKE public.bill_payments INCLUDING ALL);
CREATE TABLE restore_test.bank_balances (LIKE public.bank_balances INCLUDING ALL);
CREATE TABLE restore_test.company_cash_items (LIKE public.company_cash_items INCLUDING ALL);
CREATE TABLE restore_test.tasks (LIKE public.tasks INCLUDING ALL);
CREATE TABLE restore_test.task_comments (LIKE public.task_comments INCLUDING ALL);
CREATE TABLE restore_test.site_reports (LIKE public.site_reports INCLUDING ALL);
CREATE TABLE restore_test.documents (LIKE public.documents INCLUDING ALL);
CREATE TABLE restore_test.enquiries (LIKE public.enquiries INCLUDING ALL);
CREATE TABLE restore_test.enquiry_followups (LIKE public.enquiry_followups INCLUDING ALL);
CREATE TABLE restore_test.quotations (LIKE public.quotations INCLUDING ALL);
CREATE TABLE restore_test.audit_log (LIKE public.audit_log INCLUDING ALL);

-- 3. Restore data into restore_test (in strict foreign-key dependency order)
INSERT INTO restore_test.project_stages SELECT * FROM public.project_stages;
INSERT INTO restore_test.cost_categories SELECT * FROM public.cost_categories;
INSERT INTO restore_test.lead_sources SELECT * FROM public.lead_sources;
INSERT INTO restore_test.lost_reasons SELECT * FROM public.lost_reasons;
INSERT INTO restore_test.app_settings SELECT * FROM public.app_settings;
INSERT INTO restore_test.profiles SELECT * FROM public.profiles;
INSERT INTO restore_test.user_roles SELECT * FROM public.user_roles;
INSERT INTO restore_test.customers SELECT * FROM public.customers;
INSERT INTO restore_test.projects SELECT * FROM public.projects;
INSERT INTO restore_test.project_members SELECT * FROM public.project_members;
INSERT INTO restore_test.project_milestones SELECT * FROM public.project_milestones;
INSERT INTO restore_test.project_commercials SELECT * FROM public.project_commercials;
INSERT INTO restore_test.variation_orders SELECT * FROM public.variation_orders;
INSERT INTO restore_test.payment_milestones SELECT * FROM public.payment_milestones;
INSERT INTO restore_test.invoices SELECT * FROM public.invoices;
INSERT INTO restore_test.receipts SELECT * FROM public.receipts;
INSERT INTO restore_test.budget_lines SELECT * FROM public.budget_lines;
INSERT INTO restore_test.vendor_orders SELECT * FROM public.vendor_orders;
INSERT INTO restore_test.bills SELECT * FROM public.bills;
INSERT INTO restore_test.bill_payments SELECT * FROM public.bill_payments;
INSERT INTO restore_test.bank_balances SELECT * FROM public.bank_balances;
INSERT INTO restore_test.company_cash_items SELECT * FROM public.company_cash_items;
INSERT INTO restore_test.tasks SELECT * FROM public.tasks;
INSERT INTO restore_test.task_comments SELECT * FROM public.task_comments;
INSERT INTO restore_test.site_reports SELECT * FROM public.site_reports;
INSERT INTO restore_test.documents SELECT * FROM public.documents;
INSERT INTO restore_test.enquiries SELECT * FROM public.enquiries;
INSERT INTO restore_test.enquiry_followups SELECT * FROM public.enquiry_followups;
INSERT INTO restore_test.quotations SELECT * FROM public.quotations;
INSERT INTO restore_test.audit_log SELECT * FROM public.audit_log;

-- 4. Compare Row Counts Per Table Between Original (public) and Restored (restore_test)
SELECT 
  p.table_name,
  p.public_rows,
  r.restored_rows,
  CASE 
    WHEN p.public_rows = r.restored_rows THEN 'EXACT_MATCH'
    ELSE 'MISMATCH'
  END AS verification_status
FROM (
  SELECT 'project_stages' AS table_name, count(*) AS public_rows FROM public.project_stages
  UNION ALL SELECT 'cost_categories', count(*) FROM public.cost_categories
  UNION ALL SELECT 'lead_sources', count(*) FROM public.lead_sources
  UNION ALL SELECT 'lost_reasons', count(*) FROM public.lost_reasons
  UNION ALL SELECT 'app_settings', count(*) FROM public.app_settings
  UNION ALL SELECT 'profiles', count(*) FROM public.profiles
  UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
  UNION ALL SELECT 'customers', count(*) FROM public.customers
  UNION ALL SELECT 'projects', count(*) FROM public.projects
  UNION ALL SELECT 'project_members', count(*) FROM public.project_members
  UNION ALL SELECT 'project_milestones', count(*) FROM public.project_milestones
  UNION ALL SELECT 'project_commercials', count(*) FROM public.project_commercials
  UNION ALL SELECT 'variation_orders', count(*) FROM public.variation_orders
  UNION ALL SELECT 'payment_milestones', count(*) FROM public.payment_milestones
  UNION ALL SELECT 'invoices', count(*) FROM public.invoices
  UNION ALL SELECT 'receipts', count(*) FROM public.receipts
  UNION ALL SELECT 'budget_lines', count(*) FROM public.budget_lines
  UNION ALL SELECT 'vendor_orders', count(*) FROM public.vendor_orders
  UNION ALL SELECT 'bills', count(*) FROM public.bills
  UNION ALL SELECT 'bill_payments', count(*) FROM public.bill_payments
  UNION ALL SELECT 'bank_balances', count(*) FROM public.bank_balances
  UNION ALL SELECT 'company_cash_items', count(*) FROM public.company_cash_items
  UNION ALL SELECT 'tasks', count(*) FROM public.tasks
  UNION ALL SELECT 'task_comments', count(*) FROM public.task_comments
  UNION ALL SELECT 'site_reports', count(*) FROM public.site_reports
  UNION ALL SELECT 'documents', count(*) FROM public.documents
  UNION ALL SELECT 'enquiries', count(*) FROM public.enquiries
  UNION ALL SELECT 'enquiry_followups', count(*) FROM public.enquiry_followups
  UNION ALL SELECT 'quotations', count(*) FROM public.quotations
  UNION ALL SELECT 'audit_log', count(*) FROM public.audit_log
) p
JOIN (
  SELECT 'project_stages' AS table_name, count(*) AS restored_rows FROM restore_test.project_stages
  UNION ALL SELECT 'cost_categories', count(*) FROM restore_test.cost_categories
  UNION ALL SELECT 'lead_sources', count(*) FROM restore_test.lead_sources
  UNION ALL SELECT 'lost_reasons', count(*) FROM restore_test.lost_reasons
  UNION ALL SELECT 'app_settings', count(*) FROM restore_test.app_settings
  UNION ALL SELECT 'profiles', count(*) FROM restore_test.profiles
  UNION ALL SELECT 'user_roles', count(*) FROM restore_test.user_roles
  UNION ALL SELECT 'customers', count(*) FROM restore_test.customers
  UNION ALL SELECT 'projects', count(*) FROM restore_test.projects
  UNION ALL SELECT 'project_members', count(*) FROM restore_test.project_members
  UNION ALL SELECT 'project_milestones', count(*) FROM restore_test.project_milestones
  UNION ALL SELECT 'project_commercials', count(*) FROM restore_test.project_commercials
  UNION ALL SELECT 'variation_orders', count(*) FROM restore_test.variation_orders
  UNION ALL SELECT 'payment_milestones', count(*) FROM restore_test.payment_milestones
  UNION ALL SELECT 'invoices', count(*) FROM restore_test.invoices
  UNION ALL SELECT 'receipts', count(*) FROM restore_test.receipts
  UNION ALL SELECT 'budget_lines', count(*) FROM restore_test.budget_lines
  UNION ALL SELECT 'vendor_orders', count(*) FROM restore_test.vendor_orders
  UNION ALL SELECT 'bills', count(*) FROM restore_test.bills
  UNION ALL SELECT 'bill_payments', count(*) FROM restore_test.bill_payments
  UNION ALL SELECT 'bank_balances', count(*) FROM restore_test.bank_balances
  UNION ALL SELECT 'company_cash_items', count(*) FROM restore_test.company_cash_items
  UNION ALL SELECT 'tasks', count(*) FROM restore_test.tasks
  UNION ALL SELECT 'task_comments', count(*) FROM restore_test.task_comments
  UNION ALL SELECT 'site_reports', count(*) FROM restore_test.site_reports
  UNION ALL SELECT 'documents', count(*) FROM restore_test.documents
  UNION ALL SELECT 'enquiries', count(*) FROM restore_test.enquiries
  UNION ALL SELECT 'enquiry_followups', count(*) FROM restore_test.enquiry_followups
  UNION ALL SELECT 'quotations', count(*) FROM restore_test.quotations
  UNION ALL SELECT 'audit_log', count(*) FROM restore_test.audit_log
) r ON p.table_name = r.table_name
ORDER BY p.table_name;
