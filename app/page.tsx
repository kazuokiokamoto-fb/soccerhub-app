// app/page.tsx
"use client";

import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={wrap}>
      <header style={header}>
        <h1 style={title}>SoccerHub</h1>
        <p style={subTitle}>
          まずは「探す」か「募集する」かを選ぶだけ。チーム設定はあとでOK。
        </p>
      </header>

      <section style={grid}>
        {/* 1) 探す */}
        <Link href="/match" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>🆚</div>
          <div style={cardTitle}>対戦相手を探す</div>
          <div style={cardDesc}>日付ごとの募集中枠から、条件に合う相手を見つけます。</div>
          <div style={cardCta}>開く →</div>
        </Link>

        {/* 2) 募集する */}
        <Link href="/match" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>📣</div>
          <div style={cardTitle}>募集を出す</div>
          <div style={cardDesc}>日付・時間・エリア・カテゴリを指定して募集枠を作成します。</div>
          <div style={cardCta}>開く →</div>
        </Link>

        {/* 3) チーム */}
        <Link href="/teams" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>⚙️</div>
          <div style={cardTitle}>自分のチーム</div>
          <div style={cardDesc}>チーム情報・ユニフォーム・よく使うグラウンドを設定します。</div>
          <div style={cardCta}>開く →</div>
        </Link>
      </section>

      <section style={noteBox}>
        <div style={noteTitle}>使い方（最短）</div>
        <ol style={noteList}>
          <li>「自分のチーム」でチームを1つ作る</li>
          <li>「募集を出す」で日付と時間を入れて募集枠を作る</li>
          <li>「対戦相手を探す」で相手の募集に申込みする</li>
        </ol>
      </section>
    </main>
  );
}

/** ===== styles ===== */
const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const header: React.CSSProperties = {
  marginTop: 10,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const subTitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#555",
  lineHeight: 1.6,
};

const grid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(3, 1fr)",
};

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 16,
  background: "white",
  padding: 14,
  minHeight: 150,
  display: "grid",
  gap: 8,
  alignContent: "start",
  cursor: "pointer",
};

const cardIcon: React.CSSProperties = {
  fontSize: 26,
  lineHeight: 1,
};

const cardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
};

const cardDesc: React.CSSProperties = {
  fontSize: 13,
  color: "#555",
  lineHeight: 1.6,
};

const cardCta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 800,
  color: "#111827",
};

const noteBox: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #eee",
  borderRadius: 16,
  background: "#fafafa",
  padding: 14,
};

const noteTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 6,
};

const noteList: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#555",
  lineHeight: 1.8,
};

/** ===== responsive (簡易) =====
 * CSSでやるのが本筋だけど、MVPとして「3列→1列」は
 * globals.css に1本だけ足すのが軽いです（下に提案あり）
 */