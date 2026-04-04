"use client";

import React from "react";

export function AppToast(props: {
  open: boolean;
  message: string;
}) {
  const { open, message } = props;

  if (!open) return null;

  return (
    <div style={wrap} role="status" aria-live="polite">
      <div style={toast}>
        <span style={icon}>💬</span>
        <span>{message}</span>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 16,
  right: 16,
  bottom: 20,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 3000,
};

const toast: React.CSSProperties = {
  maxWidth: 520,
  width: "100%",
  minHeight: 48,
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(22,57,31,0.95)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  gap: 10,
  boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.5,
  pointerEvents: "none",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const icon: React.CSSProperties = {
  flexShrink: 0,
};