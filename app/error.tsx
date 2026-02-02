"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>🚨 アプリ実行エラー</h1>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#fee",
            padding: 12,
            borderRadius: 8,
            marginTop: 12,
            fontSize: 13,
          }}
        >
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>

        <button
          onClick={() => reset()}
          style={{ marginTop: 16, padding: 10 }}
        >
          再読み込み
        </button>
      </body>
    </html>
  );
}