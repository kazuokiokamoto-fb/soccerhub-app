// app/teams/search/page.tsx
"use client";

import React, { Suspense } from "react";
import TeamsSearchClient from "./TeamsSearchClient";

export default function TeamSearchPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24, color: "#777" }}>読み込み中...</p>}>
      <TeamsSearchClient />
    </Suspense>
  );
}