import { Suspense } from "react";
import type { Metadata } from "next";
import SelectionPageClient from "./SelectionPageClient";

export const metadata: Metadata = {
  title: "セレクション検索",
  description: "セレクション検索。気になるチームのセレクションを探せます。",
};

export default function SelectionPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <SelectionPageClient />
    </Suspense>
  );
}