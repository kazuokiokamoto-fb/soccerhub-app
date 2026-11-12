"use client";

import { useMemo, useState } from "react";
import { AFFILIATION_CATEGORIES } from "@/lib/affiliation/catalog";
import { parseStandingEdit, type StandingValue } from "@/lib/standings/submit";
import { fiscalYearChoiceLabel } from "./labels";

export type StandingCandidateView = {
  category: string | null;
  rank: number | null;
  sourceUrl: string | null;
  fetchedAt: string | null;
};

export type StandingPhase = "in_progress" | "due" | "overdue";

type RankChoice = "" | "other" | "unknown" | string;

function rankChoiceFor(rank: number | null, unknown: boolean): { choice: RankChoice; custom: string } {
  if (unknown) return { choice: "unknown", custom: "" };
  if (rank == null) return { choice: "", custom: "" };
  if (rank >= 1 && rank <= 20) return { choice: String(rank), custom: "" };
  return { choice: "other", custom: String(rank) };
}

function valueFromChoice(category: string, choice: RankChoice, custom: string): StandingValue | null {
  if (choice === "unknown") return parseStandingEdit({ category, rank: null, unknown: true });
  if (choice === "other") return parseStandingEdit({ category, rank: Number(custom), unknown: false });
  if (!choice) return null;
  return parseStandingEdit({ category, rank: Number(choice), unknown: false });
}

function rankText(rank: number | null, unknown: boolean): string {
  if (unknown || rank == null) return "順位なし・不明";
  return `${rank}位`;
}

function currentRank(choice: RankChoice, custom: string): number | null {
  if (choice === "unknown" || choice === "" ) return null;
  if (choice === "other") {
    const rank = Number(custom);
    return Number.isInteger(rank) ? rank : null;
  }
  const rank = Number(choice);
  return Number.isInteger(rank) ? rank : null;
}

function shiftRank(choice: RankChoice, custom: string, delta: number): { choice: RankChoice; custom: string } {
  const rank = currentRank(choice, custom);
  const next = (rank ?? 0) + delta;
  if (choice === "unknown" && delta < 0) return { choice: "unknown", custom: "" };
  if (next < 1) return { choice: "", custom: "" };
  if (next <= 20) return { choice: String(next), custom: "" };
  if (next > 99) return { choice: "other", custom: "99" };
  return { choice: "other", custom: String(next) };
}

function DeadlineChip({ phase, deadlineYear }: { phase: StandingPhase; deadlineYear: number }) {
  const date = `${deadlineYear}/5/31`;
  if (phase === "overdue") {
    return <span className="status-chip status-chip--late">期限切れ {date}・提出できます</span>;
  }
  if (phase === "due") {
    return <span className="status-chip status-chip--ok">期限内 {date}</span>;
  }
  return <span className="status-chip status-chip--wait">進行中 {date}</span>;
}

export function StandingReportCard({
  teamName,
  year,
  years,
  onYear,
  deadlineYear,
  phase,
  submitted,
  candidate,
  busy,
  message,
  onSubmit,
}: {
  teamName: string;
  year: number;
  years: number[];
  onYear: (year: number) => void;
  deadlineYear: number;
  phase: StandingPhase;
  submitted: { category: string; rank: number | null; unknown: boolean; legacy: boolean } | null;
  candidate: StandingCandidateView | null;
  busy: boolean;
  message: string;
  onSubmit: (mode: "confirm" | "edit", value: StandingValue) => void;
}) {
  const prefilled = Boolean(candidate?.category && candidate.rank != null);
  const initial = rankChoiceFor(candidate?.rank ?? null, false);
  const [editing, setEditing] = useState(!prefilled);
  const [category, setCategory] = useState(candidate?.category ?? "");
  const [choice, setChoice] = useState<RankChoice>(prefilled ? initial.choice : "");
  const [custom, setCustom] = useState(initial.custom);
  const draft = useMemo(() => valueFromChoice(category, choice, custom), [category, choice, custom]);
  const source = candidate?.sourceUrl && /^https?:\/\//i.test(candidate.sourceUrl) ? candidate.sourceUrl : "";
  const shownRank = choice === "unknown" ? "不明" : choice === "other" ? (custom ? `${custom}位` : "—") : choice ? `${choice}位` : "—";

  return (
    <section className="or-section" aria-label="年次報告">
      <div className="or-head">
        <h1>{teamName || "名称未設定"}</h1>
        <label className="or-year">
          <span className="sr-only">年度</span>
          <select className="sh-select" value={year} onChange={(event) => onYear(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item} title={fiscalYearChoiceLabel(item)}>
                {item}年度
              </option>
            ))}
          </select>
        </label>
      </div>
      <DeadlineChip phase={phase} deadlineYear={deadlineYear} />
      {submitted?.legacy ? <p className="or-legacy">以前の形式で提出済み</p> : null}
      {submitted && !submitted.legacy ? (
        <div className="candidate-card">
          <span className="status-chip status-chip--ok">提出済み</span>
          <p className="hero-stat">
            {submitted.category}
            <span> / </span>
            {rankText(submitted.rank, submitted.unknown)}
          </p>
        </div>
      ) : null}
      {!submitted ? (
        <>
          {prefilled && !editing ? (
            <div className="candidate-card">
              <span className="status-badge">未確認</span>
              <p className="hero-stat">
                {candidate?.category}
                <span> / </span>
                {candidate?.rank}位
              </p>
              {source ? (
                <a className="source-link" href={source} target="_blank" rel="noopener noreferrer">
                  出典
                </a>
              ) : null}
            </div>
          ) : (
            <div className="or-fields">
              {prefilled ? <span className="status-badge">未確認</span> : null}
              <div className="chip-block">
                <span>カテゴリ</span>
                <div className="chip-grid" role="radiogroup" aria-label="カテゴリ">
                  {AFFILIATION_CATEGORIES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={category === item}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chip-block">
                <span>順位</span>
                <div className="rank-stepper">
                  <button
                    type="button"
                    aria-label="順位を下げる"
                    onClick={() => {
                      const next = shiftRank(choice, custom, -1);
                      setChoice(next.choice);
                      setCustom(next.custom);
                    }}
                  >
                    −
                  </button>
                  {choice === "other" ? (
                    <input
                      className="sh-input rank-input"
                      inputMode="numeric"
                      aria-label="順位"
                      value={custom}
                      onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                      placeholder="21"
                    />
                  ) : (
                    <strong className="rank-value">{shownRank}</strong>
                  )}
                  <button
                    type="button"
                    aria-label="順位を上げる"
                    onClick={() => {
                      const next = shiftRank(choice, custom, 1);
                      setChoice(next.choice);
                      setCustom(next.custom);
                    }}
                  >
                    ＋
                  </button>
                </div>
                <button
                  type="button"
                  className="unknown-chip"
                  aria-pressed={choice === "unknown"}
                  onClick={() => {
                    setChoice(choice === "unknown" ? "" : "unknown");
                    setCustom("");
                  }}
                >
                  順位なし・不明
                </button>
              </div>
              {source ? (
                <a className="source-link" href={source} target="_blank" rel="noopener noreferrer">
                  出典
                </a>
              ) : null}
            </div>
          )}
          {message ? <p className="or-message">{message}</p> : null}
          <div className="or-actions">
            {prefilled && !editing ? (
              <>
                <button
                  className="sh-btn sh-btn--primary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const value = parseStandingEdit({
                      category: candidate?.category,
                      rank: candidate?.rank,
                      unknown: false,
                    });
                    if (value) onSubmit("confirm", value);
                  }}
                >
                  この内容で提出
                </button>
                <button className="or-quiet" type="button" disabled={busy} onClick={() => setEditing(true)}>
                  直して提出
                </button>
              </>
            ) : (
              <>
                <button
                  className="sh-btn sh-btn--primary"
                  type="button"
                  disabled={busy || !draft}
                  onClick={() => {
                    if (draft) onSubmit("edit", draft);
                  }}
                >
                  {prefilled ? "直して提出" : "この内容で提出"}
                </button>
                {prefilled ? (
                  <button className="or-quiet" type="button" disabled={busy} onClick={() => setEditing(false)}>
                    候補に戻る
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : message ? (
        <p className="or-message">{message}</p>
      ) : null}
    </section>
  );
}
