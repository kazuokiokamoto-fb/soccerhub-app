"use client";

import { Suspense } from "react";
import ResultsEditor from "../ResultsEditor";

export default function TeamResultsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>読み込み中です。</p>}>
      <ResultsEditor />
    </Suspense>
  );
}
