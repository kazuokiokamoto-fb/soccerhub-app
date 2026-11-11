"use client";

import Link from "next/link";
import ZoneLink from "@/app/components/ZoneLink";

export default function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <h1 id="home-hero-title" className="home-hero-title">
        練習試合の相手が見つかる、
        <span className="home-hero-title-rest">サカまっち</span>
      </h1>
      <p className="home-hero-lead">
        チーム同士で練習試合を探して、募集して、チャットで調整できます。セレクション情報もまとめて確認できます。
      </p>
      <div className="home-hero-actions">
        <Link href="/login" className="sh-btn home-hero-primary">
          無料ではじめる
        </Link>
        <Link href="/teams/search" className="sh-btn home-hero-secondary">
          練習試合を探す
        </Link>
        <ZoneLink href="/selection" className="sh-btn home-hero-secondary">
          セレクションを見る
        </ZoneLink>
      </div>
    </section>
  );
}
