"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LoginSchema,
  ResetPasswordRequestSchema,
  UpdatePasswordSchema,
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  AppRole,
} from "./types";

/**
 * Login user and route according to role priority (Director -> /x9admin, Others -> /employee).
 * Blocks deactivated users immediately.
 */
export async function loginAction(prevState: unknown, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = LoginSchema.safeParse(rawData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "Invalid email or password" };
  }

  // Verify active profile status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Your account is deactivated. Contact the director." };
  }

  // Check roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id);

  const roleList = (roles || []).map((r) => r.role as AppRole);
  const isDirector = roleList.includes("director");

  if (isDirector) {
    redirect("/x9admin");
  } else {
    redirect("/employee");
  }
}

/**
 * Sign out current authenticated session.
 */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Request password reset email.
 */
export async function requestPasswordResetAction(prevState: unknown, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = ResetPasswordRequestSchema.safeParse(rawData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid email" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password reset link sent to your email." };
}

/**
 * Update authenticated user's password.
 */
export async function updatePasswordAction(prevState: unknown, formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = UpdatePasswordSchema.safeParse(rawData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid password" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password updated successfully." };
}

/**
 * Privileged Action: Create new employee account.
 * Requires caller to be an active Director.
 */
export async function createEmployeeAction(data: unknown) {
  // 1. Authorize calling session
  const callerSupabase = await createClient();
  const { data: { user } } = await callerSupabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Sign in required." };
  }

  const { data: isDir } = await callerSupabase.rpc("is_director");
  if (!isDir) {
    return { error: "Forbidden: Only the director can create employee accounts." };
  }

  // 2. Validate payload
  const parsed = CreateEmployeeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid employee details." };
  }

  const { email, password, fullName, designation, phone, roles } = parsed.data;

  // 3. Create auth user using server-only service-role client
  const adminSupabase = createAdminClient();
  const { data: newAuthUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      designation: designation || "Staff",
    },
  });

  if (createError || !newAuthUser.user) {
    return { error: createError?.message || "Failed to create user account." };
  }

  const newUserId = newAuthUser.user.id;

  // 4. Update profile details
  await adminSupabase
    .from("profiles")
    .update({
      full_name: fullName,
      designation,
      phone: phone || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", newUserId);

  // 5. Assign roles
  const roleInserts = roles.map((role) => ({
    user_id: newUserId,
    role,
  }));

  const { error: roleError } = await adminSupabase
    .from("user_roles")
    .insert(roleInserts);

  if (roleError) {
    return { error: `User created, but role assignment failed: ${roleError.message}` };
  }

  revalidatePath("/x9admin/employees");
  return { success: true, userId: newUserId };
}

/**
 * Privileged Action: Update an existing employee profile and roles.
 */
export async function updateEmployeeAction(data: unknown) {
  const callerSupabase = await createClient();
  const { data: { user } } = await callerSupabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: isDir } = await callerSupabase.rpc("is_director");
  if (!isDir) {
    return { error: "Forbidden: Only the director can edit employees." };
  }

  const parsed = UpdateEmployeeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid update data." };
  }

  const { id, fullName, designation, phone, roles, isActive } = parsed.data;
  const adminSupabase = createAdminClient();

  // Update profile
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({
      full_name: fullName,
      designation,
      phone: phone || null,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (profileError) {
    return { error: profileError.message };
  }

  // Synchronize roles: delete removed, insert added
  await adminSupabase.from("user_roles").delete().eq("user_id", id);
  const roleInserts = roles.map((role) => ({
    user_id: id,
    role,
  }));
  await adminSupabase.from("user_roles").insert(roleInserts);

  revalidatePath("/x9admin/employees");
  return { success: true };
}

/**
 * Privileged Action: Deactivate or reactivate an employee.
 */
export async function toggleEmployeeStatusAction(id: string, isActive: boolean) {
  const callerSupabase = await createClient();
  const { data: { user } } = await callerSupabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: isDir } = await callerSupabase.rpc("is_director");
  if (!isDir) {
    return { error: "Forbidden: Only the director can modify employee status." };
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("profiles")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/employees");
  return { success: true };
}
