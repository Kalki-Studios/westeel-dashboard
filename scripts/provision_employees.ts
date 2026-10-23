import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createAdmin();

function createAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 6 initial employees specified in requirement:
// 2 Sales, 1 Finance (accounts), 1 Manager (project_manager), 2 Site Engineers (site_engineer)
const INITIAL_EMPLOYEES = [
  {
    email: "sales1@westeel.test",
    password: "Password@123!",
    fullName: "Sales Executive 1",
    designation: "Sales Executive",
    roles: ["sales"],
  },
  {
    email: "sales2@westeel.test",
    password: "Password@123!",
    fullName: "Sales Executive 2",
    designation: "Sales Executive",
    roles: ["sales"],
  },
  {
    email: "finance@westeel.test",
    password: "Password@123!",
    fullName: "Finance Officer",
    designation: "Finance & Accounts",
    roles: ["accounts"],
  },
  {
    email: "manager@westeel.test",
    password: "Password@123!",
    fullName: "Project Manager",
    designation: "Project Manager",
    roles: ["project_manager"],
  },
  {
    email: "site1@westeel.test",
    password: "Password@123!",
    fullName: "Site Engineer 1",
    designation: "Site Engineer",
    roles: ["site_engineer"],
  },
  {
    email: "site2@westeel.test",
    password: "Password@123!",
    fullName: "Site Engineer 2",
    designation: "Site Engineer",
    roles: ["site_engineer"],
  },
];

async function run() {
  console.log("1. Removing orphaned mock/test profiles...");
  // List all real auth users
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (usersErr) throw usersErr;

  const validAuthIds = new Set((usersData?.users || []).map((u) => u.id));
  console.log("Current valid auth users count:", validAuthIds.size);

  // Fetch all profiles
  const { data: profiles, error: profErr } = await supabase.from("profiles").select("id, full_name");
  if (profErr) throw profErr;

  const orphanedIds = (profiles || [])
    .filter((p) => !validAuthIds.has(p.id))
    .map((p) => p.id);

  console.log(`Found ${orphanedIds.length} orphaned mock profiles to remove.`);

  if (orphanedIds.length > 0) {
    // Delete associated user_roles for orphans
    const { error: rErr } = await supabase.from("user_roles").delete().in("user_id", orphanedIds);
    if (rErr) console.warn("Error deleting orphaned roles:", rErr.message);

    // Delete orphaned profiles
    const { error: pErr } = await supabase.from("profiles").delete().in("id", orphanedIds);
    if (pErr) console.warn("Error deleting orphaned profiles:", pErr.message);

    console.log("Successfully removed orphaned mock profiles.");
  }

  console.log("2. Provisioning 6 initial employee accounts...");
  for (const emp of INITIAL_EMPLOYEES) {
    const existing = (usersData?.users || []).find(
      (u) => u.email?.toLowerCase() === emp.email.toLowerCase()
    );

    let userId: string;

    if (!existing) {
      console.log(`Creating auth user: ${emp.email}`);
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: emp.email,
        password: emp.password,
        email_confirm: true,
        user_metadata: {
          full_name: emp.fullName,
          designation: emp.designation,
        },
      });

      if (createErr || !created.user) {
        console.error(`Failed to create ${emp.email}:`, createErr?.message);
        continue;
      }
      userId = created.user.id;
    } else {
      userId = existing.id;
      console.log(`User ${emp.email} already exists (${userId}), updating password & metadata...`);
      await supabase.auth.admin.updateUserById(userId, {
        password: emp.password,
        email_confirm: true,
        user_metadata: {
          full_name: emp.fullName,
          designation: emp.designation,
        },
      });
    }

    // Upsert profile
    const { error: upProfErr } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: emp.fullName,
      designation: emp.designation,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
    if (upProfErr) {
      console.error(`Profile upsert error for ${emp.email}:`, upProfErr.message);
    }

    // Assign roles
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const roleRows = emp.roles.map((r) => ({
      user_id: userId,
      role: r,
    }));
    const { error: roleErr } = await supabase.from("user_roles").insert(roleRows);
    if (roleErr) {
      console.error(`Role insert error for ${emp.email}:`, roleErr.message);
    }

    console.log(`Provisioned ${emp.email} with role(s): ${emp.roles.join(", ")}`);
  }

  console.log("3. Verification of final users & profiles:");
  const { data: finalProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, designation, is_active");
  console.table(finalProfiles);
}

run().catch(console.error);
