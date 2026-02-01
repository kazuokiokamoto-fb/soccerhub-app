"use client";

export const dynamic = "force-dynamic"; // ★ これが超重要（prerender 無効）

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";

export default function AdminPage() {
  // ★ ビルド時（window がない）には何も描画しない
  if (typeof window === "undefined") {
    return null;
  }

  const router = useRouter();
  const { user, loading, isAdmin, adminLoading } = useAuth();

  // 未ログインなら /login へ
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [loading, user, router]);

  // auth 初期化中
  if (loading) {
    return <main style={{ padding: 24 }}>読み込み中…</main>;
  }

  // 未ログイン（保険）
  if (!user) {
    return <main style={{ padding: 24 }}>ログイン画面へ移動中…</main>;
  }

  // 管理者判定中
  if (adminLoading) {
    return <main style={{ padding: 24 }}>管理者権限を確認中…</main>;
  }

  // 管理者でない
  if (!isAdmin) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>403</h1>
        <p>このページは管理者のみ閲覧できます。</p>
        <div style={{ marginTop: 12 }}>
          <Link href="/" className="sh-btn">
            トップへ戻る
          </Link>
        </div>
      </main>
    );
  }

  // 管理者OK
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>🛡 管理者ページ</h1>
      <p style={{ color: "#555" }}>ログイン中：{user.email}</p>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <Link className="sh-btn" href="/teams/new">
          チーム登録（管理）
        </Link>
        <Link className="sh-btn" href="/venues">
          グラウンド管理
        </Link>
        <Link className="sh-btn" href="/">
          トップへ
        </Link>
      </div>
    </main>
  );
}