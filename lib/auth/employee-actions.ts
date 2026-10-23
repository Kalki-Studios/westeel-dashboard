"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createEmployeePortalClient } from "@/lib/supabase/server-employee";
import { LoginSchema } from "./types";

/**
 * Employee login — uses the employee-portal cookie namespace (ws_emp_*).
 * Director credentials are rejected here; directors must use /x9admin.
 */
export async function employeeLoginAction(prevState: unknown, formData: FormData) {
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

  const supabase = await createEmployeePortalClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (authError || !authData.user) {
    return { error: "Invalid username or password" };
  }

  // Block deactivated accounts
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", authData.user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Your account is deactivated. Contact the director." };
  }

  // Block directors from using the employee portal login
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id);

  const isDirector = (roles || []).some((r) => r.role === "director");
  if (isDirector) {
    await supabase.auth.signOut();
    return { error: "Director accounts must sign in at the admin portal." };
  }

  revalidatePath("/employee");
  redirect("/employee");
}

/**
 * Employee logout — clears only the employee-portal cookie (ws_emp_*).
 */
export async function employeeLogoutAction() {
  const supabase = await createEmployeePortalClient();
  await supabase.auth.signOut();
  revalidatePath("/employee");
  redirect("/employee");
}
