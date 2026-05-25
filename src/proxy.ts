import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js Proxy
 *
 * Runs on every matched request to:
 * 1. Refresh the Supabase auth session (token rotation)
 * 2. Redirect unauthenticated users away from game routes → /login
 * 3. Redirect authenticated users away from auth routes → /room
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - icons/ (PWA icons)
     * - assets/ (game assets)
     * - sw.js (service worker)
     * - manifest.webmanifest
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|assets/|sw\\.js|manifest\\.webmanifest).*)",
  ],
};
