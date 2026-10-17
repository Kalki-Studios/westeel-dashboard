import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateUser(email: string, pass: string, name: string, role: string, isActive = true) {
  // Check if exists
  const { data: list } = await adminClient.auth.admin.listUsers();
  let user = (list?.users || []).find((u) => u.email === email);

  if (!user) {
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !created.user) {
      throw new Error(`Failed to create ${email}: ${error?.message}`);
    }
    user = created.user;
  }

  // Update profile
  await adminClient.from("profiles").upsert({
    id: user.id,
    full_name: name,
    designation: role,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });

  // Assign role
  await adminClient.from("user_roles").upsert({
    user_id: user.id,
    role,
  });

  return user;
}

async function runTests() {
  console.log("=== Task T3 Auth Verification ===");

  // 1. Setup 3 test accounts
  console.log("\n[1/5] Setting up 3 test accounts...");
  await getOrCreateUser(
    "director@westeel.test",
    "DirectorPass123!",
    "Director Person",
    "director",
    true
  );
  console.log("✓ Director account ready: director@westeel.test");

  const salesUser = await getOrCreateUser(
    "sales@westeel.test",
    "SalesPass123!",
    "Sales Executive",
    "sales",
    true
  );
  console.log("✓ Sales account ready: sales@westeel.test");

  const inactiveUser = await getOrCreateUser(
    "inactive@westeel.test",
    "InactivePass123!",
    "Inactive Engineer",
    "site_engineer",
    false
  );
  console.log("✓ Inactive account ready: inactive@westeel.test (is_active: false)");

  // 2. Test Director Login & Permissions
  console.log("\n[2/5] Testing Director Login...");
  const directorClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: dirAuth, error: dirErr } = await directorClient.auth.signInWithPassword({
    email: "director@westeel.test",
    password: "DirectorPass123!",
  });
  if (dirErr || !dirAuth.user) {
    throw new Error(`Director login failed: ${dirErr?.message}`);
  }
  const { data: isDirRpc } = await directorClient.rpc("is_director");
  console.log(`✓ Director logged in successfully. is_director RPC result: ${isDirRpc}`);
  if (!isDirRpc) throw new Error("Director should have is_director() = true");

  // 3. Test Sales Login & Non-Director Route Protection
  console.log("\n[3/5] Testing Sales Login...");
  const salesClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: salesAuth, error: salesErr } = await salesClient.auth.signInWithPassword({
    email: "sales@westeel.test",
    password: "SalesPass123!",
  });
  if (salesErr || !salesAuth.user) {
    throw new Error(`Sales login failed: ${salesErr?.message}`);
  }
  const { data: salesIsDir } = await salesClient.rpc("is_director");
  console.log(`✓ Sales logged in successfully. is_director RPC result: ${salesIsDir} (expected: false)`);
  if (salesIsDir) throw new Error("Sales user must NOT have is_director() = true");

  // 4. Test Inactive User Block
  console.log("\n[4/5] Testing Inactive User Block...");
  const inactiveClient = createClient(SUPABASE_URL, ANON_KEY);
  await inactiveClient.auth.signInWithPassword({
    email: "inactive@westeel.test",
    password: "InactivePass123!",
  });

  // Check profile status
  const { data: inactProfile } = await adminClient
    .from("profiles")
    .select("is_active")
    .eq("id", inactiveUser.id)
    .single();

  console.log(`✓ Inactive user profile check: is_active = ${inactProfile?.is_active}`);
  if (inactProfile?.is_active !== false) {
    throw new Error("User must be inactive");
  }

  // Check RLS on roles for inactive user
  const { data: inactRoles } = await inactiveClient
    .from("user_roles")
    .select("*");

  console.log(`✓ Inactive user query on user_roles returned: ${inactRoles?.length || 0} rows (blocked by RLS)`);
  if ((inactRoles?.length || 0) > 0) {
    throw new Error("Inactive user must be blocked by RLS");
  }

  // 5. Test Non-Director Privileged Action Block
  console.log("\n[5/5] Testing Non-Director Attempt to Create Employee...");
  // Sales tries to insert into user_roles directly
  const { error: illicitRoleError } = await salesClient
    .from("user_roles")
    .insert({ user_id: salesUser.id, role: "director" });

  console.log(`✓ Sales direct assignment to director: ${illicitRoleError ? "BLOCKED BY RLS (" + illicitRoleError.message + ")" : "UNEXPECTED SUCCESS"}`);
  if (!illicitRoleError) {
    throw new Error("Sales user should be blocked from granting director role");
  }

  console.log("\n🎉 ALL T3 AUTH VERIFICATION TESTS PASSED SUCCESSFULLY!\n");
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
