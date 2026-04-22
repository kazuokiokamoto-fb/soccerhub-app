"use client";

import React, { Suspense } from "react";
import MyScheduleInner from "./MyScheduleInner";

export default function MySchedulePage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>読み込み中…</div>}>
      <MyScheduleInner />
    </Suspense>
  );
}