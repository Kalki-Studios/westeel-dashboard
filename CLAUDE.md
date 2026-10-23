# Westeel Buildings: project rules

@AGENTS.md

Dashboard for Westeel Building (OPC) Pvt. Ltd. (founder: Manoranjan Pradhan). The director assigns work to 6-8 employees and follows up from anywhere. Read this file before starting any task. When the user states a new rule, add it under the right heading below.

## How to work
- Write only the code the task needs. No extra features, abstractions or files. Match the surrounding code.
- One page or one concern per request. Use the shared pieces already in `components/` and `app/globals.css` before adding new ones.
- If the user says "no need to code" or asks a question first, answer only. Build after they confirm.
- Never run `git push` (or any git command that publishes: push, pull request, release, tag push). The user pushes and deploys everything themselves. Committing only if the user asks.
- Explain results in plain language, short, and end with what the user has to do (if anything).
- Say plainly what was and was not checked. Never claim a UI change works in the browser unless it was seen.

## Look and feel
- Minimal and premium glassmorphism. Classes live in `app/globals.css` (`glass-canvas`, `glass`, `glass-card*`, `glass-panel`); sentence-case labels, light weights, soft greys.
- Keep screens free of filler: no rule codes ("R1", "F3", "Rule S5"), no subtitle under every heading, no "Live", "v1.0" or role chips. Keep real data and required disclaimers (the cash-flow `mandatory_label`).
- Mobile first. Every page must work on a phone: sidebar is a drawer below `md`, tables scroll sideways, grids stack, popups scroll, inputs are 16px.

## Accounts and access
- Admin dashboard (`/x9admin`): only the director account may log in (currently `westeel.peb@gmail.com`). Every other login is rejected. The director changes their own name, email and password in Settings → Account; no password is stored in `.env.local`. With 2FA paired, the login screen asks only for the authenticator code.
- Director must have Google Authenticator (TOTP) paired; the dashboard stays locked until it is.
- Employees log in at `/employee` with their own username and password, created from the admin Employees page. No shared passwords, no seeded demo accounts.
- Sessions are in portal cookies: `ws_adm` (admin) and `ws_emp` (employee). Always use the portal-aware clients; `lib/supabase/server.ts` picks the right one from the `x-portal` header set in `middleware.ts`.
- Server actions are public endpoints. Check the signed-in user and role inside every action; never rely on the UI hiding a button.
- Never hardcode passwords, keys, emails or connection strings in code. Secrets go in `.env.local` (git-ignored).

## Roles
- One role per employee, chosen from a dropdown: Project Manager, Sales: Lead Generation & Meetings, Sales: Field Visits & Closing, Purchase Officer, Site Engineer, Accounts & Billing. The director is not in the list.
- The two sales types also carry the umbrella `sales` role. Lead generator (A): adds leads and customers, books the meeting, hands the lead to a field salesperson; cannot quote or change status. Field salesperson (B): visits clients, quotes, marks Won/Lost; cannot create leads. Only the director turns a won deal into a project.
- Private to each person: their assigned tasks, their own leads, their own numbers and logs. Only Accounts (and the director) see invoices, bills, bank balances; no employee sees cash flow, project profit, the employee list, settings or the audit log.

## Database
- Schema changes are numbered files in `supabase/migrations/` (next is `013`). Enum values added with `ALTER TYPE` go in their own file, before the file that uses them.
- The user applies migrations in the Supabase SQL Editor (the direct DB host is IPv6-only and not reachable from this machine). Do not run migrations against the live database yourself unless the user approves that exact step.
- Take `npm run backup` before any delete, reset or bulk change to live data. Look at what will be affected first.
- Employees with activity cannot be deleted (the audit log points at them). Deactivate them instead.
- Money is stored in paise; business dates and times are IST.

## Done means
- `npx tsc --noEmit` passes. For logic or access-rule changes, test against the real database with temporary accounts, then clean them up.
