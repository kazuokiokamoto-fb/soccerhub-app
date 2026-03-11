import React from "react";

export const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 18,
  boxShadow: "0 10px 28px rgba(20,92,42,0.16)",
  marginBottom: 12,
};

export const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.3,
};

export const heroDesc: React.CSSProperties = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.8,
  fontSize: 14,
};

export const dayListWrap: React.CSSProperties = {
  marginTop: 12,
  scrollMarginTop: 88,
};

export const stickySummaryBar: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 20,
  marginBottom: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe7df",
  background: "#f7fbf8",
  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
};

export const stickySummaryDate: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#1f5d30",
  lineHeight: 1.4,
};

export const stickySummaryCount: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 800,
  color: "#166534",
  lineHeight: 1.4,
};

export const dayListHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

export const dayListTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#1f5d30",
};

export const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
  scrollMarginTop: 88,
};

export const filterHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

export const filterTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#1f5d30",
};

export const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

export const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

export const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
};

export const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

export const appliedBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fafafa",
  padding: "10px 12px",
};

export const appliedTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

export const appliedText: React.CSSProperties = {
  fontSize: 13,
  color: "#444",
  lineHeight: 1.7,
};

export const toastBox: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 12,
};

export const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
  color: "#166534",
};

export const toastError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

export const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

export const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};