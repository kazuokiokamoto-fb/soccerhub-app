import { Suspense } from "react";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>読み込み中…</main>}>
      <AdminClient />
    </Suspense>
  );
}