"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import AppHero from "@/app/components/AppHero";
import { AffiliationStep } from "@/app/components/affiliation/AffiliationStep";
import { ResultsUrlPrompt } from "@/app/components/affiliation/ResultsUrlPrompt";
import { StandingReportCard } from "@/app/results/StandingReport";
import type { AffiliationDraft } from "@/lib/affiliation/validate";
import type { StandingValue } from "@/lib/standings/submit";
import "@/app/components/affiliation/affiliation.css";
import "@/app/results/results.css";

export default function UiFixtures() {
  const screen = useSearchParams().get("screen") ?? "affiliation";
  const [draft, setDraft] = useState<AffiliationDraft>({
    none: false,
    prefecture: "",
    category: "",
    organizationName: "",
  });
  const [note, setNote] = useState("");

  return (
    <main className="or-editor" style={{ maxWidth: 420 }}>
      {screen === "url" ? (
        <ResultsUrlPrompt
          teamName="青葉FC"
          initialUrl="https://example.com/standings"
          message={note}
          onSave={(url) => setNote(`${url} を保存しました。提出にはなりません。`)}
        />
      ) : null}
      {screen === "report" ? (
        <StandingReportCard
          teamName="青葉FC"
          year={2025}
          years={[2025, 2026]}
          onYear={() => undefined}
          deadlineYear={2026}
          phaseLabel="期限を過ぎています。提出はまだできます。"
          submitted={null}
          candidate={{
            category: "U-15",
            rank: 2,
            sourceUrl: "https://example.com/standings",
            fetchedAt: "2026-06-02T03:00:00.000Z",
          }}
          busy={false}
          message={note}
          onSubmit={(mode: "confirm" | "edit", value: StandingValue) =>
            setNote(mode === "confirm" ? "この内容で提出しました。" : `${value.category} ${value.unknown ? "順位なし・不明" : `${value.rank}位`} で提出しました。`)
          }
        />
      ) : null}
      {screen === "empty" ? (
        <StandingReportCard
          teamName="青葉FC"
          year={2025}
          years={[2025]}
          onYear={() => undefined}
          deadlineYear={2026}
          phaseLabel="期限を過ぎています。提出はまだできます。"
          submitted={null}
          candidate={null}
          busy={false}
          message={note}
          onSubmit={(_mode, value) =>
            setNote(`${value.category} / ${value.unknown ? "順位なし・不明" : `${value.rank}位`} で提出しました。`)
          }
        />
      ) : null}
      {screen === "affiliation" ? (
        <>
          <AppHero icon="👥" title="チーム登録" desc="チーム情報を登録して、練習試合マッチングを始めましょう。" />
          <AffiliationStep value={draft} onChange={setDraft} />
          <button className="sh-btn sh-btn--primary" type="button" style={{ width: "100%", minHeight: 48 }}>
            登録する
          </button>
        </>
      ) : null}
    </main>
  );
}
