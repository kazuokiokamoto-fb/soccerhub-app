"use client";

import React from "react";

type Props = {
  icon: string;
  title: string;
  desc?: string;
};

export default function AppHero({ icon, title, desc }: Props) {
  return (
    <section style={heroBox}>
      <h1 style={heroTitle}>
        <span style={heroIcon}>{icon}</span>
        {title}
      </h1>

      {desc ? <p style={heroDesc}>{desc}</p> : null}
    </section>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: "22px 20px",
  boxShadow: "0 10px 28px rgba(20,92,42,0.20)",
  marginBottom: 18,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const heroIcon: React.CSSProperties = {
  fontSize: 26,
  lineHeight: 1,
};

const heroDesc: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 14,
  lineHeight: 1.7,
  color: "rgba(255,255,255,0.92)",
};