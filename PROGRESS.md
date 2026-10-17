# Westeel Dashboard Build Progress

## Current Task
- **Task:** T0: Preflight (no application code)
- **Status:** DONE (Awaiting `APPROVED T0`)

## Overall Roadmap Status
- [x] **T0: Preflight** - Environment verification, dependencies audit, decisions log, roadmap initialization
- [ ] **T1: Scaffold** - Next.js, TypeScript, Tailwind, shadcn/ui, Supabase helpers, money utils, shells
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
*(Not yet installed - to be populated during T1)*
- Next.js: N/A
- React: N/A
- @supabase/supabase-js: N/A
- @supabase/ssr: N/A
- Tailwind CSS: N/A

## Known Issues / Environment Constraints
1. **Docker Socket Permission:** Running local Docker commands as `honey_badger` requires permission to `/var/run/docker.sock` (user not currently in `docker` group). If local Supabase containerization is desired, run `sudo usermod -aG docker $USER` or use remote `westeel-dev` directly.
2. **Git Repository Root:** The current working directory `/home/honey_badger/Code/Lab/westeel` is currently nested under a Git repository located at `/home/honey_badger`. An isolated Git repo should be initialized at `/home/honey_badger/Code/Lab/westeel` to avoid tracking unrelated home files.
