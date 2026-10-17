import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client initialized with the SERVICE_ROLE_KEY.
 * STRICT SECURITY RULE (PROJECT_BRIEF.md Section 1.4):
 * - Never expose service-role client to browser components or client actions.
 * - Used strictly for privileged identity administration (e.g. employee creation).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
