import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
  console.log("=== Auth Users (" + (users?.users?.length || 0) + ") ===");
  console.table(users?.users?.map(u => ({ id: u.id, email: u.email })));

  const { data: profiles } = await supabase.from("profiles").select("id, full_name, designation, is_active");
  console.log("=== Profiles (" + (profiles?.length || 0) + ") ===");
  console.table(profiles);

  const { data: roles } = await supabase.from("user_roles").select("*");
  console.log("=== User Roles (" + (roles?.length || 0) + ") ===");
  console.table(roles);

  const { data: projects } = await supabase.from("projects").select("id, code, name, is_archived");
  console.log("=== Projects (" + (projects?.length || 0) + ") ===");
  console.table(projects);

  const { data: tasks } = await supabase.from("tasks").select("id, title, assigned_to, status");
  console.log("=== Tasks (" + (tasks?.length || 0) + ") ===");
  console.table(tasks);
}

main().catch(console.error);
