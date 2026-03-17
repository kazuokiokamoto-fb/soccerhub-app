"use client";

import React from "react";
import AppTabNav from "@/app/components/AppTabNav";
import PageBackNav from "@/app/components/PageBackNav";
import AppHero from "@/app/components/AppHero";

export default function OfferReceivedPage() {
  return (
    <main style={wrap}>
      <AppTabNav />
      <PageBackNav current="オファー受信" />

      <AppHero
        icon="📥"
        title="オファー受信"
        desc="届いている試合オファー一覧です。"
      />

      <div style={card}>
        <div style={empty}>※ここに受信オファー一覧</div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const card: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const empty: React.CSSProperties = {
  textAlign: "center",
  color: "#888",
  padding: "30px 0",
};