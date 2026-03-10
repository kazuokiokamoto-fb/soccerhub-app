"use client";

import React, { Suspense } from "react";
import TeamsClient from "../TeamsClient";

export default function TeamSearchPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24, color: "#777" }}>読み込み中...</p>}>
      <TeamsClient />
    </Suspense>
  );
}