import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/auth/callback"
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/teams") ||
    pathname.startsWith("/match") ||
    pathname.startsWith("/venues") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/map") ||
    pathname.startsWith("/results") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/selection") ||
    pathname.startsWith("/video") ||
    pathname.startsWith("/mypage")
  );
}

function buildSafeRedirectPath(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search ?? "";
  const fullPath = `${pathname}${search}`;

  if (!fullPath.startsWith("/")) return "/";
  if (fullPath.startsWith("//")) return "/";
  if (fullPath.startsWith("/login")) return "/";
  if (fullPath.startsWith("/auth/callback")) return "/";

  return fullPath;
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const isPublic = isPublicPath(pathname);
  const isProtected = isProtectedPath(pathname);

  if (!user && isProtected && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    const redirectPath = buildSafeRedirectPath(req);
    if (redirectPath !== "/") {
      url.searchParams.set("redirect", redirectPath);
    }

    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const requestedRedirect = req.nextUrl.searchParams.get("redirect");

    const safeRedirect =
      requestedRedirect &&
      requestedRedirect.startsWith("/") &&
      !requestedRedirect.startsWith("//") &&
      !requestedRedirect.startsWith("/login")
        ? requestedRedirect
        : "/";

    return NextResponse.redirect(new URL(safeRedirect, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};