import { NextResponse, type NextRequest } from "next/server";
import { selectionLoginLocation } from "../../lib/auth-session/loginRedirect";
import {
  buildSafeRedirectPath,
  isSelectionPagePath,
} from "../../lib/auth-session/paths";
import { createSharedServerClient } from "../../lib/auth-session/supabaseClients";

function redirectToHubLogin(req: NextRequest) {
  const location = selectionLoginLocation({
    redirectPath: buildSafeRedirectPath(req.nextUrl.pathname, req.nextUrl.search ?? ""),
    forwardedHost: req.headers.get("x-forwarded-host"),
    forwardedProto: req.headers.get("x-forwarded-proto"),
    requestHost: req.headers.get("host"),
    hubOrigin: process.env.NEXT_PUBLIC_HUB_ORIGIN,
    onVercel: process.env.VERCEL === "1",
  });

  // Next relativizes Location only when it matches the request origin. An
  // absolute hub URL therefore stays absolute on the selection deployment
  // host, so a direct hit cannot open a second login there. Behind the hub
  // proxy the forwarded host is the hub, and the browser follows that host.
  const absolute = location.startsWith("/")
    ? new URL(location, "https://www.sakamatch.com").toString()
    : location;
  return NextResponse.redirect(absolute, 307);
}

export async function middleware(req: NextRequest) {
  if (!isSelectionPagePath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectToHubLogin(req);
  }

  const res = NextResponse.next();
  const supabase = createSharedServerClient({
    supabaseUrl,
    supabaseAnonKey,
    getAll() {
      return req.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        res.cookies.set(name, value, options);
      });
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToHubLogin(req);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2)$).*)",
  ],
};
