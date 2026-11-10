import { NextResponse, type NextRequest } from "next/server";
import { hubSelectionPlan } from "@/lib/auth-session/hubPlan";
import { decideLegacyAuth, isSelectionAssetPath } from "@/lib/auth-session/paths";
import { createSharedServerClient } from "@/lib/auth-session/supabaseClients";
import { selectionRoutingDecision } from "@/lib/selection-frontend/routing";

function redirectToLogin(req: NextRequest, redirectParam: string | null) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (redirectParam) {
    url.searchParams.set("redirect", redirectParam);
  }
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Asset proxying is a beforeFiles rewrite. Do not refresh auth cookies here.
  if (isSelectionAssetPath(pathname)) {
    return NextResponse.next();
  }

  // Static process.env reads so the edge bundle keeps these build-time values
  // aligned with the beforeFiles rewrites from next.config.
  const routing = selectionRoutingDecision(
    {
      SELECTION_FRONTEND_ROUTING: process.env.SELECTION_FRONTEND_ROUTING,
      SELECTION_APP_ORIGIN: process.env.SELECTION_APP_ORIGIN,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
      VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
    req.headers.get("host")
  );
  const plan = hubSelectionPlan({
    routingEnabled: routing.enabled,
    pathname,
    cookieNames: req.cookies.getAll().map((cookie) => cookie.name),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  if (plan.action === "to-login") {
    const decision = decideLegacyAuth({
      hasUser: false,
      pathname,
      search: req.nextUrl.search ?? "",
      loginRedirectParam: null,
    });
    if (decision.action === "to-login") {
      return redirectToLogin(req, decision.redirectParam);
    }
    return NextResponse.next();
  }

  // Signed-in selection requests are proxied by beforeFiles. Skip getUser()
  // so this process does not rotate the refresh token before the selection
  // zone reads the same cookies.
  if (plan.action === "proxy") {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabase = createSharedServerClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const decision = decideLegacyAuth({
    hasUser: Boolean(user),
    pathname,
    search: req.nextUrl.search ?? "",
    loginRedirectParam: req.nextUrl.searchParams.get("redirect"),
  });

  if (decision.action === "to-login") {
    return redirectToLogin(req, decision.redirectParam);
  }

  if (decision.action === "leave-login") {
    return NextResponse.redirect(new URL(decision.destination, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
