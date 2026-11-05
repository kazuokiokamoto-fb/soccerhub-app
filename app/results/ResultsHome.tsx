"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorText, OBLIGATION_TEXT } from "./labels";

type TeamStatus = {
  id: string;
  name: string;
  role: string;
  report: { state: string; outcome: string; reportingYear: number } | null;
};

type HomePayload = {
  ok: true;
  discovery: { label: string };
  policy: {
    yearStatus: "unset" | "configured";
    reportingYear: number | null;
    deadlineMonth: number | null;
    deadlineDay: number | null;
  };
  teams: TeamStatus[];
};

function obligationCode(policy: HomePayload["policy"], report: TeamStatus["report"]) {
  if (policy.yearStatus !== "configured" || policy.reportingYear === null) return "year_unset";
  if (!report) return "not_started";
  if (report.state === "draft") return "draft";
  if (report.state === "in_review") return "in_review";
  if (report.outcome === "no_official_results") return "submitted_none";
  return "submitted_results";
}

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
        管理者とコーチが、チーム単位の公式戦結果を年ごとに確認して提出します。試合、チャット、サイトの利用は止めません。
      </p>
      {error ? <p>{error}</p> : null}
      {payload ? (
        <>
          <p>{payload.discovery.label}</p>
          <p>
            {payload.policy.yearStatus === "configured" && payload.policy.reportingYear
              ? `設定されている対象年は ${payload.policy.reportingYear} 年です。`
              : "対象年は未設定です。方針が決まるまで、特定の年を必須にはしていません。"}
            {payload.policy.deadlineMonth && payload.policy.deadlineDay
              ? ` 期限の設定値は ${payload.policy.deadlineMonth}/${payload.policy.deadlineDay} です。表示だけで、機能停止には使いません。`
              : " 期限は未設定です。"}
          </p>
          {payload.teams.length === 0 ? (
            <p>報告できるチームはありません。</p>
          ) : (
            <ul>
              {payload.teams.map((team) => {
                const code = obligationCode(payload.policy, team.report);
                const year = payload.policy.reportingYear;
                const href = year ? `/results/${team.id}?year=${year}` : `/results/${team.id}`;
                return (
                  <li key={team.id} style={{ marginBottom: 12 }}>
                    <Link href={href}>{team.name || "名称未設定"}</Link>
                    <div>{OBLIGATION_TEXT[code]}</div>
                  </li>
                );
              })}
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
