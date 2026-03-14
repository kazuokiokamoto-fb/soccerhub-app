"use client";

import React from "react";

export default function AppHero(props: {
  icon: string;
  title: string;
  desc: string;
}) {
  const { icon, title, desc } = props;

  return (
    <section style={heroBox}>
      <h1 style={heroTitle}>
        <span style={{ marginRight: 6 }}>{icon}</span>
        {title}
      </h1>
      <p style={heroDesc}>{desc}</p>
    </section>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 18,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",

  // ★ここを小さく
  padding: "14px 16px",

  boxShadow: "0 8px 20px rgba(20,92,42,0.15)",
  marginBottom: 12,
};

const heroTitle: React.CSSProperties = {
  margin: 0,

  // ★少し小さく
  fontSize: 22,
  fontWeight: 900,
};

const heroDesc: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 13,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.9)",
};