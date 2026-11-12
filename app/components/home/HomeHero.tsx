"use client";

import Link from "next/link";

export default function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <span className="home-ball" aria-hidden="true" />
      <h1 id="home-hero-title" className="home-hero-title">
        練習試合の相手が見つかる、
        <span className="home-hero-title-rest">サカまっち</span>
      </h1>
      <div className="home-hero-points" aria-hidden="true">
        <span>探す</span>
        <span>募集</span>
        <span>チャット</span>
      </div>
      <p className="home-sr">
        チーム同士で練習試合を探して、募集して、チャットで調整できます。
      </p>
      <div className="home-hero-actions">
        <Link href="/login" className="sh-btn home-hero-primary">
          無料ではじめる
        </Link>
      </div>
    </section>
  );
}
