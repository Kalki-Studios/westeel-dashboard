import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function makeClient(request: NextRequest, response: NextResponse, cookieName: string) {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Mutate the shared response object so cookies are forwarded
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Tell server components/actions which portal cookie holds this request's session.
  const headers = new Headers(request.headers);
  headers.delete("x-portal");
  if (pathname.startsWith("/employee")) headers.set("x-portal", "ws_emp");
  else if (pathname.startsWith("/x9admin") || pathname.startsWith("/admin")) headers.set("x-portal", "ws_adm");
  let response = NextResponse.next({ request: { headers } });

  // Redirect legacy /login to home
  if (pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/x9admin") || pathname.startsWith("/admin")) {
    // Admin routes: check ws_adm_ session
    const supabase = makeClient(request, response, "ws_adm");
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .single();

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/x9admin", request.url));
      }
    }
    return response;
  }

  if (pathname.startsWith("/employee")) {
    // Employee routes: check ws_emp_ session
    const supabase = makeClient(request, response, "ws_emp");
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .single();

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/employee?deactivated=1", request.url));
      }
    }
    return response;
  }

  if (pathname.startsWith("/reset-password")) {
    // Try employee session first, then admin
    const empClient = makeClient(request, response, "ws_emp");
    const { data: { user: empUser } } = await empClient.auth.getUser();
    if (empUser) return NextResponse.redirect(new URL("/employee", request.url));

    const admClient = makeClient(request, response, "ws_adm");
    const { data: { user: admUser } } = await admClient.auth.getUser();
    if (admUser) return NextResponse.redirect(new URL("/x9admin", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/x9admin/:path*",
    "/admin/:path*",
    "/login",
    "/reset-password",
    "/employee/:path*",
  ],
};
