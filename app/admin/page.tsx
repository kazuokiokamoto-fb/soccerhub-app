"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/lib/auth";

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isAdmin, adminLoading } = useAuth();

  // redirect 先（なければ /admin に滞在）
  const redirect = searchParams.get("redirect") || "/admin";

  // router.replace の多重発火防止
  const redirectedRef = useRef(false);

  // 未ログインなら /login へ（redirect 付き）
  useEffect(() => {
    if (loading) return;
    if (user) return;

    if (redirectedRef.current) return;
    redirectedRef.current = true;

    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    router.refresh();
  }, [loading, user, router, redirect]);

  // まだ auth 初期化中
  if (loading) {
    return <main style={{ padding: 24 }}>読み込み中…</main>;
  }

  // 未ログイン（useEffectで飛ばすが、描画も安全に）
  if (!user) {
    return <main style={{ padding: 24 }}>ログイン画面へ移動中…</main>;
  }

  // 管理者判定中
  if (adminLoading) {
    return <main style={{ padding: 24 }}>管理者権限を確認中…</main>;
  }

  // 管理者じゃない
  if (!isAdmin) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>403</h1>
        <p>このページは管理者のみ閲覧できます。</p>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/" className="sh-btn" style={{ textDecoration: "none" }}>
            トップへ戻る
          </Link>
          <Link href="/match" className="sh-btn" style={{ textDecoration: "none" }}>
            マッチへ
          </Link>
        </div>
      </main>
    );
  }

  // 管理者OK
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>🛡 管理者ページ</h1>
      <p style={{ color: "#555" }}>
        ログイン中：{user.email ?? "(emailなし)"} / {user.id}
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <Link className="sh-btn" href="/teams/new" style={{ textDecoration: "none" }}>
          チーム登録（管理）
        </Link>
        <Link className="sh-btn" href="/venues" style={{ textDecoration: "none" }}>
          グラウンド管理
        </Link>
        <Link className="sh-btn" href="/" style={{ textDecoration: "none" }}>
          トップへ
        </Link>
      </div>
    </main>
  );
}