# Westeel Dashboard Build Progress

## Current Task
- **Task:** T1: Scaffold
- **Status:** DONE (Awaiting `APPROVED T1`)

## Overall Roadmap Status
- [x] **T0: Preflight** - Environment verification, dependencies audit, decisions log, roadmap initialization
- [x] **T1: Scaffold** - Next.js, TypeScript, Tailwind, shadcn/ui helpers, Supabase helpers, money utils, layouts, `/api/health`
- [ ] **T2: Database foundation** - Initial schema migration, RLS, audit log triggers, RLS tests
- [ ] **T3: Authentication & employee management** - Auth flows, middleware guards, MFA, employee management
- [ ] **T4: Projects, stages, members, milestones** - Projects CRUD, stages, milestones, delay detection
- [ ] **T5: Tasks and issues** - Task management, blockers, issue escalation
- [ ] **T6: Documents core & drawing approvals** - Storage bucket, revisions, drawing review workflow
- [ ] **T7: Daily site reports with photos** - Mobile-first site reports, compression, offline draft, review
- [ ] **T8: Director Overview (Block 1) & employee "My work"** - Status and delays block, alert engine
- [ ] **T9: Production deployment, backups, restore test** - Vercel, Supabase prod, pg_dump backup & restore test
- [ ] **GATE G1: Real usage trial (1 week)**
- [ ] **T10: Customer billing and collections** - Commercials, variations, milestones, invoices, receipts, aging
- [ ] **T11: Vendor orders, project costs, payables, forecast** - Orders, bills, payments, cost states, forecast
- [ ] **T12: Cash flow** - Bank balances, company cash items, 30-90 day projection, shortfall alerts
- [ ] **GATE G2: Finance reconciliation (2 weeks)**
- [ ] **T13: Sales data capture & conversion** - Customers, enquiries, quick-log, quotations, project conversion
- [ ] **T14: Sales tracker dashboard** - Period metrics, cohort funnel, cycle time, conversion breakdowns
- [ ] **GATE G3: Sales tracking trial (2 weeks)**
- [ ] **T15: Hardening and final acceptance** - RLS matrix, security checks, accessibility, bug fixes

## Environment & Tooling Versions
- **Node.js:** `v24.14.1`
- **npm:** `11.11.0`
- **pnpm:** `11.15.0`
- **Git:** `2.43.0`
- **Supabase CLI:** `2.101.0`
- **Docker:** `29.1.3` (daemon active, non-root socket permission requires user group configuration)

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
- **vitest:** `5.0.5`
- **typescript:** `^5.0.0`
- **eslint:** `^9.0.0`

## Known Issues / Environment Constraints
1. **Docker Socket Permission:** Local Docker requires membership in the `docker` group (`sudo usermod -aG docker honey_badger`) for local Supabase Docker instances. Direct remote Supabase integration (`westeel-dev`) is configured and functional via `@supabase/ssr` / `.env.local`.
2. **Git Tracking Verification:** `.env.local` confirmed untracked and gitignored; `.env.example` committed with blank keys.
