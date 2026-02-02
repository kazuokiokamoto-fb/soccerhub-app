import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>読み込み中…</main>}>
      <LoginClient />
    </Suspense>
  );
}