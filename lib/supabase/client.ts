import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  // Admin-portal session lives in the ws_adm cookie; the banner is the only browser-side user.
  return createBrowserClient(supabaseUrl, supabaseKey, { cookieOptions: { name: "ws_adm" } });
}
