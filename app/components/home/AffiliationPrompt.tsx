"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ResultsUrlPrompt } from "@/app/components/affiliation/ResultsUrlPrompt";
import { errorText } from "@/app/results/labels";
import "@/app/components/affiliation/affiliation.css";

type Prompt = {
  teamId: string;
  teamName: string;
  kind: "affiliation" | "results_url";
  suggestedUrl: string | null;
  blocksProduct: false;
};

export default function AffiliationPrompt() {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    const response = await fetch("/api/team-affiliation", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { ok?: boolean; prompts?: Prompt[] };
    if (body.ok) setPrompts(body.prompts ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/team-affiliation", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { ok?: boolean; prompts?: Prompt[] };
        if (!cancelled && body.ok) setPrompts(body.prompts ?? []);
      } catch (error) {
        console.error("affiliation prompt skipped:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!prompts || prompts.length === 0) return null;

  async function dismiss(teamId: string) {
    setBusyId(teamId);
    try {
      const response = await fetch("/api/team-affiliation/dismiss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setMessage(errorText(body.error ?? "write_failed"));
        return;
      }
      await reload();
    } finally {
      setBusyId("");
    }
  }

  async function saveUrl(teamId: string, url: string) {
    setBusyId(teamId);
    setMessage("");
    try {
      const response = await fetch("/api/team-results-page", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, url }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        setMessage(errorText(body.error ?? "write_failed"));
        return;
      }
      setMessage("結果ページを保存しました。");
      await reload();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="home-affiliation-list">
      {prompts.map((prompt) =>
        prompt.kind === "affiliation" ? (
          <aside key={prompt.teamId} className="home-affiliation" aria-label="所属の登録">
            <p className="home-report-label">所属</p>
            <p>
              {prompt.teamName || "名称未設定"}の所属（都道府県・カテゴリ・リーグ名）が未登録です。結果の確認に使います。今は閉じても、ほかの機能はそのまま使えます。
            </p>
            <div className="home-actions">
              <Link href={`/teams/${prompt.teamId}/affiliation`} className="sh-btn sh-btn--primary">
                所属を登録
              </Link>
              <button
                type="button"
                className="sh-btn"
                disabled={busyId === prompt.teamId}
                onClick={() => void dismiss(prompt.teamId)}
              >
                今は閉じる
              </button>
            </div>
          </aside>
        ) : (
          <ResultsUrlPrompt
            key={prompt.teamId}
            teamName={prompt.teamName}
            initialUrl={prompt.suggestedUrl ?? ""}
            busy={busyId === prompt.teamId}
            message={message}
            onSave={(url) => void saveUrl(prompt.teamId, url)}
          />
        ),
      )}
    </div>
  );
}
