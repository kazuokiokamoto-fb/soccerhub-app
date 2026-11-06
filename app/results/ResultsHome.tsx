"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorText, fiscalYearLabel, OBLIGATION_TEXT, PHASE_TEXT } from "./labels";

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
        所有者とコーチが、チーム単位の公式戦結果を年度ごとに確認して提出します。期限を過ぎてもログイン、試合、チャット、予定は止まりません。
      </p>
      {error ? <p>{error}</p> : null}
      {payload ? (
        <>
          <p>{payload.discovery.label}</p>
          <p>
            対象期間は日本の年度です。4月1日から翌年3月31日までを、その年の年度とします。例: 2025年度は 2025-04-01 から 2026-03-31 です。提出期限はその翌年度の5月31日の終わり（日本時間）で、2025年度なら 2026-05-31 です。2026-06-01 0:00 から期限超過の表示になります。期限後も提出できます。表示だけで、機能は止めません。
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
                        <Link href={`/results/${team.id}?year=${year.fiscalYear}`}>
                          {fiscalYearLabel(year.fiscalYear)}
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
