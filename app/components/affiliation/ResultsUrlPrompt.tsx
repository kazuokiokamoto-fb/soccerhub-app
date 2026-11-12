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
      <h2>結果ページのURLを教えてください</h2>
      <p>
        {teamName ? `${teamName}の` : ""}
        公開されている順位表や結果のページが見つからなかったか、確信度が低かったため、URLを教えてください。違っていれば直して保存できます。
      </p>
      <p className="url-prompt-note">
        保存したページから順位の候補を集めます。集めただけでは提出になりません。
      </p>
      <label>
        <span>結果ページのURL</span>
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
