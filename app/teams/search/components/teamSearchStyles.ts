import React from "react";

export const summaryWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
};

export const summaryHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
};

export const pageStack: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

export const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

export const dayListWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

export const stickySummaryBar: React.CSSProperties = {
  border: "1px solid #dce9df",
  background: "#f7fbf8",
  borderRadius: 18,
  padding: "14px 16px",
};

export const stickySummaryDate: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#245233",
};

export const stickySummaryCount: React.CSSProperties = {
  marginTop: 4,
  fontSize: 14,
  color: "#3b6a49",
};

export const dayListHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

export const dayListTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

export const filterHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
};

export const filterTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  alignItems: "start",
};

export const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

export const strengthCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

export const strengthHead: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

export const strengthTitleWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

export const strengthTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const strengthTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
};

export const strengthSubText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

export const strengthHeadRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap" as const,
};

export const helpButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#23412c",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  transition: "all 0.15s ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

export const strengthSimpleList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

export const strengthSimpleButton: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d6eadb",
  background: "#fff",
  cursor: "pointer",
  transition: "all 0.15s ease",
  fontSize: 14,
  fontWeight: 800,
  color: "#23412c",
  lineHeight: 1.5,
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

export const strengthSimpleButtonDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

export const strengthSimpleCode: React.CSSProperties = {
  display: "inline-block",
  minWidth: 28,
  fontWeight: 900,
};

export const resultCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

export const resultHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap" as const,
};

export const resultHeaderRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

export const resultTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

export const resultSub: React.CSSProperties = {
  marginTop: 8,
  color: "#666",
  lineHeight: 1.8,
};

export const strengthBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#f5c542",
  color: "#3a2b00",
  fontWeight: 900,
  fontSize: 12,
};

export const detailWrap: React.CSSProperties = {
  marginTop: 14,
};

export const detailGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

export const detailBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

export const detailLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

export const detailValue: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap" as const,
};

export const buttonRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
};

export const emptyBox: React.CSSProperties = {
  padding: 20,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fff",
  color: "#777",
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

export const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 2000,
};

export const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "80vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5ece7",
  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  padding: 18,
};

export const offerModalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 640,
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5ece7",
  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  padding: 18,
};

export const offerInfoBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

export const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  position: "sticky",
  top: 0,
  background: "#fff",
  paddingBottom: 8,
};

export const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

export const modalCloseButton: React.CSSProperties = {
  border: "1px solid #d6ded9",
  background: "#fff",
  borderRadius: 12,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

export const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  resize: "vertical",
  border: "1px solid #d6ded9",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  lineHeight: 1.7,
  background: "#fff",
};

export const guideList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

export const guideCard: React.CSSProperties = {
  border: "1px solid #e7ece9",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 14,
};

export const guideTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap" as const,
};

export const guideRank: React.CSSProperties = {
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#145c2a",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export const guideShort: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
  fontSize: 15,
};

export const guideTitleText: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 800,
  color: "#314137",
  lineHeight: 1.7,
};

export const guideBulletList: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
};

export const guideBulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 8,
  alignItems: "start",
  color: "#314137",
  fontSize: 14,
  lineHeight: 1.7,
};

export const guideBulletMark: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

export const guideNote: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e7d08a",
  background: "#fff8dd",
  color: "#4d3a00",
  fontWeight: 800,
  lineHeight: 1.7,
  fontSize: 13,
};