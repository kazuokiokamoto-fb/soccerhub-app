import React from "react";

export const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

export const loadingWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

export const loadingBox: React.CSSProperties = {
  padding: 20,
};

export const box: React.CSSProperties = {
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 14,
  marginBottom: 20,
  background: "#fff",
};

export const sectionHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

export const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
};

export const errorTextWrap: React.CSSProperties = {
  marginTop: 16,
  color: "#991b1b",
};

export const reloadWrap: React.CSSProperties = {
  marginTop: 16,
};

export const reloadErrorText: React.CSSProperties = {
  color: "#991b1b",
  marginBottom: 12,
};

export const dashboardGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

export const dashboardCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 10,
};

export const dashboardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

export const statusList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

export const dashboardLinkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  textDecoration: "none",
  color: "#111",
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "12px 14px",
};

export const dashboardLinkLabel: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

export const dashboardLinkHelper: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.6,
};

export const dashboardLinkValue: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#145c2a",
  whiteSpace: "nowrap",
};

export const dashboardScheduleInner: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
  display: "grid",
  gap: 10,
};

export const scheduleMainRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

export const schedulePrimaryText: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0,
};

export const scheduleDateBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 13,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

export const scheduleTimeText: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.4,
};

export const scheduleConfirmedBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

export const scheduleDraftBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#4b5563",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #e5e7eb",
};

export const scheduleMetaText: React.CSSProperties = {
  fontSize: 13,
  color: "#3b6a49",
  lineHeight: 1.55,
};

export const scheduleSubMetaText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.6,
};

export const scheduleActionRowRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  marginTop: 2,
};

export const emptyScheduleText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#3b6a49",
  lineHeight: 1.6,
};

export const card: React.CSSProperties = {
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 12,
  marginTop: 10,
  background: "#fafafa",
};

export const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "nowrap",
};

export const cardTitleArea: React.CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
};

export const cardActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "flex-start",
  marginLeft: "auto",
  flex: "0 0 auto",
};

export const subText: React.CSSProperties = {
  marginTop: 4,
  color: "#66756d",
  fontSize: 13,
  lineHeight: 1.6,
};

export const metaBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

export const metaRow: React.CSSProperties = {
  padding: 8,
  borderRadius: 8,
  background: "#fafafa",
  border: "1px solid #f0f0f0",
};

export const noteBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

export const noteTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

export const noteBody: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

export const infoGrid: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

export const infoRow: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#333",
};

export const notifyWrap: React.CSSProperties = {
  display: "grid",
  gap: 10,
  color: "#555",
  lineHeight: 1.8,
};

export const teamActionWrap: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

export const teamList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

export const categoryMetaList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

export const deleteBtn: React.CSSProperties = {
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff",
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