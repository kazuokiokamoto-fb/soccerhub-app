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
        <span style={{ marginRight: 8 }}>{icon}</span>
        {title}
      </h1>
      <p style={heroDesc}>{desc}</p>
    </section>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 20,
  boxShadow: "0 10px 28px rgba(20,92,42,0.20)",
  marginBottom: 16,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
};

const heroDesc: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  lineHeight: 1.7,
  color: "rgba(255,255,255,0.92)",
};