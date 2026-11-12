"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import LoggedInMocks from "./mocks";
import { MyPageTeamCard } from "@/app/mypage/MyPageTeamCard";
import AppHero from "@/app/components/AppHero";
import { AffiliationStep } from "@/app/components/affiliation/AffiliationStep";
import { ResultsUrlPrompt } from "@/app/components/affiliation/ResultsUrlPrompt";
import { AffiliationAsk } from "@/app/components/home/AffiliationPrompt";
import { ReportNoticeList } from "@/app/components/home/AnnualReportBanner";
import { StandingReportCard } from "@/app/results/StandingReport";
import { RankSuggestion, StrengthRankSelect } from "@/app/components/RankSuggestion";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import type { AffiliationDraft } from "@/lib/affiliation/validate";
import type { StandingValue } from "@/lib/standings/submit";
import "@/app/components/affiliation/affiliation.css";
import "@/app/components/home/home.css";
import "@/app/results/results.css";

const TeamCardFixture = dynamic(() => import("./TeamCardFixture"), { ssr: false });

export default function UiFixtures() {
  const params = useSearchParams();
  const screen = params.get("screen") ?? "affiliation";
  const [draft, setDraft] = useState<AffiliationDraft>(() =>
    params.get("preset") === "suggest"
      ? {
          none: false,
          prefecture: "東京都",
          category: "U-12",
          organizationName: "東京都リーグ",
          leagueLevel: "prefecture",
          leagueDivision: "3",
        }
      : {
          none: false,
          prefecture: "",
          category: "",
          organizationName: "",
          leagueLevel: "",
          leagueDivision: "",
        },
  );
  const [note, setNote] = useState("");
  const [rank, setRank] = useState<StrengthRank>("A");

  useEffect(() => {
    document.documentElement.dataset.fixtureAuth = "in";
    return () => {
      delete document.documentElement.dataset.fixtureAuth;
    };
  }, []);

  if (screen === "rank") {
    return (
      <main className="or-editor" style={{ maxWidth: 420, display: "grid", gap: 16 }}>
        <section className="affiliation-step">
          <h1>カテゴリごとの強さ・人数</h1>
          <RankSuggestion
            suggested="S"
            current={rank}
            onApply={setRank}
            hint="登録すると保存されます。別のランクでも大丈夫です。"
          />
          <label style={{ display: "grid", gap: 8 }}>
            <span>強さ</span>
            <StrengthRankSelect value={rank} onChange={setRank} />
          </label>
        </section>
      </main>
    );
  }

  if (screen === "team-card") {
    return (
      <main style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
        <TeamCardFixture />
      </main>
    );
  }

  if (screen === "mypage-card") {
    return (
      <main className="sm-screen">
        <MyPageTeamCard
          team={{
            id: "11111111-1111-4111-8111-111111111111",
            owner_id: "owner",
            name: "青葉FC",
            category: "U12",
            categories: ["U12"],
            level: 7,
            strength_rank: "S",
            area: "東京都 世田谷",
            prefecture: "東京都",
            city: "世田谷区",
            town: null,
            has_ground: true,
            uniform_main: "青",
            uniform_sub: "白",
            uniform_gk: "黄",
          }}
          role="owner"
          onDelete={() => undefined}
        />
      </main>
    );
  }

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
          <AffiliationStep
            value={draft}
            onChange={setDraft}
            currentRank="A"
            onApplyRank={(next) => setNote(`強さを ${next} にしました`)}
            applyHint="登録すると保存されます。別のランクでも大丈夫です。"
          />
          {note ? <p>{note}</p> : null}
          <button className="sh-btn sh-btn--primary" type="button" style={{ width: "100%", minHeight: 48 }}>
            登録する
          </button>
        </>
      ) : null}
    </main>
  );
}
