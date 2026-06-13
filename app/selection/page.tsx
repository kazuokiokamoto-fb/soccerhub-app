import { Suspense } from "react";
import SelectionPageClient from "./SelectionPageClient";

export default function SelectionPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <SelectionPageClient />
    </Suspense>
  );
}