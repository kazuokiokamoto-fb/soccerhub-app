import React from "react";

export const pageWrap: React.CSSProperties = {
  padding: 12,
  maxWidth: 860,
  margin: "0 auto",
  boxSizing: "border-box",
  height: "calc(100dvh - var(--app-header-height, 0px))",
  minHeight: "calc(100dvh - var(--app-header-height, 0px))",
};

export const chatPanel: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 20,
  background: "#f6fbf7",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "auto 1fr auto",
  height: "100%",
  minHeight: 0,
};

export const authLoadingBox: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: 240,
  padding: 24,
  color: "#666",
  background: "#fff",
};

export const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 12,
  borderBottom: "1px solid #e5ece7",
  background: "#ffffff",
  position: "sticky",
  top: 0,
  zIndex: 2,
  flexWrap: "wrap",
};

export const headerLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  flexWrap: "wrap",
};

export const titleWrap: React.CSSProperties = {
  minWidth: 0,
};

export const headerRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

export const threadTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

export const threadSubTitle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 2,
};

export const notifyBadgeGranted: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "0 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
};

export const chatBody: React.CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  padding: "14px 14px 120px",
  background: "linear-gradient(180deg, #eef8f0 0%, #f8fcf9 100%)",
  WebkitOverflowScrolling: "touch",
};

export const messageList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

export const notMemberBox: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "#fff",
  border: "1px solid #e5ece7",
  color: "#991b1b",
  lineHeight: 1.8,
};

export const dateDividerWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  margin: "4px 0 2px",
};

export const dateDivider: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.08)",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

export const bubbleRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-end",
};

export const bubbleWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxWidth: "78%",
};

export const senderName: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  paddingLeft: 4,
};

export const bubbleBase: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 18,
  lineHeight: 1.6,
  fontSize: 14,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

export const bubbleMine: React.CSSProperties = {
  background: "#8de17a",
  color: "#17311b",
  borderTopRightRadius: 6,
};

export const bubbleOther: React.CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderTopLeftRadius: 6,
};

export const bubbleSending: React.CSSProperties = {
  opacity: 0.7,
};

export const bubbleDeleted: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#6b7280",
  border: "1px solid #e5e7eb",
  fontStyle: "italic",
};

export const bubbleActionable: React.CSSProperties = {
  cursor: "pointer",
  WebkitTouchCallout: "none",
  userSelect: "none",
};

export const bubbleText: React.CSSProperties = {
  lineHeight: 1.7,
};

export const bubbleMeta: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  display: "flex",
  alignItems: "flex-end",
  gap: 6,
};

export const bubbleMetaMine: React.CSSProperties = {
  justifyContent: "flex-end",
  alignSelf: "stretch",
};

export const bubbleMetaOther: React.CSSProperties = {
  justifyContent: "flex-start",
};

export const bubbleMineRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  gap: 6,
  width: "100%",
};

export const bubbleMetaSide: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  minWidth: 54,
  flexShrink: 0,
  fontSize: 11,
  color: "#6b7280",
  lineHeight: 1.4,
};

export const bubbleMetaTime: React.CSSProperties = {
  whiteSpace: "nowrap",
};

export const readStateText: React.CSSProperties = {
  fontSize: 11,
  color: "#4b5563",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

export const inputArea: React.CSSProperties = {
  borderTop: "1px solid #e5ece7",
  background: "#fff",
  padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
  display: "grid",
  gap: 6,
};

export const inputRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  alignItems: "end",
};

export const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  maxHeight: 96,
  padding: "10px 14px",
  borderRadius: 18,
  border: "1px solid #d1d5db",
  background: "#fff",
  resize: "none",
  fontSize: 16,
  lineHeight: 1.5,
  WebkitAppearance: "none",
  boxSizing: "border-box",
};

export const sendButton: React.CSSProperties = {
  minWidth: 72,
  alignSelf: "stretch",
};

export const inputHint: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
};

export const sendErrorText: React.CSSProperties = {
  color: "#991b1b",
  fontSize: 12,
  whiteSpace: "pre-wrap",
};

export const sheetBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.28)",
  zIndex: 1000,
};

export const sheetWrap: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1001,
  padding: 12,
};

export const sheetPanel: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  background: "#f3f4f6",
  borderRadius: 18,
  overflow: "hidden",
  boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
  display: "grid",
  gap: 8,
  padding: 8,
};

export const sheetButton: React.CSSProperties = {
  width: "100%",
  minHeight: 54,
  border: "none",
  borderRadius: 14,
  background: "#ffffff",
  color: "#111827",
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
};

export const sheetDangerButton: React.CSSProperties = {
  width: "100%",
  minHeight: 54,
  border: "none",
  borderRadius: 14,
  background: "#ffffff",
  color: "#dc2626",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

export const sheetCancelButton: React.CSSProperties = {
  width: "100%",
  minHeight: 54,
  border: "none",
  borderRadius: 14,
  background: "#ffffff",
  color: "#111827",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

export const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 1100,
};

export const modalWrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1101,
  padding: 16,
};

export const modalPanel: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  display: "grid",
  gap: 12,
};

export const modalTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.4,
};

export const modalLead: React.CSSProperties = {
  fontSize: 13,
  color: "#4b5563",
  lineHeight: 1.7,
};

export const modalField: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

export const modalLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 800,
};

export const modalInput: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 15,
  lineHeight: 1.5,
  boxSizing: "border-box",
};

export const modalTextArea: React.CSSProperties = {
  width: "100%",
  minHeight: 82,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 15,
  lineHeight: 1.6,
  resize: "vertical",
  boxSizing: "border-box",
};

export const modalRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

export const modalHintBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontSize: 12,
  lineHeight: 1.7,
};

export const modalErrorText: React.CSSProperties = {
  color: "#991b1b",
  fontSize: 13,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};

export const modalActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  marginTop: 4,
  flexWrap: "wrap",
};

export const modalCancelButton: React.CSSProperties = {
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};

export const modalSubmitButton: React.CSSProperties = {
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#22c55e",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};