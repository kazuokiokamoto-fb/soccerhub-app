import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  // サーバー側で user 判定
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  // 公開ページ
  const publicPaths = ["/", "/login"];
  const isPublic = publicPaths.includes(pathname);

  // 保護ページ（ログイン必須）
  const isProtected =
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
    pathname.startsWith("/video");

  if (!user && isProtected && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);

    // ★ここ超重要：res を redirect に差し替えて返す
    res = NextResponse.redirect(url);
    return res;
  }

  return res;
}

export const config = {
  matcher: [
    // _next や画像などは除外
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};