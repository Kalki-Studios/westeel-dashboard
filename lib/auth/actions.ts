"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminPortalClient as createClient } from "@/lib/supabase/server-admin";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LoginSchema,
  ResetPasswordRequestSchema,
  UpdatePasswordSchema,
  UpdateDirectorAccountSchema,
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

  let { email, password } = parsed.data;
  let cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes("@")) {
    cleanEmail = `${cleanEmail}@westeel.test`;
  }
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
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
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");

    if (verifiedTotp) {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: verifiedTotp.id,
      });

      if (!challengeErr && challenge) {
        return {
          requiresMfa: true,
          factorId: verifiedTotp.id,
          challengeId: challenge.id,
        };
      }
    }

    revalidatePath("/x9admin");
    redirect("/x9admin");
  }

  // Employees use /employee; they get no admin session at all.
  await supabase.auth.signOut();
  return { error: "Invalid email or password" };
}

/**
 * Check if the director account has an active, verified TOTP factor (Google Authenticator).
 */
export async function checkDirectorMfaStatus(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: roleData } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "director")
      .limit(1)
      .maybeSingle();

    let directorUserId = roleData?.user_id;


    if (!directorUserId) return false;

    const { data: factorsData, error } = await admin.auth.admin.mfa.listFactors({
      userId: directorUserId,
    });

    if (error || !factorsData?.factors) return false;

    return factorsData.factors.some(
      (f) => f.status === "verified" && f.factor_type === "totp"
    );
  } catch (err) {
    console.error("Error checking director MFA status:", err);
    return false;
  }
}

/**
 * Direct MFA login for Director when Google Authenticator is configured.
 * Asks ONLY for the 6-digit Google Authenticator code without email/password boxes.
 */
export async function loginWithMfaAction(prevState: unknown, formData: FormData) {
  const code = ((formData.get("code") as string) || "").trim();

  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return { error: "Please enter a valid 6-digit code from Google Authenticator." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: role } = await admin.from("user_roles").select("user_id").eq("role", "director").limit(1).maybeSingle();
  const { data: director } = role ? await admin.auth.admin.getUserById(role.user_id) : { data: null };
  if (!director?.user?.email) return { error: "Director account not found." };

  // No password is stored anywhere: sign in with a one-time link, then the authenticator code is the gate.
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: director.user.email });
  const { error: authError } = link?.properties?.hashed_token
    ? await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token })
    : { error: new Error("Could not start sign-in") };

  if (authError) {
    return { error: "Director sign-in could not be started." };
  }

  // Find verified TOTP factor
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");

  if (!verifiedTotp) {
    // No verified TOTP factor exists; session is only AAL1, redirect to refresh view
    revalidatePath("/x9admin");
    redirect("/x9admin");
  }

  const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
    factorId: verifiedTotp.id,
    code,
  });

  if (verifyErr) {
    await supabase.auth.signOut();
    return { error: "Invalid 6-digit code. Please check Google Authenticator and enter the active code." };
  }

  revalidatePath("/x9admin");
  redirect("/x9admin");
}

/**
 * Verify TOTP code for MFA challenge during director login (fallback step).
 */
export async function verifyMfaAction(prevState: unknown, formData: FormData) {
  const factorId = formData.get("factorId") as string;
  const challengeId = formData.get("challengeId") as string;
  const code = ((formData.get("code") as string) || "").trim();

  if (!code || code.length !== 6) {
    return { error: "Please enter a valid 6-digit code from Google Authenticator" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  });

  if (error) {
    return { error: "Invalid 6-digit code. Please check your phone and try the latest code." };
  }

  revalidatePath("/x9admin");
  redirect("/x9admin");
}

/** Delete every MFA factor of the director account (service role). */
async function removeDirectorFactors(directorUserId: string) {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.mfa.listFactors({ userId: directorUserId });
  for (const factor of data?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: directorUserId, id: factor.id });
  }
  revalidatePath("/x9admin");
}

/**
 * Unpair Google Authenticator. Only a signed-in director who has passed MFA (AAL2) may call this:
 * server actions are public endpoints, so the check must live here, not in the UI.
 */
/** Signed-in director who has passed MFA (AAL2) when it is enrolled. Server actions are public, so check here. */
async function getVerifiedDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." } as const;

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles || []).some((r) => r.role === "director")) return { error: "Directors only." } as const;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { error: "Verify your authenticator code first." } as const;
  }
  return { user, supabase } as const;
}

export async function resetDirectorMfaAction() {
  const auth = await getVerifiedDirector();
  if ("error" in auth) return { error: auth.error };
  const user = auth.user;

  await removeDirectorFactors(user.id);
  return { success: true, message: "Google Authenticator removed. Phone unpaired successfully." };
}

/** Director changes their own name, login email and/or password. Needs the current password. */
export async function updateDirectorAccountAction(prevState: unknown, formData: FormData) {
  const auth = await getVerifiedDirector();
  if ("error" in auth) return { error: auth.error };
  const user = auth.user;

  const parsed = UpdateDirectorAccountSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };
  const { fullName, email, currentPassword, newPassword } = parsed.data;

  // Re-check the password on a throwaway client so this session is untouched.
  const probe = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: pwError } = await probe.auth.signInWithPassword({ email: user.email!, password: currentPassword });
  if (pwError) return { error: "Current password is incorrect." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
    ...(newPassword ? { password: newPassword } : {}),
  });
  if (error) return { error: error.message };

  await admin.from("profiles").update({ full_name: fullName }).eq("id", user.id);

  revalidatePath("/x9admin");
  return { success: true };
}

/**
 * Lost-phone recovery from the login screen. Needs DIRECTOR_RECOVERY_CODE, a secret separate from the
 * login password; if it is not set, recovery is disabled.
 */
export async function resetDirectorMfaWithPasscodeAction(prevState: unknown, formData: FormData) {
  const passcode = ((formData.get("passcode") as string) || "").trim();
  const expected = process.env.DIRECTOR_RECOVERY_CODE;

  if (!expected) return { error: "Recovery is disabled. Set DIRECTOR_RECOVERY_CODE on the server." };
  if (passcode !== expected) return { error: "Invalid recovery code." };

  const { data: role } = await createAdminClient()
    .from("user_roles")
    .select("user_id")
    .eq("role", "director")
    .limit(1)
    .maybeSingle();
  if (!role) return { error: "Director account not found" };

  await removeDirectorFactors(role.user_id);
  return { success: true };
}

/**
 * Sign out current authenticated session.
 */
/** Sign out of the admin portal only — does not touch the employee session. */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/x9admin");
  redirect("/x9admin");
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

  let { email, password, fullName, designation, phone, roles } = parsed.data;
  let cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes("@")) {
    cleanEmail = `${cleanEmail}@westeel.test`;
  }

  // 3. Create auth user using server-only service-role client
  const adminSupabase = createAdminClient();
  const { data: newAuthUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email: cleanEmail,
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

  const { id, fullName, email, password, designation, phone, roles, isActive } = parsed.data;
  const adminSupabase = createAdminClient();

  // If email or password provided, update auth user via admin client
  const authUpdates: { email?: string; password?: string } = {};
  if (email && email.trim()) {
    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      cleanEmail = `${cleanEmail}@westeel.test`;
    }
    authUpdates.email = cleanEmail;
  }
  if (password && password.trim().length >= 6) {
    authUpdates.password = password.trim();
  }

  if (Object.keys(authUpdates).length > 0) {
    const { error: authErr } = await adminSupabase.auth.admin.updateUserById(id, authUpdates);
    if (authErr) {
      return { error: `Auth credentials update failed: ${authErr.message}` };
    }
  }

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

  // If deactivated, revoke active sessions immediately
  if (!isActive) {
    try {
      await adminSupabase.auth.admin.signOut(id);
    } catch (e) {
      console.error("Failed to revoke session on employee update:", e);
    }
  }

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

  // If deactivated, revoke active sessions immediately
  if (!isActive) {
    try {
      await adminSupabase.auth.admin.signOut(id);
    } catch (e) {
      console.error("Failed to revoke session on deactivation:", e);
    }
  }

  revalidatePath("/x9admin/employees");
  return { success: true };
}

/**
 * Privileged Action: Permanently delete an employee account.
 * Revokes session, then hard-deletes the auth user (profiles/user_roles cascade).
 */
export async function deleteEmployeeAction(id: string) {
  const callerSupabase = await createClient();
  const { data: { user } } = await callerSupabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };
  if (user.id === id) return { error: "You cannot delete your own account." };

  const { data: isDir } = await callerSupabase.rpc("is_director");
  if (!isDir) return { error: "Forbidden: Only the director can delete employees." };

  const adminSupabase = createAdminClient();

  // Revoke active sessions first
  try { await adminSupabase.auth.admin.signOut(id); } catch { /* best-effort */ }

  const { error } = await adminSupabase.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/x9admin/employees");
  return { success: true };
}

