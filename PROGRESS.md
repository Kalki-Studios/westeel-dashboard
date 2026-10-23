# Westeel Dashboard Build Progress

## Current Task
- **Task:** PROJECT COMPLETED (V1 Accepted)
- **Status:** ALL TASKS (T0–T15) APPROVED & ACCEPTED

## Overall Roadmap Status
- [x] **T0: Preflight** - Environment verification, dependencies audit, decisions log, roadmap initialization
- [x] **T1: Scaffold** - Next.js, TypeScript, Tailwind, shadcn/ui helpers, Supabase helpers, money utils, layouts, `/api/health`
- [x] **T2: Database foundation** - Schema migration 001 applied to `westeel-dev`, enums, profiles, user_roles, audit_log, RLS policies, functions, RLS tests passed
- [x] **T3: Authentication & employee management** - Login, logout, password reset, middleware route guards, inactive user blocking, director TOTP MFA banner, admin employee CRUD screens with service-role security
- [x] **T4: Projects, stages, members, milestones** - Schema migration 002 applied, 9 seeded stages, projects CRUD, auto-generated code `generate_project_code()`, project members assignment, default stage milestones, delay rule R1, progress rule R2 ("X of Y milestones done"), RLS test matrix passed (4/4), unit tests passed (11/11 for R1/R2, 17/17 overall), elimination of `/login` in favor of direct `/x9admin` gate
- [x] **T5: Tasks and issues** - Schema migration 003 applied, `tasks` & `task_comments` tables, audit triggers, RLS test matrix passed (5/5), Rule R3 pure functions (`isTaskOverdue`, `isTaskBlocked`) and unit tests passed (8/8, 25/25 overall), Admin Tasks screen at `/x9admin/tasks`, Employee Tasks workspace at `/employee/tasks`, Employee Issue escalation at `/employee/raise-issue` with automatic Project Manager routing
- [x] **T6: Documents core & drawing approvals** - Migration 004 applied, private bucket `project-files`, auto-supersede trigger (R7), RLS test matrix passed (4/4), Rule R5 & R8 pure functions with unit tests passed (8/8, 33/33 overall), server signed-URL download route at `/api/documents/[id]/download`, Admin Documents screen at `/x9admin/documents`, Project Detail Documents tab at `/x9admin/projects/[id]`, Employee Drawings workspace at `/employee/drawings`
- [x] **T7: Daily site reports with photos** - Migration 005 applied, `site_reports` table & `fk_documents_site_report` constraint, audit trigger, RLS test matrix passed (5/5), Rule R4 working-day logic (Mon-Sat, IST) & Rule R6 lifecycle pure functions with unit tests passed (12/12, 45/45 overall), mobile-first site report form with client-side canvas compression, browser autosave & submit confirmation, site engineer submitted reports view with Rule R6 lock & correction flow, Director and PM review screens at `/x9admin/site-reports` and `/employee/review-reports`
- [x] **T8: Director Overview (Block 1) & employee "My work"** - Status and delays block, live R11 alerts engine (Rule R1, R3, R4, R5), unit test coverage (8/8 alerts, 53/53 overall), Director Overview at `/x9admin`, dedicated Alerts directory at `/x9admin/alerts`, role-tailored Employee "My Work" hub at `/employee` with clickable metrics and honest empty states; Blocks 2 & 3 strictly excluded
- [x] **T9: Production deployment, backups, restore test** - Official Supabase backup & pausing documentation verified, automated logical backup script (`npm run backup`), storage files backup script (`npm run backup:storage`), live restore test with 12/12 table row count exact matches, comprehensive runbook in `RELEASE.md`
- [x] **GATE G1: Real usage trial (1 week)**
- [x] **T10: Customer billing and collections** - Commercials, variations, milestones, invoices, receipts, aging buckets, live alerts, Block 2 receivables panel, Project Detail billing tab, Collections register, and Accounts workspace. (Migration 006, 8/8 RLS tests passed, 64/64 unit tests passed, 0 lint/tsc errors, production build verified)
- [x] **T11: Vendor orders, project costs, payables, forecast** - Migration 007 applied, 11 default cost categories (A13), 5 cost tables, 7/7 RLS test matrix passed, Rules F6 (6 cost states), F7 (payables aging & TDS settlement), F8 (category cost forecast with all 4 worked examples), F9 (forecast profit & margin % with Incomplete badges), F10 (cost overrun flags), R9 (late vendor orders), 80/80 unit tests passed, Overview Block 2 expanded with Payables aging, Over-budget panel, Incomplete financials, and Late vendor orders KPI, Project Detail "Orders and costs" & "Profitability" tabs, Payables workspace (`/x9admin/payables` & `/employee/bills`), Purchase Queue (`/x9admin/orders` & `/employee/vendor-orders`), Settings (`/x9admin/settings`), CSV exports. (0 lint/tsc errors, production build verified)
- [x] **T12: Cash flow** - Migration 008 applied, `bank_balances` & `company_cash_items` tables, 9/9 RLS test matrix passed, Rules F11 (cash on hand, oldest date, stale flag) and F12 (5 projection buckets: Due now, 0-7d, 8-30d, 31-60d, 61-90d, overdue receivables excluded, committed-not-billed excluded from net, running balance, 30-day shortfall alert), 90/90 unit tests passed across 10 test suites, Overview Block 2 expanded with Cash on Hand & 30-day projected balance panel, Admin Cash Flow workspace (`/x9admin/cashflow`), Accounts Employee Bank Balances workspace (`/employee/bank-balances`), CSV exports for projection and bank balances. (0 lint/tsc errors, production build verified)
- [x] **GATE G2: Finance reconciliation (2 weeks)**
- [x] **T13: Sales data capture & conversion** - Migration 009 applied, tables `lead_sources`, `lost_reasons` (seeded A16), `customers`, `enquiries`, `enquiry_followups`, `quotations`, unique partial index `uq_projects_quotation_id`, atomic conversion procedure `convert_quotation_to_project`, 8/8 SQL RLS and conversion transaction tests passed, pure rules S2, S3, S5, S10, S11, S12 verified with 16 vitest unit tests (107/107 overall across project), live sales alerts integration, Admin Sales workspace (`/x9admin/sales`), Settings management for lead sources & lost reasons (`/x9admin/settings`), Employee Quick-Log (<10s mobile logger at `/employee/quick-log`), Employee Enquiries & Quotations pipeline (`/employee/enquiries`), enquiries CSV export. (0 lint/tsc errors, production build verified)
- [x] **T14: Sales tracker dashboard** - Rules S6 to S10 pure engine (`lib/rules/sales.ts`), verified 5 required edge-case test fixtures in `lib/rules/sales.test.ts` (115/115 unit tests passing), SalesTrackerView component with period presets, activity block (S7.1), cohort funnel (S7.2) with "n of N (x%)" & "small sample (N < 5)", average sales cycle (S8), breakdowns by salesperson, lead source, and lost reason (S9), open pipeline & follow-ups due (S10), finalised projects list, Director Overview Block 3 live integration (`/x9admin`), sales employee personal tracker numbers isolation per Rule S13 (`/employee/enquiries?tab=tracker`).
- [x] **GATE G3: Sales tracking trial (2 weeks)**
- [x] **T15: Hardening and final acceptance** - Full 6-role RLS test matrix (32/32 tests passed), service-role key client bundle scan clean, Zod validation verified on 100% of server actions across 9 modules, Rule R10 audit triggers verified across all 27 business tables, foreign key & filter column indexes applied (Migration 010), live restore verification on all 30 tables with 100% EXACT_MATCH, clean error message boundaries, mobile quick-log flows verified.

## Environment & Tooling Versions
- **Node.js:** `v24.14.1`
- **npm:** `11.11.0`
- **pnpm:** `11.15.0`
- **Git:** `2.43.0`
- **Supabase CLI:** `2.101.0` (Linked to remote project `rooaitpvnvmjtytzaukk`)
- **Docker:** `29.1.3`

## Package Versions (App)
- **next:** `16.4.2`
- **react:** `19.3.0`
- **react-dom:** `19.3.0`
- **@supabase/supabase-js:** `2.118.0`
- **@supabase/ssr:** `0.12.7`
- **tailwindcss:** `^4.0.0`
- **@tailwindcss/turbopack:** `^4.0.0`
- **lucide-react:** `^1.59.0`
- **zod:** `^4.6.7`
- **react-hook-form:** `^7.90.0`
- **@hookform/resolvers:** `^5.9.2`
- **date-fns:** `^4.4.0`
- **clsx:** `^2.1.1`
- **tailwind-merge:** `^3.7.0`
- **class-variance-authority:** `^0.7.1`
- **server-only:** `^0.0.1`
- **vitest:** `5.0.5`
- **typescript:** `^5.0.0`
- **eslint:** `^9.0.0`

## Known Issues / Environment Constraints
- None. All 16 tasks (T0 through T15), all 3 gates (G1, G2, G3), all 10 schema migrations, all 30 database tables, all 11 test suites (115/115 tests passing), and full RLS matrix verified and accepted.
