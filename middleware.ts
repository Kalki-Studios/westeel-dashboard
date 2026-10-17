import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/reset-password");
  const isAdminRoute = pathname.startsWith("/x9admin") || pathname.startsWith("/admin");

  // Fetch current authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // If visiting admin route, strict verification is required
  if (isAdminRoute) {
    if (!user) {
      // In development, if no user session exists yet, redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify active status & director role
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.is_active) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "account_deactivated");
      return NextResponse.redirect(loginUrl);
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isDirector = (roles || []).some((r) => r.role === "director");
    if (!isDirector) {
      // Non-director attempted to open admin route -> redirect to employee
      return NextResponse.redirect(new URL("/employee", request.url));
    }
  }

  // If user is logged in and visits login page, redirect to their home
  if (isAuthRoute && user) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isDirector = (roles || []).some((r) => r.role === "director");
    return NextResponse.redirect(
      new URL(isDirector ? "/x9admin" : "/employee", request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/x9admin/:path*",
    "/admin/:path*",
    "/login",
    "/reset-password",
  ],
};
