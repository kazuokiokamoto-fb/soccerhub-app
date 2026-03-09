import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#ffffff",
          border: "1px solid #e4ebe6",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 10px 30px rgba(20, 92, 42, 0.08)",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900, color: "#1f5d30" }}>サカまち</div>
        <div style={{ marginTop: 8, color: "#66756d" }}>読み込み中…</div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}