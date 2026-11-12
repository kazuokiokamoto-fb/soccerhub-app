"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorText, fiscalYearChoiceLabel } from "./labels";
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
      <h1>年次報告</h1>
      {error ? <p>{error}</p> : null}
      {payload ? (
        <>
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
                        <YearChip phase={year.phase} code={year.code} deadlineDate={year.deadlineDate} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : error ? null : (
        <p>読み込み中</p>
      )}
      <p>
        <Link href="/mypage">マイページへ</Link>
      </p>
    </main>
  );
}

function shortDeadline(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}/${Number(month)}/${Number(day)}`;
}

function YearChip({ phase, code, deadlineDate }: { phase: string; code: string; deadlineDate: string }) {
  if (code === "submitted_results" || code === "submitted_none") {
    return <span className="status-chip status-chip--ok">提出済み</span>;
  }
  const date = shortDeadline(deadlineDate);
  if (phase === "overdue") {
    return <span className="status-chip status-chip--late">期限切れ {date}・提出できます</span>;
  }
  if (phase === "due") {
    return <span className="status-chip status-chip--ok">期限内 {date}</span>;
  }
  return <span className="status-chip status-chip--wait">進行中</span>;
}
