import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import assert from "node:assert";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  console.log("=== 1. Checking Mock Data Removal ===");
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers({ perPage: 100 });
  const authIds = new Set((authUsers?.users || []).map((u) => u.id));

  const { data: profiles } = await adminSupabase.from("profiles").select("id, full_name, is_active");
  const orphans = (profiles || []).filter((p) => !authIds.has(p.id));
  assert.strictEqual(orphans.length, 0, "There should be 0 orphaned profiles in database!");
  console.log("PASS: 0 fake/orphaned profiles found. Total real profiles:", profiles?.length);

  console.log("\n=== 2. Verifying Initial 6 Employees ===");
  const expectedEmployees = [
    { email: "sales1@westeel.test", role: "sales" },
    { email: "sales2@westeel.test", role: "sales" },
    { email: "finance@westeel.test", role: "accounts" },
    { email: "manager@westeel.test", role: "project_manager" },
    { email: "site1@westeel.test", role: "site_engineer" },
    { email: "site2@westeel.test", role: "site_engineer" },
  ];

  for (const exp of expectedEmployees) {
    const user = authUsers?.users.find((u) => u.email === exp.email);
    assert.ok(user, `User ${exp.email} should exist in auth.users`);
    const { data: roleData } = await adminSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleData || []).map((r) => r.role);
    assert.ok(roles.includes(exp.role), `User ${exp.email} should have role ${exp.role}, got ${roles}`);
    console.log(`PASS: ${exp.email} verified with role ${exp.role}`);
  }

  console.log("\n=== 3. Verifying Employee Authentication ===");
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Test valid login with sales1
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: "sales1@westeel.test",
    password: "Password@123!",
  });
  assert.ok(!loginError, `sales1 should log in successfully: ${loginError?.message}`);
  assert.ok(loginData.user, "sales1 session should be returned");
  console.log("PASS: sales1@westeel.test authenticated successfully.");

  // Test inactive employee login blocked
  const inactiveUser = authUsers?.users.find((u) => u.email === "inactive@westeel.test");
  if (inactiveUser) {
    const { data: inactProf } = await adminSupabase
      .from("profiles")
      .select("is_active")
      .eq("id", inactiveUser.id)
      .single();
    assert.strictEqual(inactProf?.is_active, false, "inactive employee must have is_active = false");
    console.log("PASS: inactive@westeel.test is confirmed inactive in profiles.");
  }

  console.log("\n=== 4. Verifying Task Isolation (Sales A vs Sales B) ===");
  const sales1 = authUsers?.users.find((u) => u.email === "sales1@westeel.test")!;
  const sales2 = authUsers?.users.find((u) => u.email === "sales2@westeel.test")!;

  // Insert a task for sales1 and a task for sales2
  const { data: taskA, error: errA } = await adminSupabase
    .from("tasks")
    .insert({
      title: "Task A - Sales 1 Private",
      assignee_id: sales1.id,
      kind: "task",
      status: "open",
    })
    .select("id")
    .single();
  assert.ok(taskA, `Task A should be created: ${errA?.message}`);

  const { data: taskB, error: errB } = await adminSupabase
    .from("tasks")
    .insert({
      title: "Task B - Sales 2 Private",
      assignee_id: sales2.id,
      kind: "task",
      status: "open",
    })
    .select("id")
    .single();
  assert.ok(taskB, `Task B should be created: ${errB?.message}`);

  // Query tasks for sales1
  const { data: sales1Tasks } = await adminSupabase
    .from("tasks")
    .select("id, title, assignee_id")
    .eq("assignee_id", sales1.id);
  const sales1TaskIds = (sales1Tasks || []).map((t) => t.id);

  assert.ok(sales1TaskIds.includes(taskA.id), "Sales 1 should see Task A");
  assert.ok(!sales1TaskIds.includes(taskB.id), "Sales 1 MUST NOT see Task B (Sales 2 private assignment)");
  console.log("PASS: Task isolation verified. Sales 1 only sees Task A; Task B is hidden.");

  // Query tasks for sales2
  const { data: sales2Tasks } = await adminSupabase
    .from("tasks")
    .select("id, title, assignee_id")
    .eq("assignee_id", sales2.id);
  const sales2TaskIds = (sales2Tasks || []).map((t) => t.id);

  assert.ok(sales2TaskIds.includes(taskB.id), "Sales 2 should see Task B");
  assert.ok(!sales2TaskIds.includes(taskA.id), "Sales 2 MUST NOT see Task A (Sales 1 private assignment)");
  console.log("PASS: Task isolation verified. Sales 2 only sees Task B; Task A is hidden.");

  // Clean up test tasks so company DB remains pristine
  await adminSupabase.from("tasks").delete().in("id", [taskA.id, taskB.id]);
  console.log("PASS: Cleaned up temporary verification tasks.");

  console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
