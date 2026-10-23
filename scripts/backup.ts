import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Tables in strict foreign-key dependency order
const TABLES_IN_ORDER = [
  "project_stages",
  "profiles",
  "user_roles",
  "app_settings",
  "cost_categories",
  "lead_sources",
  "lost_reasons",
  "customers",
  "enquiries",
  "quotations",
  "enquiry_followups",
  "projects",
  "project_members",
  "project_milestones",
  "tasks",
  "task_comments",
  "site_reports",
  "payment_milestones",
  "invoices",
  "receipts",
  "budget_lines",
  "vendor_orders",
  "bills",
  "bill_payments",
  "documents",
  "project_commercials",
  "variation_orders",
  "bank_balances",
  "company_cash_items",
  "audit_log",
];

function escapeSqlValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `westeel_backup_${timestamp}.sql`);
  console.log(`Starting logical backup to ${backupFile}...`);

  const lines: string[] = [];
  lines.push(`-- ==============================================================================`);
  lines.push(`-- WESTEEL BUILDINGS - LOGICAL DATABASE BACKUP`);
  lines.push(`-- Generated: ${new Date().toISOString()} (UTC)`);
  lines.push(`-- Source: ${supabaseUrl}`);
  lines.push(`-- ==============================================================================\n`);

  // Section 1: Gather Row Counts and Data
  const summary: Record<string, number> = {};

  for (const table of TABLES_IN_ORDER) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.error(`Error dumping table ${table}:`, error);
      throw error;
    }

    const rows = data || [];
    summary[table] = rows.length;
    console.log(`- Dumped ${table}: ${rows.length} rows`);

    lines.push(`-- Data for table: public.${table} (${rows.length} rows)`);
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      for (const row of rows) {
        const values = columns.map((col) => escapeSqlValue(row[col])).join(", ");
        lines.push(
          `INSERT INTO public.${table} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values}) ON CONFLICT DO NOTHING;`
        );
      }
    }
    lines.push("");
  }

  fs.writeFileSync(backupFile, lines.join("\n"), "utf8");

  console.log("\n=================== BACKUP SUMMARY ===================");
  console.log(`Backup written to: ${backupFile}`);
  console.log(`Total tables dumped: ${TABLES_IN_ORDER.length}`);
  console.log("Row counts per table:");
  console.log(JSON.stringify(summary, null, 2));

  // Write a metadata json alongside the SQL file
  const metaFile = path.join(backupDir, `westeel_backup_${timestamp}.json`);
  fs.writeFileSync(
    metaFile,
    JSON.stringify(
      {
        backup_file: path.basename(backupFile),
        timestamp: new Date().toISOString(),
        supabase_url: supabaseUrl,
        tables_count: TABLES_IN_ORDER.length,
        row_counts: summary,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Metadata written to: ${metaFile}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
