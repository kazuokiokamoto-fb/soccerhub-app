import { Suspense } from "react";
import type { Metadata } from "next";
import SelectionPageClient from "./SelectionPageClient";

const selectionDescription =
  "セレクション検索。気になるチームのセレクションを探せます。";

export const metadata: Metadata = {
  title: "セレクション検索",
  description: selectionDescription,
  openGraph: {
    title: "セレクション検索",
    description: selectionDescription,
    siteName: "セレクション検索",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "セレクション検索",
    description: selectionDescription,
  },
};

export default function SelectionPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <SelectionPageClient />
    </Suspense>
  );
}