import React, { Suspense } from "react";
import TeamsSearchClient from "./components/TeamsSearchClient";
import AppTabNav from "@/app/components/AppTabNav";

function SearchPageFallback() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <AppTabNav />
      <div
        style={{
          marginTop: 14,
          padding: 20,
          borderRadius: 16,
          border: "1px solid #e5ece7",
          background: "#fff",
          color: "#666",
          lineHeight: 1.8,
          textAlign: "center",
        }}
      >
        読み込み中…
      </div>
    </main>
  );
}

export default function TeamsSearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <TeamsSearchClient />
    </Suspense>
  );
}