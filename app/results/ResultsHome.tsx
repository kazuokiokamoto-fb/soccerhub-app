"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorText, fiscalYearChoiceLabel, OBLIGATION_TEXT, PHASE_TEXT } from "./labels";
import "./results.css";

type YearStatus = {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  deadlineDate: string;
  phase: string;
  code: string;
  blocksProduct: false;
  lateSubmission: "allowed";
  report: { state: string; outcome: string } | null;
};

type TeamStatus = {
  id: string;
  name: string;
  role: string;
  years: YearStatus[];
};

type HomePayload = {
  ok: true;
  discovery: { label: string };
  policy: {
    periodKind: string;
    deadlineMonth: number;
    deadlineDay: number;
    deadlineTimeZone: string;
    enforcement: string;
    lateSubmission: string;
  };
  teams: TeamStatus[];
};

export default function ResultsHome() {
  const [payload, setPayload] = useState<HomePayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/official-results");
      const body = (await response.json()) as HomePayload | { ok: false; error: string };
      if (cancelled) return;
      if (!response.ok || !body.ok) {
        setError(errorText("error" in body ? body.error : "read_failed"));
        return;
      }
      setPayload(body);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 880, margin: "0 auto" }}>
      <h1>公式戦の年次報告</h1>
      <p>
        所有者とコーチが、前年度のカテゴリと最終順位を確認して提出します。期限を過ぎてもログイン、試合、チャット、予定は止まりません。
      </p>
      {error ? <p>{error}</p> : null}
      {payload ? (
        <>
          <p>{payload.discovery.label}</p>
          <p>
            対象は日本の年度です。4月1日から翌年3月31日までをその年度とします。提出するのは、その年度のカテゴリと最終順位です。期限は翌年度の5月31日で、過ぎていても提出できます。表示だけで、機能は止めません。
          </p>
          {payload.teams.length === 0 ? (
            <p>報告できるチームはありません。</p>
          ) : (
            <ul>
              {payload.teams.map((team) => (
                <li key={team.id} style={{ marginBottom: 16 }}>
                  <strong>{team.name || "名称未設定"}</strong>
                  <ul>
                    {team.years.map((year) => (
                      <li key={year.fiscalYear}>
                        <Link
                          className="or-year-link"
                          href={`/results/${team.id}?year=${year.fiscalYear}`}
                        >
                          {fiscalYearChoiceLabel(year.fiscalYear)}
                        </Link>
                        <div>
                          {PHASE_TEXT[year.phase] ?? year.phase} 期限 {year.deadlineDate} の終わり（日本時間）。{" "}
                          {OBLIGATION_TEXT[year.code] ?? year.code}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : error ? null : (
        <p>読み込み中です。</p>
      )}
      <p>
        <Link href="/mypage">マイページへ</Link>
      </p>
    </main>
  );
}
