import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const tables = [
    "profiles", "user_roles", "projects", "tasks", "site_reports",
    "invoices", "receipts", "vendor_orders", "bills", "bank_balances",
    "company_cash_items", "customers", "enquiries", "quotations", "documents"
  ];

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`${t}: ${count} rows`);
  }
}

main().catch(console.error);
