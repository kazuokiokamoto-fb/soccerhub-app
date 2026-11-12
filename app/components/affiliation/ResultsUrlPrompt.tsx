"use client";

import { useState } from "react";

export function ResultsUrlPrompt({
  teamName,
  initialUrl = "",
  busy = false,
  message = "",
  onSave,
}: {
  teamName?: string;
  initialUrl?: string;
  busy?: boolean;
  message?: string;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);

  return (
    <form
      className="url-prompt"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(url.trim());
      }}
    >
      <div className="prompt-head">
        <span className="status-badge">未確認</span>
        <h2>結果ページのURLを教えてください</h2>
      </div>
      {teamName ? <strong className="prompt-team">{teamName}</strong> : null}
      <label>
        <span className="sr-only">結果ページのURL</span>
        <input
          className="sh-input"
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
          required
        />
      </label>
      {message ? <p className="url-prompt-message">{message}</p> : null}
      <button className="sh-btn sh-btn--primary" type="submit" disabled={busy || url.trim() === ""}>
        {busy ? "保存中…" : "このURLを保存"}
      </button>
    </form>
  );
}
