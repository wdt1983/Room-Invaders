import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Updates the Supabase auth session by refreshing expired tokens.
 *
 * Called from the Next.js middleware on every matched request.
 * This ensures the session is always fresh before reaching any
 * Server Component or Route Handler.
 *
 * Returns the (potentially modified) response with updated cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Recreate response with updated request headers
          supabaseResponse = NextResponse.next({
            request,
          });

          // Set cookies on the response (for the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Use getUser() not getSession() — getUser() validates
  // the JWT against the Supabase Auth server, preventing token spoofing.
  // Do NOT remove this call — it triggers the token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // --- Route-guarding logic ---

  // Protected game route prefixes — unauthenticated users get redirected to /login
  const protectedPrefixes = ["/room", "/map", "/raid", "/quests", "/profile"];
  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Auth route paths — authenticated users get redirected to /room
  const authRoutes = ["/login", "/register"];
  const isAuthRoute = authRoutes.includes(pathname);

  // Rule 1: Protect game routes — redirect unauthenticated users to /login
  if (!user && isProtectedRoute) {
    const redirectUrl = new URL("/login", request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Preserve refreshed session cookies on the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Rule 2: Bypass auth routes — redirect authenticated users to /room
  if (user && isAuthRoute) {
    const redirectUrl = new URL("/room", request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Preserve refreshed session cookies on the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
