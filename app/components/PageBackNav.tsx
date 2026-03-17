// app/components/PageBackNav.tsx
"use client";

import Link from "next/link";
import React from "react";

export default function PageBackNav(props: {
  href?: string;
  label?: string;
  current?: string;
}) {
  const { href = "/", label = "TOPへ戻る", current } = props;

  return (
    <div style={wrap}>
      <Link href={href} style={backLink}>
        ← {label}
      </Link>

      {current ? <div style={currentText}>/ {current}</div> : null}
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 12,
};

const backLink: React.CSSProperties = {
  textDecoration: "none",
  color: "#145c2a",
  fontWeight: 900,
  fontSize: 14,
};

const currentText: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 700,
};