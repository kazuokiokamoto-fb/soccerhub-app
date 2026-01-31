import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createSupabase(req: NextRequest) {
  const res = NextResponse.next();

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

  return { supabase, res };
}

export async function middleware(req: NextRequest) {
  const { supabase, res } = createSupabase(req);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const pathname = req.nextUrl.pathname;

  // 触ってOKなパス（未ログインでも可）
  const publicPaths = ["/login", "/"];
  const isPublic =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api");

  // ここはログイン必須にしたいパス（必要に応じて増やしてOK）
  const requiresAuth =
    pathname.startsWith("/teams") ||
    pathname.startsWith("/venues") ||
    pathname.startsWith("/match") ||
    pathname.startsWith("/admin");

  // 未ログインなら /login へ
  if (!user && requiresAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname); // ログイン後に戻す用
    return NextResponse.redirect(url);
  }

  // /admin は「admins テーブルに自分のUIDがある人」だけ許可
  if (user && pathname.startsWith("/admin")) {
    const { data: adminRow, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // RLSで読めない/存在しない = 管理者じゃない
    if (error || !adminRow) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // 公開ページはそのまま
  if (isPublic) return res;

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};