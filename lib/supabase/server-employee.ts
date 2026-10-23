import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase client scoped to the employee portal — uses ws_emp_ cookie prefix. */
export async function createEmployeePortalClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: { name: "ws_emp" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignored in Server Components; middleware refreshes the session.
        }
      },
    },
  });
}
