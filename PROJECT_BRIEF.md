# Westeel Buildings: V1 Internal Dashboard
## Project Brief and Agent Instructions (Revision 2: finance and sales tracker promoted into V1)

This file is the single source of truth for the build. It is addressed to the AI coding agent (Antigravity). Section 0 is for the human (Kalki) only.

## PRIORITY ORDER (drives build order AND dashboard layout)

1. **Project status and delays**: know where every project stands and what is late.
2. **Cash flow, collections and project costs**: know what is owed to us, what we owe, what each project really costs, and what cash is coming and going.
3. **Sales tracker**: how many leads, how many meetings, how many quotations, how many converted, how many projects finalised.

The director Overview must show these three blocks in this order. The build order follows the same order.

---

## 0. FOR KALKI (human): how to use this file

1. Create a Git repo. Put this file in the repo root as `PROJECT_BRIEF.md`.
2. Open the repo in Antigravity. If it has a rules / persistent-instructions feature, also paste **Section 1** there so it survives long sessions.
3. Do the **human prerequisites** below before Task T1.
4. Send this as your very first message:

> Read PROJECT_BRIEF.md completely. Do not write any code yet. Follow Section 1 rules strictly. Execute only Task T0, then stop and report in the Section 9 format.

5. After every task, test it yourself using the "Kalki verifies" steps. Only when it works, send exactly: `APPROVED T<n>` (example: `APPROVED T0`). The agent must not start the next task without that exact phrase.
6. There are three **usage gates** (G1 after T9, G2 after T12, G3 after T14). At a gate you and the director use the system on a real project before the next block starts. Send `GATE G<n> PASSED` only when real people are really using it. Do not skip gates: a finance module nobody feeds with data is worse than none.
7. If the agent claims something works without evidence, reply: `Show the command and real output for each claim, or mark it UNVERIFIED.`
8. If the agent drifts, reply: `Stop. Re-read PROJECT_BRIEF.md Section 1 and the current task. Report only on the current task.`
9. Never paste secret keys (Supabase service-role key, passwords) into chat. Put them only in `.env.local`.

**Human prerequisites**
- GitHub account and an empty repo.
- Supabase account. Create `westeel-dev` now. `westeel-prod` is created at T9.
- Vercel account (needed at T9).
- Node.js LTS and Git installed.
- Confirm answers to open decisions D1 to D8 (Section 3) with the director. Safe defaults exist if he cannot answer yet.
- Ask the accountant for: one real project's invoices, receipts and supplier bills (or a Tally export). You will need real numbers at G2.

---

## 1. AGENT OPERATING RULES (non-negotiable)

### 1.1 Serial execution
- Work on exactly ONE task from Section 10 at a time, in order. Never start, prepare, or partially build the next task.
- At the start of every task: re-read Sections 1, 4, 5, 6, 7 of this file, the current task, and `PROGRESS.md`. State in at most 3 lines what you are about to do.
- At the end of every task: run the checks, update `PROGRESS.md`, give the Section 9 report, then STOP.
- Do not begin task T<n+1> until Kalki sends exactly `APPROVED T<n>`. At gates, also wait for exactly `GATE G<n> PASSED`. Any other message is not approval.
- If a task is too big for one pass, split it into T<n>a, T<n>b, tell Kalki, and do one part at a time. Never silently skip a part.

### 1.2 No hallucination
- Never claim something works unless you ran it in this task and can show the command and its real output. Otherwise write `UNVERIFIED`.
- Never invent: library APIs, function or option names, CLI flags, environment variables, framework features, file paths, table names, column names, or enum values.
- Before using any library API you are not 100% sure about, read the installed package's type definitions or README in `node_modules`, or the official docs for the installed version. State the version you checked. If you cannot verify, say so and propose the simplest alternative.
- Only use tables, columns and enums defined in Section 6 or in migration files you created in this repo. If something is missing, propose a migration. Do not assume it exists.
- If you cannot execute something (no database access, no network, no Docker), say exactly that, give Kalki the exact manual steps, and mark the result `UNVERIFIED`. Never simulate or imagine command output.
- Never put fake numbers, sample projects or placeholder statistics in the UI. Show an honest empty state ("No projects yet") or an incomplete state ("Budget missing: profit not calculated"). Development seed data may exist only in `supabase/seed.dev.sql`, must be clearly labelled fictional, must never be run on production, and must never be imported by app code.
- Do not state business rules or accounting rules that are not in this file. If a rule is unclear, ask (see 1.5).
- Record every non-trivial decision in `DECISIONS.md` (date, decision, reason).

### 1.3 Scope control
- Build only what the current task lists. Everything in Section 2.3 (Deferred) is forbidden, even if it looks easy.
- No new dependencies beyond Section 4 without Kalki's written approval. Ask first, with the reason, size, and the no-dependency alternative.
- Do not modify files outside the current task's scope. If unavoidable, say why.
- No non-functional buttons, fake forms, or "coming soon" pages. If a feature is not in the current task, there is no UI for it.
- Do not refactor or "improve" code from approved tasks unless you can demonstrate a bug. Then fix minimally and report it.

### 1.4 Security and money-handling rules
- Authorization is enforced in the database (Postgres Row Level Security) AND in server code. Hiding a button in the UI is not security.
- The Supabase service-role key must never reach the browser or the Git repo. Use it only in server-only code, and only where needed (creating employee accounts).
- Secrets live only in `.env.local` (gitignored). `.env.example` lists variable names only, with no values.
- Documents live in a private storage bucket. Downloads use short-lived signed URLs generated server-side after a permission check.
- Validate every input on the server with Zod. Never trust a user id or role sent by the client. Derive identity from the session.
- No hard deletes of business records. Use `is_archived`, `is_cancelled` or a status. `audit_log` is append-only.
- **Never use floating-point arithmetic on rupee amounts.** Convert amounts to integer paise for all calculations in TypeScript, and convert back only for display. Database columns are `numeric(14,2)`.
- CSV exports must run with the logged-in user's own permissions (server-side, same RLS), never with the service-role key.

### 1.5 When unsure
Stop. Ask at most 3 questions, each with your recommended default. Wait for the answer. Do not guess and continue.

### 1.6 A task FAILS review if any of these happen
Claims without evidence. Fake data in the UI. Scope creep. Secret exposure. RLS not tested with real test users. Typecheck, lint or build not run. Float arithmetic on money. A calculated profit or margin shown when its inputs are missing. Next task started without approval.

---

## 2. PRODUCT CONTEXT AND V1 SCOPE

### 2.1 Confirmed business facts
- Company: Westeel Buildings, a small Pre-Engineered Building (PEB) construction company, Bhubaneswar, Odisha, India.
- About 11 to 12 employees. Usually 1 to 3 active projects at a time.
- Fabrication is outsourced. Westeel does material supply, project coordination and site erection. Do not assume a factory.
- Today the company runs on Excel, WhatsApp, phone calls and manual records. Replacement must be gradual.
- One application, two entry points: `/admin` (director) and `/employee` (everyone else). Same backend and database. Two experiences, not two apps.
- One employee may hold several roles. External vendors, subcontractors and customers do not get accounts.
- This system gives **management visibility**. It is not the books of account. The accountant keeps statutory accounting and GST filing in the existing accounting software. This system records the operational and cash facts the director needs, and exports them for reconciliation.

### 2.2 V1 includes (grouped by priority)

**Priority 1: Project status and delays**
1. Authentication, roles, project-level access, audit history.
2. Projects with 9 fixed stages, members, milestones with planned dates, delay reasons.
3. Tasks and issues with blockers and overdue detection.
4. Daily site reports from a phone, with photos and a review workflow.
5. Document repository (private) with drawing approval status and revision history.
6. Director Overview (status and delays block) with real alerts, and employee "My work".

**Priority 2: Cash flow, collections and project costs**
7. Contract value, approved variations, payment milestones (billing schedule), invoices, receipts (including advances and TDS), receivables with aging.
8. Cost categories, project budgets, vendor orders (commitments) with delivery tracking, supplier and subcontractor bills, bill payments, payables.
9. Project cost vs budget, forecast cost, forecast profit and margin (with completeness checks).
10. Cash on hand (manual bank balance entries), non-project cash items (salary total, rent, EMI and similar), and a cash projection.

**Priority 3: Sales tracker**
11. Customers, lead sources, enquiries, follow-ups and meetings, quotation register with versions, conversion of an accepted quotation into a project.
12. Sales tracker dashboard: leads, meetings, quotations sent, conversions, projects finalised, lost reasons, by period, salesperson and source.

**Always**
13. Production deployment, backups with a tested restore, hardening, real-data trial.

### 2.3 DEFERRED: do not build in V1
Purchase requisitions and purchase orders as formal documents, purchase approval workflows, vendor directory (vendor is a free-text name in V1), material request forms, quotation builder or PEB calculator, quotation approval threshold, GST returns, e-invoicing, e-way bill, TDS calculation or returns, payroll, attendance, leave, HR features, inventory and stock, wastage tracking, bank integration or statement import, accounting software integration, CSV or Excel IMPORT, vendor or customer portals, in-app chat, notification bell, WhatsApp API, AI features, offline mode, installable PWA, multi-language UI, report builder, charts other than simple bars and counts.

CSV EXPORT is allowed where a task says so.

---

## 3. ASSUMPTIONS AND OPEN DECISIONS

Use these defaults unless Kalki changes them. Record any change in `DECISIONS.md`.

| ID | Assumption (default) |
|---|---|
| A1 | Working week is Monday to Saturday. Sunday does not require a site report. |
| A2 | All date logic and display use Asia/Kolkata (IST). Store timestamps as `timestamptz`. |
| A3 | Currency is INR. Display with `en-IN` formatting. Store as `numeric(14,2)`. |
| A4 | UI language is English only. |
| A5 | Project code format is `WB-YYYY-NNN` (example `WB-2026-001`), generated by the database, unique. |
| A6 | Financial year is April to March (Indian FY). Period filters include "This FY" and "Last FY". |
| A7 | Six roles exist: director, project_manager, sales, purchase, site_engineer, accounts. A user may have several. |
| A8 | Hosting is Supabase (database, auth, storage) and Vercel. |
| A9 | The 9 project stages are fixed and seeded (Section 6). Editing stages is deferred. |
| A10 | No import of old data. Real records are entered manually. |
| A11 | **Amount convention:** budgets, contract value, variations, vendor orders, cost, profit and margin are **excluding GST**. Invoices, bills, receipts, payments and bank balances are **cash figures including GST**. GST is stored as a separate amount per invoice and bill. The system does no GST return logic. |
| A12 | TDS is **recorded, not computed**. A receipt can carry a `tds_amount` that the customer deducted. A bill payment can carry a `tds_amount` that Westeel deducted. Both count towards settling the invoice or bill. |
| A13 | Default cost categories (editable by the director in Settings): Steel and raw material; Sheeting and cladding; Outsourced fabrication; Bolts and accessories; Transport and logistics; Erection labour and subcontract; Crane and equipment; Civil and foundation; Site expenses; Design and engineering; Other. |
| A14 | "Meeting" means a follow-up of kind `meeting` or `site_visit` logged by sales. "Meetings attended" is counted per salesperson. |
| A15 | Cash on hand comes only from manual bank balance entries. It is never "live". |
| A16 | Default lead sources: Referral, Existing customer, Walk-in, Website, Online marketplace, Social media, Cold call, Other. Default lost reasons: Price too high, Lost to competitor, Project postponed or cancelled, No response, Requirement mismatch, Other. Both editable by the director. |

**Open decisions to confirm with the director (T0 must list them back to Kalki):**
- D1: Names and role mapping of the actual 11 to 12 employees.
- D2: Name of the accounting software, and who will enter invoices, receipts, bills and payments here (default: the accounts employee).
- D3: Do site engineers have smartphones and mobile data at site?
- D4: Supabase plan for production. Free-plan backup and inactivity-pausing rules must be verified at T9 from official documentation. Do not assume.
- D5: Confirm A11 (ex-GST for cost and margin, incl. GST for cash) and A12 (TDS recorded only).
- D6: Confirm or edit the cost category list (A13).
- D7: Confirm that "meetings attended" means customer meetings and site visits logged by sales (A14). If he means something else, stop and ask.
- D8: Does any customer contract hold retention money? Default: model it as a normal payment milestone labelled "Retention release".

---

## 4. TECH STACK AND CONVENTIONS

**Stack (nothing else without approval)**
- Next.js (current stable at install time), App Router, TypeScript with `strict: true`.
- Tailwind CSS and shadcn/ui (Lucide icons come with it).
- Supabase: Postgres, Auth, Storage, Row Level Security. Packages: `@supabase/supabase-js`, `@supabase/ssr`.
- Zod for validation. `react-hook-form` with `@hookform/resolvers` for forms.
- `date-fns` for dates (add `date-fns-tz` only if verified necessary).
- Vitest for unit tests of pure business-rule functions.
- Hosting: Vercel. Code: GitHub.

**Folder layout**
```
/app/(auth)/login
/app/admin/...
/app/employee/...
/lib/supabase/server.ts   /lib/supabase/client.ts
/lib/auth/
/lib/rules/               (pure, unit-tested: delays, alerts, finance, cash, sales)
/lib/money.ts             (rupees <-> integer paise, formatting en-IN)
/supabase/migrations/NNN_description.sql
/supabase/tests/          (RLS tests)
/supabase/seed.dev.sql    (DEV ONLY, fictional)
PROJECT_BRIEF.md  PROGRESS.md  DECISIONS.md  RELEASE.md  .env.example
```

**Conventions**
- Database changes only through numbered SQL migration files. Never edit an applied migration; add a new one.
- Every table: `id uuid primary key default gen_random_uuid()`, `created_at`, `updated_at` (timestamptz). Add `created_by` where the creator matters.
- All calculations that drive alerts, delays, collections, costs, forecasts, cash and sales metrics live in `/lib/rules` as pure functions with unit tests using worked examples. Fetch rows with the user's session, then compute.
- UI: restrained, professional, industrial feel. Desktop-first for `/admin`, mobile-first for site engineer and sales quick-log screens. Clear status badges (overdue, pending, blocked, done, incomplete). Searchable and filterable tables via URL query params. Confirmation dialog for destructive or high-impact actions. Clear validation and error messages. No decorative animation, 3D, or analytics-template look.
- Every list needs a real empty state. Every submit needs visible success or error feedback.
- Any number that depends on missing data shows an **Incomplete** badge with the reason, never a guessed value.
- Image uploads from phones must be compressed client-side (max 1600px longest side) before upload.
- The site report form saves a draft in the browser (localStorage) so poor network does not lose a half-filled report. Uploads show progress and allow retry.
- Sales **quick-log** actions (log call, log meeting, log site visit) must take under 10 seconds on a phone: pick enquiry, pick type, optional note, save.

---

## 5. ROLES AND PERMISSIONS

Permissions of a user with multiple roles are the union of those roles. R = read, W = create/update, "own" = records they created or are assigned, "assigned" = projects where they are in `project_members`.

| Area | director | project_manager | sales | purchase | site_engineer | accounts |
|---|---|---|---|---|---|---|
| Users, roles, settings, audit log | RW | none | none | none | none | none |
| Projects (non-financial fields) | RW all | RW assigned | R assigned | R all active (name, code, site) | R assigned | R all |
| Milestones | RW | RW assigned | R assigned | none | R assigned | none |
| Tasks and issues | RW all | RW in assigned projects | own: update status, comment | own: update status, comment | own: update status, comment, raise issue | own: update status, comment |
| Site reports | R all, review | R assigned, review | none | none | create/edit own until reviewed; R own | none |
| Documents, general categories | RW all | RW assigned | RW linked to own quotations | R/W purchase_order and delivery_document, all projects | R assigned, upload site photos | R all |
| Documents, restricted (contract, invoice, bill) | RW | none | none | none | none | RW |
| Drawing approval status | set | set (assigned) | none | none | none | none |
| Contract value, variations | RW (director approves variations) | none | none | none | none | R |
| Payment milestones, invoices, receipts | RW | none | none | none | none | RW |
| Budget lines, cost categories | RW | none | none | none | none | R |
| Vendor orders (amounts, delivery) | RW | R assigned | none | RW all | none | R |
| Bills, bill payments | RW | none | none | none | none | RW |
| Bank balances | RW | none | none | none | none | RW |
| Company cash items (salary total, rent, EMI) | RW | none | none | none | none | R |
| Project cost, forecast, profit, cash projection | R | none | none | none | none | R |
| Customers, enquiries, follow-ups, quotations | RW all | R if linked to assigned project | RW own | none | none | none |
| Sales tracker | all salespeople | none | own numbers only | none | none | none |
| Lead sources, lost reasons | manage | R | R | none | none | none |

Notes:
- Contract value lives in `project_commercials`, separate from `projects`, so RLS can hide it completely. Only the director edits it.
- Salary must be entered as ONE total line in `company_cash_items`, never per employee.
- A site engineer must never see company-wide cash, profit, payroll, other projects, or contract values.
- Inactive users (`profiles.is_active = false`) must be blocked by both middleware and RLS.
- The `accounts` role is essential in V1: it feeds invoices, receipts, bills, payments and bank balances. If this role is unused, priority 2 will be empty.

---

## 6. DATA MODEL (V1)

Common columns (`id`, `created_at`, `updated_at`) are omitted below. All amount columns are `numeric(14,2)`.

**Enums**
- `app_role`: director, project_manager, sales, purchase, site_engineer, accounts
- `project_status`: active, on_hold, closed, cancelled
- `milestone_status`: pending, done
- `delay_reason`: weather, client_site_not_ready, material_delay, drawings_pending, labour_shortage, payment_delay, other
- `task_kind`: task, issue
- `task_priority`: low, medium, high, critical
- `task_status`: open, in_progress, blocked, done
- `report_status`: submitted, reviewed, correction_required
- `doc_category`: contract, quotation, drawing, customer_approval, purchase_order, invoice, bill, delivery_document, site_photo, inspection, handover, other
- `drawing_review_status`: pending, approved, rejected, superseded
- `variation_status`: proposed, approved, rejected
- `payment_mode`: bank_transfer, cheque, cash, upi, other
- `order_kind`: material, fabrication, subcontract, service
- `fulfilment_status`: ordered, in_progress, partially_fulfilled, fulfilled, issue, cancelled
- `bill_type`: supplier_bill, subcontractor_bill, direct_expense
- `cash_direction`: inflow, outflow
- `cash_item_status`: planned, done, cancelled
- `enquiry_status`: open, quoted, won, lost
- `followup_kind`: call, meeting, site_visit, message, other
- `quotation_status`: draft, sent, negotiating, accepted, rejected, expired

**Core tables**
- `profiles`: id (= auth user id), full_name, phone, designation, is_active (default true)
- `user_roles`: user_id, role; primary key (user_id, role)
- `app_settings`: key (pk), value (jsonb), updated_by
- `audit_log`: table_name, record_id, action, changed_by, old_data (jsonb), new_data (jsonb), changed_at. Append-only. Director read only.

**Priority 1 tables**
- `project_stages`: position, name. Seeded exactly: 1 Enquiry and quotation; 2 Contract confirmation; 3 Engineering and drawing approvals; 4 Procurement and outsourced fabrication; 5 Dispatch and material delivery; 6 Site readiness; 7 Erection and installation; 8 Inspection and defect correction; 9 Handover and project closure
- `projects`: code (unique), name, customer_id (nullable until sales tables exist; FK added in T13), quotation_id (nullable), site_location, site_contact_name, site_contact_phone, current_stage_id, start_date, planned_completion_date, actual_completion_date, status, notes, is_archived
- `project_members`: project_id, user_id, member_role (`app_role`); unique (project_id, user_id)
- `project_milestones`: project_id, title, stage_id, planned_date, actual_date, status, delay_reason, delay_note, position
- `tasks`: project_id (nullable), kind, title, description, priority, due_date, assignee_id, status, blocked_reason, resolution_note, completed_at, created_by
- `task_comments`: task_id, author_id, body
- `site_reports`: project_id, report_date, submitted_by, work_completed, progress_note, milestone_id (nullable), own_headcount, subcontractor_headcount, materials_received, materials_required, problems_delays, delay_reason (nullable), action_required, responsible_party, status, reviewed_by, reviewed_at, review_note
- `documents`: project_id (nullable), quotation_id, site_report_id, invoice_id, bill_id, vendor_order_id (all nullable), category, title, storage_path, mime_type, size_bytes, version_no, review_status (only for category drawing, else null), reviewed_by, reviewed_at, review_note, supersedes_id, uploaded_by, is_archived

**Priority 2 tables: collections**
- `project_commercials`: project_id (pk), contract_value_excl_gst, updated_by
- `variation_orders`: project_id, title, amount_excl_gst (may be negative), status, approved_by, approved_on, note
- `payment_milestones`: project_id, label, amount_excl_gst, expected_date, position
- `invoices`: project_id, payment_milestone_id (nullable), invoice_number, invoice_date, due_date, amount_excl_gst, gst_amount, is_cancelled, note
- `receipts`: project_id, invoice_id (nullable: null means an advance not yet allocated), receipt_date, amount_received, tds_amount (default 0), mode, reference, note

**Priority 2 tables: costs**
- `cost_categories`: name, is_active (seeded from A13)
- `budget_lines`: project_id, category_id, amount_excl_gst, note; unique (project_id, category_id)
- `vendor_orders`: project_id, category_id, kind, vendor_name (free text), description, amount_excl_gst, gst_amount, order_date, expected_delivery_date, fulfilment_status, delivery_note, created_by
- `bills`: project_id, category_id, vendor_order_id (nullable), bill_type, vendor_name, bill_number, bill_date, due_date, amount_excl_gst, gst_amount, is_cancelled, note
- `bill_payments`: bill_id, payment_date, amount_paid, tds_amount (default 0), mode, reference, note

**Priority 2 tables: cash**
- `bank_balances`: account_label, balance, as_of_date, recorded_by
- `company_cash_items`: direction, category (text), description, amount, expected_date, status, created_by

**Priority 3 tables**
- `lead_sources`: name, is_active. `lost_reasons`: name, is_active. (seeded from A16)
- `customers`: name, contact_person, phone, email, address, notes, is_archived
- `enquiries`: customer_id, title, requirement, expected_value_excl_gst, source_id, assigned_to, status, lost_reason_id, lost_note, next_followup_date, won_at, lost_at, project_id (nullable, set at conversion), is_archived
- `enquiry_followups`: enquiry_id, kind, followup_date (default today), attendees (text, nullable), note, created_by
- `quotations`: enquiry_id, quote_number (unique), version (unique with enquiry_id), amount_excl_gst, validity_date, status, sent_at, accepted_at, notes

**Database functions (create in migrations; names are ours)**
`is_director()`, `has_role(app_role)`, `is_project_member(project_id)`, `generate_project_code()`, `convert_quotation_to_project(...)` (single transaction), generic audit trigger function.

**Storage**
One private bucket `project-files`. Object path: `{project_id or 'general'}/{document_id}/{original_filename}`. Never overwrite objects. Allowed types: PDF, JPG, PNG, WEBP, XLSX, DOCX. Max 25 MB.

---

## 7. BUSINESS RULES AND DEFINITIONS (use exactly these)

### Priority 1: project status and delays
- **R1 Delayed project**: status is `active` AND (`planned_completion_date` < today OR at least one milestone is `pending` with `planned_date` < today).
- **R2 Progress**: display "X of Y milestones done". Never a percentage.
- **R3 Overdue task**: status is not `done` AND `due_date` < today. A `blocked` task is always shown as a separate alert.
- **R4 Missing site report**: project is `active` AND its current stage is one of 6 Site readiness, 7 Erection and installation, 8 Inspection and defect correction AND, for any of the last 3 completed working days (Mon to Sat, excluding today), no site report exists for that project and date.
- **R5 Pending drawing approval**: document category `drawing` with `review_status = pending`. Show age in days.
- **R6 Site report lifecycle**: submitter may edit while status is `submitted` or `correction_required`. Reviewer (director or assigned project manager) sets `reviewed` (locks it) or `correction_required` with a mandatory note. Resubmission sets status back to `submitted`.
- **R7 Drawing revisions**: uploading a new revision with `supersedes_id` sets the older one to `superseded`. Old files are never overwritten or deleted.
- **R8 Restricted documents**: categories contract, invoice, bill are visible only to director and accounts. Category purchase_order is visible to director, accounts, purchase and assigned project managers.
- **R9 Vendor order late or in trouble**: `fulfilment_status` not in (`fulfilled`, `cancelled`) AND `expected_delivery_date` < today, OR status is `issue`. This counts as a project delay signal and appears in the delays block.
- **R10 Audit**: audit triggers on every business table listed in Section 6 (all except `audit_log`, `project_stages`, lookup tables). Important changes must be traceable to who and when.
- **R11 Alerts are computed from live data on read.** No stored alert table. Every alert shows: type, severity, project (if any), age, assigned person, and a link to the original record.

### Priority 2: money. Amount convention (A11) applies everywhere
- **F1 Revised contract value** = `contract_value_excl_gst` + sum of `variation_orders.amount_excl_gst` where status is `approved`.
- **F2 Invoice total** = `amount_excl_gst` + `gst_amount`. **Invoice settled amount** = sum over linked receipts of (`amount_received` + `tds_amount`). **Invoice outstanding** = total − settled. Cancelled invoices are excluded from everything.
- **F3 Advances**: receipts with `invoice_id` null are "advance received, not yet allocated". Show them per project and in the receivables total as a separate line. Allocating later means setting `invoice_id` (audited).
- **F4 Overdue receivable**: outstanding > 0 AND `due_date` < today. Aging buckets by days overdue: 1 to 30, 31 to 60, 61 to 90, over 90.
- **F5 Billing schedule completeness**: sum of `payment_milestones.amount_excl_gst` should equal the revised contract value. If not, show "Billing schedule does not match contract value (difference ₹X)". Milestones with `expected_date` within the next 7 days and no linked invoice raise an "Invoice to raise" alert.
- **F6 Cost states** (never mix them):
  - Budget = `budget_lines` (ex-GST).
  - Committed = sum of `vendor_orders.amount_excl_gst` not cancelled.
  - Billed = sum of `bills.amount_excl_gst` not cancelled.
  - Paid = `bill_payments.amount_paid` (cash out). Settled amount of a bill = `amount_paid` + `tds_amount`.
  - Collected = sum of `receipts.amount_received` (cash in).
  - "Paid" is never used as the measure of cost.
- **F7 Bill outstanding** = (`amount_excl_gst` + `gst_amount`) − sum of (`amount_paid` + `tds_amount`). Overdue payable: outstanding > 0 AND `due_date` < today.
- **F8 Forecast cost per category** = billed_cat + remaining_committed_cat + uncommitted_budget_cat, where:
  - remaining_committed (per order) = max(order amount − sum of bills linked to that order, 0), summed per category;
  - uncommitted_budget_cat = max(0, budget_cat − (committed_cat + unlinked_billed_cat));
  - unlinked_billed = bills with no `vendor_order_id`.
  If a category has orders or bills but no budget line: forecast = billed + remaining_committed, and flag "No budget for this category".
  **Required worked examples (use as unit-test fixtures):**
  (a) budget 100, one order 60, linked bills 60 → forecast 100.
  (b) budget 100, one order 60, linked bills 70 → forecast 110 (overrun 10).
  (c) budget 100, one order 60, linked bills 60, unlinked bills 20 → billed 80, remaining committed 0, uncommitted max(0, 100 − (60+20)) = 20 → forecast 100.
  (d) no budget, order 50, linked bills 20 → forecast 50, flagged "No budget".
- **F9 Forecast profit** = revised contract value − total forecast cost. **Margin %** = profit / revised contract value. Calculate ONLY if the project has a contract value AND at least one budget line. Otherwise show "Incomplete" with the missing item named. Always label: "Management estimate, not accounting profit."
- **F10 Cost overrun flag**: total forecast cost > total budget, or any category forecast > its category budget.
- **F11 Cash on hand** = sum over each distinct `account_label` of the balance from its latest `as_of_date` entry. Show the oldest of those dates. If any account's latest entry is older than 7 days, show "Stale: update balances".
- **F12 Cash projection** (from today, IST). Buckets: Due now (overdue payables), 0 to 7 days, 8 to 30, 31 to 60, 61 to 90.
  - Inflows: outstanding invoices by `due_date` (future-dated only), PLUS payment milestones not yet invoiced by `expected_date`, PLUS planned inflow `company_cash_items`.
  - Outflows: outstanding bills by `due_date` (overdue ones land in "Due now"), PLUS planned outflow `company_cash_items`.
  - **Overdue receivables are NOT assumed to arrive.** Show them as a separate line "Overdue receivables (not assumed received)".
  - **Committed but not yet billed** is shown as an informational line, excluded from the net total.
  - Running balance per bucket = cash on hand + cumulative inflows − cumulative outflows. If it goes below zero in any bucket within 30 days, raise a "Projected cash shortfall" alert.
  - Always label: "Projection from recorded data. Excludes anything not entered."
- **F13 Financial records are never deleted.** Cancel invoices and bills with `is_cancelled`; correct receipts and payments by editing (audited).

### Priority 3: sales tracker
- **S1 Lead** = an enquiry (created date = lead received date).
- **S2 Meeting** = an `enquiry_followups` row with kind `meeting` or `site_visit` (A14).
- **S3 Quoted** = the enquiry has at least one quotation with `sent_at` set. Setting a quotation to `sent` sets `sent_at` and moves the enquiry to `quoted` if it was `open`.
- **S4 Won / project finalised** = enquiry status `won`, with `won_at` set when the quotation is accepted and converted. **S5 Lost** requires a `lost_reason_id`; sets `lost_at`.
- **S6 Period presets** (IST): This month, Last month, This quarter, This FY, Last FY, Custom range.
- **S7 Two blocks on the tracker.**
  1. *Activity in the period*: leads received (created in period), meetings held (follow-up date in period), enquiries quoted (first `sent_at` in period), quotation value sent (latest sent version per enquiry, ex-GST), projects finalised (`won_at` in period) with total win value (accepted quotation amount, ex-GST), leads lost (`lost_at` in period).
  2. *Funnel for leads received in the period* (cohort): leads received → with at least one meeting → quoted → won → lost → still open. Show each as "n of N (x%)". Conversion rates are always shown with their counts. If N < 5 show "small sample".
- **S8 Average sales cycle** = average days from enquiry created to `won_at` for wins in the period.
- **S9 Breakdowns** for the selected period: per salesperson (leads, meetings, quoted, won, win value), per lead source, lost reasons.
- **S10 Open pipeline** = enquiries with status `open` or `quoted`: count and total `expected_value_excl_gst`. Follow-ups due = `next_followup_date` <= today.
- **S11 Quotation validity passed**: status `sent` or `negotiating` AND `validity_date` < today. Alert only; never auto-change status. Warn when validity is within 7 days.
- **S12 Quotation to project**: allowed only when quotation status is `accepted`. One database transaction: create project (name from enquiry title, customer from enquiry, `quotation_id` set, code generated, current stage 2 Contract confirmation), create `project_commercials` with `contract_value_excl_gst` = quotation amount (director can edit), set enquiry `status = won`, `won_at`, `project_id`. Converting the same quotation twice must be blocked. No retyping of data. Projects created manually (without sales data) remain valid.
- **S13 Visibility**: a sales user sees only their own numbers. The director sees all.

---

## 8. SCREENS (V1)

**Shared**: Login, Forgot/Reset password, role-based redirect (director to `/admin`, everyone else to `/employee`).

**Admin (`/admin`, director)**
1. **Overview**, in this exact order:
   - *Block 1, Project status and delays*: active projects, delayed projects, overdue and blocked tasks, pending drawing approvals, missing site reports, late vendor orders. Table of active projects with stage, "X of Y milestones", delayed flag, last site report date.
   - *Block 2, Money*: total receivable and overdue receivable (with aging), total payable and overdue payable, cash on hand (with as-of date and stale flag), projected cash for 30 days with shortfall flag, projects over budget, projects with Incomplete financial data.
   - *Block 3, Sales*: for "This month": leads, meetings, quotations sent, projects finalised, open pipeline. Link to the full tracker.
   - Alerts list below. Every number and alert is clickable to its source records. No fabricated figures. Missing data shows Incomplete.
2. Projects: list; detail tabs (Overview, Milestones, Tasks, Site reports, Documents, Orders and costs, Billing and collections, Profitability, Team).
3. Collections: receivables by project and customer, aging, advances unallocated, overdue list. CSV export.
4. Payables: bills outstanding and overdue, upcoming 7 and 30 days, bill payments. CSV export.
5. Cash flow: bank balances, company cash items, projection table (F12). CSV export.
6. Sales tracker (S7 to S10), enquiries and quotations pipeline. CSV export of enquiries.
7. Tasks and issues (all). 8. Site reports (all, review queue). 9. Documents (all, drawing approval queue). 10. Vendor orders (all). 11. Alerts (full list with filters).
12. Employees (create, edit, assign roles, deactivate). 13. Settings (lead sources, lost reasons, cost categories). 14. Audit log (read-only, filter by table, record, user, date).

**Employee (`/employee`)**
- Everyone: "My work" (my tasks, my projects, pending actions for my roles), my tasks, raise an issue.
- Accounts: Invoices and receipts, Bills and payments, Bank balances, Payment milestones, read-only budgets and cash items, Collections and Payables views.
- Purchase: Vendor orders (create, update delivery status), read-only project list, purchase_order documents.
- Sales: My enquiries, quick-log (call, meeting, site visit), quotations, my tracker numbers.
- Project manager: My projects (detail tabs without finance except vendor orders), review site reports, tasks, drawing approvals.
- Site engineer (mobile-first): My projects, Submit daily report with photos, My reports and correction requests, Raise issue.

---

## 9. REPORT FORMAT (after every task, then STOP)

```
TASK: T<n> <name>
STATUS: DONE | DONE WITH LIMITS | BLOCKED
FILES CHANGED: <list of paths>
COMMANDS RUN (with real output summary): <command> -> <result>
VERIFIED (with evidence): <what, how>
UNVERIFIED (and why): <what, why, exact manual steps for Kalki>
ASSUMPTIONS USED: <IDs from Section 3, or new ones>
DECISIONS RECORDED: <entries added to DECISIONS.md>
KALKI VERIFIES: <numbered click-path or command steps>
WAITING FOR: APPROVED T<n>   (and GATE G<n> PASSED where a gate follows)
```
`PROGRESS.md` must be updated first: current task, status, package versions, known issues.

---

## 10. TASK LIST (strict order)

### T0: Preflight (no application code)
**Do:**
- Read this file. Summarize your understanding in at most 15 lines, including the three priorities.
- Check the dev environment by running commands: Node version, package manager, Git, Supabase CLI availability, Docker availability. Show real output.
- List which human prerequisites (Section 0) are missing.
- List open decisions D1 to D8 back to Kalki, and any ambiguity or conflict you found in this brief with a recommended resolution.
- Create `PROGRESS.md`, `DECISIONS.md` and an empty `RELEASE.md`.
**Do not:** create the Next.js app or any code.
**Kalki verifies:** the summary matches his understanding; D1 to D8 questions are clear.

### T1: Scaffold
**Build:** Next.js (TypeScript, App Router, Tailwind, ESLint) with shadcn/ui; Supabase client helpers; `.env.example`; `.gitignore` check; `/lib/money.ts` (rupees to integer paise and back, `en-IN` formatting) with unit tests; empty layouts for `/admin` and `/employee` with navigation shells (only labels of modules that exist in V1, no fake data); `/api/health`.
**Verify:** `lint`, typecheck, unit tests and `build` pass with shown output. Record exact versions of next, react, @supabase/*, tailwindcss in `PROGRESS.md`. Show a unit test proving `0.1 + 0.2` style errors cannot occur in money helpers.
**Kalki verifies:** `npm run dev` opens; shells render; `.env.local` is not tracked by Git.

### T2: Database foundation
**Build:** Migration `001`: enums needed so far, `profiles`, `user_roles`, `app_settings`, `audit_log`, `is_director`, `has_role`, generic audit trigger; RLS on all of these; auto-create profile on new auth user. RLS test files in `supabase/tests/`.
**Verify:** RLS tests with at least 3 test users (director, sales, site_engineer): a non-director cannot read `audit_log`, cannot edit `user_roles`; an inactive user is denied. Show test output, or mark UNVERIFIED with manual steps.
**Kalki verifies:** applies the migration to `westeel-dev` and runs the test steps.

### T3: Authentication and employee management
**Build:** Login, logout, password reset; middleware route guards; role-based redirect (director wins if multi-role); inactive-user block; director TOTP MFA enrolment required (verify the current Supabase MFA API in docs first); admin screens to create an employee (server-only code using the service-role key), assign roles, edit, deactivate, reactivate. Document the one-time manual step to create the first director.
**Verify:** Test with 3 real accounts. Show that a non-director cannot open `/admin` or call the employee-creation action directly, and that a deactivated user cannot log in or use an existing session.
**Kalki verifies:** logs in as each role; creates an employee; deactivates and retries login.

---
### PRIORITY 1 BLOCK: project status and delays
---

### T4: Projects, stages, members, milestones
**Build:** Migration for `project_stages` (seeded), `projects`, `project_members`, `project_milestones`, `generate_project_code`, RLS and audit. Screens: project list; detail tabs Overview, Milestones, Team. Create a project manually. Change stage. Add and edit milestones with planned dates and delay reasons. Button "Add default milestones from stages" (one per stage, planned date empty, shown as "date missing"). Show "X of Y milestones done" and the delayed flag per R1 and R2. Unit tests for R1 and R2.
**Verify:** RLS tests: a site_engineer not on the project cannot read it; purchase sees only name, code and site; sales sees only assigned projects.
**Kalki verifies:** creates a real project, assigns members, checks each role's visibility.

### T5: Tasks and issues
**Build:** Migration for `tasks`, `task_comments`. Director and PM create and assign tasks (project optional). Any employee can raise an issue (`kind = issue`) on a project they belong to; it defaults to the project manager. Status changes with blocked reason, comments, resolution note. Overdue and blocked per R3. Unit tests for R3.
**Verify:** RLS tests: employee sees only own tasks; PM sees tasks of assigned projects; nobody edits others' tasks.
**Kalki verifies:** assigns a task, user marks it blocked, director sees it flagged.

### T6: Documents core and drawing approvals
**Build:** Migration for `documents`, private bucket `project-files`, storage policies. Upload (type and size checks), list, search and filter, signed-URL download through a server route that checks permission. Categories and restricted rule R8. Drawing revisions and approval per R5 and R7 with approver and time recorded. Audit on documents.
**Verify:** Try to download a restricted document as a site_engineer by direct URL and by guessing the storage path: both must fail. Show evidence. Confirm no public URL exists for any object.
**Kalki verifies:** uploads a drawing, uploads a revision, approves; tries as another role.

### T7: Daily site reports with photos (mobile-first)
**Build:** Migration for `site_reports`. Report form with the Section 6 fields, delay reason selection, photo upload (client-side compression, progress, retry), browser draft autosave, confirmation on submit. Lifecycle per R6. Review screens for PM and director. Engineer sees only own reports on assigned projects. Unit tests for the working-day logic used by R4 (Mon to Sat, IST).
**Verify:** Test at 375px width. RLS tests: engineer cannot read or edit another engineer's report or a project they are not on; reviewed reports cannot be edited by the submitter.
**Kalki verifies:** submits a report from his own phone with 2 photos; reviewer requests a correction; engineer corrects and resubmits.

### T8: Director Overview (Block 1) and employee "My work"
**Build:** `/lib/rules` pure functions for R1, R3, R4, R5 (unit tested with edge cases: midnight IST, Sundays). Admin Overview Block 1 and the Alerts page per R11. Employee "My work" per role. Every number and alert clickable to the source record. Honest empty states. Blocks 2 and 3 do not exist yet and must not appear.
**Verify:** Unit test output. Create real test records in dev that trigger each alert type and show the alert appears and links correctly. Search the codebase for hardcoded numbers and show the result.
**Kalki verifies:** triggers each alert by creating the conditions himself.

### T9: Production deployment, backups, restore test (then GATE G1)
**Do:**
- Read the current official Supabase documentation on backups and project pausing for the chosen plan. Quote the source URL and state what you verified. Do not rely on memory.
- Create a documented, repeatable logical backup (`pg_dump` or the officially documented method) stored outside Supabase, plus a note on backing up storage files.
- Perform a **restore test** into a fresh database and compare row counts per table. Show output.
- Create `westeel-prod`, apply migrations, set production env vars on Vercel, configure auth redirect URLs, enforce MFA for the director, confirm the dev seed is not applied.
- Write `RELEASE.md`: the procedure for every future release: test on dev, take a backup of prod, apply migration to prod, deploy, smoke test.
**Verify:** restore test output; production smoke test.
**GATE G1 (Kalki):** The director and at least one site engineer and one project manager use the system on a real project for at least one week: projects, milestones, tasks, daily site reports, drawings. Send `GATE G1 PASSED` only when real usage happened. Note defects for T15.

---
### PRIORITY 2 BLOCK: cash flow, collections, project costs
---

### T10: Customer billing and collections
**Build:** Migration for `project_commercials`, `variation_orders`, `payment_milestones`, `invoices`, `receipts` with RLS (Section 5) and audit. Project tab "Billing and collections": contract value (director), variations (propose and approve), payment milestones, invoices (linked to milestones), receipts (against an invoice, or advance). Collections page: receivables by project and customer, aging per F4, advances per F3, overdue list. Accounts employee forms. Alerts: overdue receivable, invoice to raise (F5). Block 2 on the Overview gets the receivables panel. CSV export of invoices and receipts. Documents may attach to invoices.
**Verify:** Unit tests for F1 to F5 with worked examples including: partial receipt, receipt with TDS, advance later allocated, cancelled invoice, milestone sum mismatch. RLS tests: PM, sales, purchase and site_engineer cannot read any of these tables; accounts cannot edit contract value.
**Kalki verifies:** enters one real project's contract value, billing schedule, invoices and receipts with the accountant, and compares the outstanding amount with the accountant's own figure.

### T11: Vendor orders, project costs, payables, forecast
**Build:** Migration for `cost_categories` (seeded A13), `budget_lines`, `vendor_orders`, `bills`, `bill_payments` with RLS and audit. Screens: purchase queue and project tab "Orders and costs" (create order, update fulfilment status and expected delivery, enter bills linked to orders, payments); Payables page; project tab "Profitability" (director and accounts only) showing the six cost states of F6 per category, forecast per F8, forecast profit and margin per F9, overrun flags per F10, and Incomplete badges. Alerts: late vendor order (R9), overdue payable (F7), cost overrun (F10). Overview Block 2 gets payables and over-budget panels. CSV export of bills and project cost summary. Settings: manage cost categories.
**Verify:** Unit tests for F6 to F10 using the four required worked examples in F8 plus: bill with TDS, cancelled bill, order cancelled after billing, category without budget, project with no contract value (must show Incomplete, no profit). RLS tests per Section 5, including PM read-only on assigned projects' orders.
**Kalki verifies:** enters one real project's budget, orders and bills with the director and accountant; checks that "Billed", "Paid" and "Committed" match their own records.

### T12: Cash flow (then GATE G2)
**Build:** Migration for `bank_balances`, `company_cash_items` with RLS and audit. Screens: bank balances (add dated entry per account label), company cash items (director; form allows "repeat for N months", which creates N rows at creation; salary must be one total line), Cash flow page with projection per F11 and F12 and all required labels. Alerts: projected cash shortfall, stale balances. Overview Block 2 gets the cash panel. CSV export of the projection.
**Verify:** Unit tests for F11 and F12 with edge cases: two accounts with different dates, stale balance, overdue payable lands in "Due now", overdue receivable excluded, milestone not yet invoiced counted once (not also when invoiced), committed-not-billed excluded from net, shortfall in bucket 3.
**GATE G2 (Kalki):** For at least 2 weeks, the accountant records invoices, receipts, bills, payments and balances for real projects. At the end, Kalki and the accountant reconcile: receivables, payables and cash balance against the accounting software. Differences are listed. Send `GATE G2 PASSED` only after reconciliation is done and differences are explained.

---
### PRIORITY 3 BLOCK: sales tracker
---

### T13: Sales data capture and conversion
**Build:** Migration for `lead_sources`, `lost_reasons` (seeded A16), `customers`, `enquiries`, `enquiry_followups`, `quotations`; add the FK from `projects.customer_id`; RLS and audit. Screens: customers, enquiries (source, assigned salesperson, expected value, next follow-up date), **quick-log** for call, meeting, site visit (under 10 seconds on mobile, attendees optional), quotation register (versions, status changes, validity date, attached file via documents category `quotation`, `sent_at` and `accepted_at` handling per S3), lost with reason per S5, conversion per S12. Alerts: follow-up due, quotation validity passed (S11). Settings: manage lead sources and lost reasons. CSV export of enquiries.
**Verify:** Unit tests for S3, S5, S11. Transaction test for S12: a failed conversion leaves no partial records and double conversion is blocked. RLS tests: sales A cannot read sales B's enquiries or quotations by direct request; site_engineer cannot read customers.
**Kalki verifies:** full path lead to meeting to quotation to accepted to project with no retyping.

### T14: Sales tracker dashboard (then GATE G3)
**Build:** `/lib/rules` sales functions for S6 to S10 (period presets incl. FY April to March in IST). Sales tracker page: activity block and cohort funnel (S7), average sales cycle (S8), breakdowns by salesperson, lead source and lost reasons (S9), open pipeline and follow-ups due (S10), list of finalised projects with date and value. Sales users see only their own numbers (S13). Overview Block 3 uses the same functions.
**Verify:** Unit tests with fixtures covering: lead created in one period and won in another (cohort vs activity must differ correctly), small-sample note, lead with two meetings counts as one lead with a meeting but two meetings held, quotation with several versions counts once as quoted, FY boundary on 31 March and 1 April.
**GATE G3 (Kalki):** The salesperson logs real leads, meetings and quotations for at least 2 weeks. Kalki checks that the tracker numbers match the salesperson's own records. Send `GATE G3 PASSED` after.

---
### FINAL
---

### T15: Hardening and final acceptance
**Build:** No new features. Do: full RLS test matrix (every table x every role, using Section 5); direct-URL and direct-API tampering tests for records, documents and CSV exports; scan to prove the service-role key is not in the client bundle; Zod validation review on every server action; audit coverage check (R10); indexes on foreign keys and filter columns; error message review; mobile check of the site engineer and sales quick-log flows; basic accessibility check (labels, contrast, keyboard); fix defects collected during gates G1 to G3.
**Verify:** Deliver a matrix table (table x role x allowed/denied x test result). Any failure is fixed minimally and reported. Re-run the restore test on the current production data and show the output.
**Kalki verifies:** reviews the matrix; tries 5 tampering attempts of his own; final acceptance below.

---

## 11. FINAL ACCEPTANCE (V1)

V1 is accepted only when ALL are true, each with evidence:

**Priority 1: project status and delays**
1. The director sees every project with its stage, "X of Y milestones", and delayed flag, and can open the reason (milestone, task, missing report, drawing, late order).
2. A site engineer submits a report with progress, photos and blockers from a phone.
3. Overdue tasks, blocked tasks, missing site reports and pending drawing approvals appear as clickable alerts.

**Priority 2: cash flow, collections and project costs**
4. For a real project, outstanding receivables and aging match the accountant's records (G2 reconciliation).
5. For a real project, committed, billed, paid and collected amounts are shown separately and match records; forecast profit shows "Incomplete" when contract value or budget is missing.
6. The cash projection shows cash on hand with its as-of date, expected inflows and outflows by bucket, overdue receivables separately, and the shortfall alert works.

**Priority 3: sales tracker**
7. The tracker shows, for any period: leads, meetings, quotations sent, projects finalised, conversion counts with percentages, lost reasons, per salesperson and per source, and matches the salesperson's own records (G3).
8. An accepted quotation becomes a project with no retyping.

**Security and trust**
9. An employee cannot read or change another role's restricted records, finance data or CSV exports by changing the URL or calling the API directly (T15 matrix).
10. Missing information is shown as missing, never replaced by invented values. Important changes have history in `audit_log`. A backup restore has been tested. Employees can learn it without extensive training.
