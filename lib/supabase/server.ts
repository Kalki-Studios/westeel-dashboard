import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/** Sessions live in the portal cookie (ws_adm / ws_emp), never the default Supabase cookie. */
async function portalCookieName(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const h = await headers();
  const portal = h.get("x-portal"); // set by middleware on portal pages and their server actions
  if (portal === "ws_adm" || portal === "ws_emp") return portal;

  // Routes outside the middleware matcher (e.g. /api/documents): infer from the page that called us.
  try {
    const path = new URL(h.get("referer") ?? "").pathname;
    if (path.startsWith("/employee")) return "ws_emp";
    if (path.startsWith("/x9admin")) return "ws_adm";
  } catch {}
  return cookieStore.getAll().some((c) => c.name.startsWith("ws_adm")) ? "ws_adm" : "ws_emp";
}

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: { name: await portalCookieName(cookieStore) },
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
          // Called from a Server Component; middleware refreshes the session.
        }
      },
    },
  });
}
