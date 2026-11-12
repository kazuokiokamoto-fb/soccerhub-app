"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import LoggedInMocks from "./mocks";
import AppHero from "@/app/components/AppHero";
import { AffiliationStep } from "@/app/components/affiliation/AffiliationStep";
import { ResultsUrlPrompt } from "@/app/components/affiliation/ResultsUrlPrompt";
import { AffiliationAsk } from "@/app/components/home/AffiliationPrompt";
import { ReportNoticeList } from "@/app/components/home/AnnualReportBanner";
import { StandingReportCard } from "@/app/results/StandingReport";
import type { AffiliationDraft } from "@/lib/affiliation/validate";
import type { StandingValue } from "@/lib/standings/submit";
import "@/app/components/affiliation/affiliation.css";
import "@/app/components/home/home.css";
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

  if (
    screen === "chat" ||
    screen === "mypage" ||
    screen === "match" ||
    screen === "team" ||
    screen === "selection" ||
    screen === "selection-detail" ||
    screen === "home-in" ||
    screen === "recruit"
  ) {
    return <LoggedInMocks screen={screen} />;
  }

  return (
    <main className="or-editor" style={{ maxWidth: 420 }}>
      {screen === "url" ? (
        <ResultsUrlPrompt
          teamName="青葉FC"
          initialUrl="https://example.com/standings"
          message={note}
          onSave={(url) => setNote(`${url} を保存しました`)}
        />
      ) : null}
      {screen === "report" ? (
        <StandingReportCard
          teamName="青葉FC"
          year={2025}
          years={[2025, 2026]}
          onYear={() => undefined}
          deadlineYear={2026}
          phase="overdue"
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
          phase="overdue"
          submitted={null}
          candidate={null}
          busy={false}
          message={note}
          onSubmit={(_mode, value) =>
            setNote(`${value.category} / ${value.unknown ? "順位なし・不明" : `${value.rank}位`} で提出しました。`)
          }
        />
      ) : null}
      {screen === "prompt" ? (
        <AffiliationAsk teamName="青葉FC" href="/teams/1/affiliation" onDismiss={() => undefined} />
      ) : null}
      {screen === "banner" ? (
        <ReportNoticeList
          notices={[
            {
              teamId: "11111111-1111-4111-8111-111111111111",
              teamName: "青葉FC",
              fiscalYear: 2025,
              deadlineYear: 2026,
              phase: "overdue",
              message: "期限切れ 2026/5/31・提出できます",
            },
          ]}
        />
      ) : null}
      {screen === "affiliation" ? (
        <>
          <AppHero icon="👥" title="チーム登録" desc="" />
          <AffiliationStep value={draft} onChange={setDraft} />
          <button className="sh-btn sh-btn--primary" type="button" style={{ width: "100%", minHeight: 48 }}>
            登録する
          </button>
        </>
      ) : null}
    </main>
  );
}
