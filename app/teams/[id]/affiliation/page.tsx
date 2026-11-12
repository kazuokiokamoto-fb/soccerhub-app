"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppHero from "@/app/components/AppHero";
import { AffiliationStep } from "@/app/components/affiliation/AffiliationStep";
import { ResultsUrlPrompt } from "@/app/components/affiliation/ResultsUrlPrompt";
import { errorText } from "@/app/results/labels";
import type { AffiliationDraft } from "@/lib/affiliation/validate";
import { validateAffiliation } from "@/lib/affiliation/validate";
import "@/app/components/affiliation/affiliation.css";

type TeamState = {
  id: string;
  name: string;
  role: string;
  affiliation: {
    status: string;
    prefecture: string | null;
    category: string | null;
    organizationName: string | null;
  } | null;
  page: { status: string; url: string | null; suggestedUrl: string | null } | null;
};

export default function TeamAffiliationPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  const [draft, setDraft] = useState<AffiliationDraft>({
    none: false,
    prefecture: "",
    category: "",
    organizationName: "",
  });
  const [page, setPage] = useState<TeamState["page"]>(null);
  const [ready, setReady] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/team-affiliation", { cache: "no-store" });
      const body = (await response.json()) as {
        ok?: boolean;
        schemaReady?: boolean;
        error?: string;
        teams?: TeamState[];
      };
      if (cancelled) return;
      if (!response.ok || !body.ok) {
        setMessage(errorText(body.error ?? "read_failed"));
        setReady(true);
        return;
      }
      setSchemaReady(body.schemaReady !== false);
      const team = (body.teams ?? []).find((item) => item.id === teamId) ?? null;
      if (team?.affiliation) {
        setDraft({
          none: team.affiliation.status === "none",
          prefecture: team.affiliation.prefecture ?? "",
          category: team.affiliation.category ?? "",
          organizationName: team.affiliation.organizationName ?? "",
        });
      }
      setPage(team?.page ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  async function saveAffiliation() {
    const parsed = validateAffiliation(draft);
    if (!parsed.ok) {
      setMessage(parsed.message);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team-affiliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, ...draft }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        resultsPage?: TeamState["page"];
      };
      if (!response.ok || !body.ok) {
        setMessage(errorText(body.error ?? "write_failed"));
        return;
      }
      setPage(body.resultsPage ?? null);
      setMessage(body.resultsPage?.status === "needs_url" ? "所属を保存しました。結果ページのURLを教えてください。" : "所属を保存しました。");
    } finally {
      setBusy(false);
    }
  }

  async function saveUrl(url: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team-results-page", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, url }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; resultsPage?: TeamState["page"] };
      if (!response.ok || !body.ok) {
        setMessage(errorText(body.error ?? "write_failed"));
        return;
      }
      setPage(body.resultsPage ?? page);
      setMessage("結果ページを保存しました。");
    } finally {
      setBusy(false);
    }
  }

  const askUrl = page?.status === "needs_url" || page?.status === "searching";

  return (
    <main className="sh-page-wrap" style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <AppHero icon="🏟" title="所属" desc="都道府県、カテゴリ、所属リーグ・連盟名をあとから直せます。" />
      <p>
        <Link href="/mypage" className="sh-btn">
          マイページ
        </Link>
      </p>
      {!schemaReady ? <p>所属の保存先はまだ準備中です。ほかの機能はそのまま使えます。</p> : null}
      {!ready ? <p>読み込み中です。</p> : null}
      {ready && schemaReady ? (
        <>
          <AffiliationStep value={draft} onChange={setDraft} disabled={busy} />
          <button
            className="sh-btn sh-btn--primary"
            type="button"
            disabled={busy || !validateAffiliation(draft).ok}
            onClick={() => void saveAffiliation()}
            style={{ marginTop: 12, width: "100%", minHeight: 48 }}
          >
            所属を保存
          </button>
          {askUrl ? (
            <div style={{ marginTop: 16 }}>
              <ResultsUrlPrompt
                initialUrl={page?.suggestedUrl ?? page?.url ?? ""}
                busy={busy}
                onSave={(url) => void saveUrl(url)}
              />
            </div>
          ) : null}
          {page?.status === "manual" || page?.status === "found" ? (
            <p style={{ marginTop: 12 }}>
              結果ページ：{page.url ? <a href={page.url}>{page.url}</a> : "保存済み"}
            </p>
          ) : null}
        </>
      ) : null}
      {message ? <p>{message}</p> : null}
    </main>
  );
}
