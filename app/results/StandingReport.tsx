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

function fetchedLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function StandingReportCard({
  teamName,
  year,
  years,
  onYear,
  deadlineYear,
  phaseLabel,
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
  phaseLabel: string;
  submitted: { category: string; rank: number | null; unknown: boolean; legacy: boolean } | null;
  candidate: StandingCandidateView | null;
  busy: boolean;
  message: string;
  onSubmit: (mode: "confirm" | "edit", value: StandingValue) => void;
}) {
  const prefilled = candidate?.category && candidate.rank != null;
  const initial = rankChoiceFor(candidate?.rank ?? null, false);
  const [editing, setEditing] = useState(!prefilled);
  const [category, setCategory] = useState(candidate?.category ?? "");
  const [choice, setChoice] = useState<RankChoice>(prefilled ? initial.choice : "");
  const [custom, setCustom] = useState(initial.custom);
  const draft = useMemo(() => valueFromChoice(category, choice, custom), [category, choice, custom]);
  const source = candidate?.sourceUrl && /^https?:\/\//i.test(candidate.sourceUrl) ? candidate.sourceUrl : "";

  return (
    <section className="or-section" aria-label="年次報告">
      <h1>{teamName || "名称未設定"}</h1>
      <label className="or-field">
        <span>年度</span>
        <select
          className="sh-select"
          value={year}
          onChange={(event) => onYear(Number(event.target.value))}
        >
          {years.map((item) => (
            <option key={item} value={item}>
              {fiscalYearChoiceLabel(item)}
            </option>
          ))}
        </select>
      </label>
      <p className="or-hint">
        {phaseLabel}
        <br />
        提出期限は{deadlineYear}年5月31日です。期限を過ぎていても提出できます。ログイン、試合、チャットはそのまま使えます。
      </p>
      {submitted?.legacy ? (
        <p className="or-message">この年度は、以前の試合ごとの形式で提出済みです。</p>
      ) : null}
      {submitted && !submitted.legacy ? (
        <div className="or-line">
          <strong>提出済み</strong>
          <div>カテゴリ：{submitted.category}</div>
          <div>順位：{rankText(submitted.rank, submitted.unknown)}</div>
        </div>
      ) : null}
      {!submitted ? (
        <>
          {prefilled && !editing ? (
            <div className="or-line">
              <strong>集めた候補</strong>
              <div>カテゴリ：{candidate?.category}</div>
              <div>順位：{candidate?.rank}位</div>
              {source ? (
                <a href={source} target="_blank" rel="noopener noreferrer">
                  出典を開く
                </a>
              ) : null}
              {candidate?.fetchedAt ? <div className="or-hint">取得：{fetchedLabel(candidate.fetchedAt)}</div> : null}
            </div>
          ) : (
            <div className="or-fields">
              <label className="or-field">
                <span>カテゴリ</span>
                <select className="sh-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">選択してください</option>
                  {AFFILIATION_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="or-field">
                <span>順位</span>
                <select
                  className="sh-select"
                  value={choice}
                  onChange={(event) => setChoice(event.target.value)}
                >
                  <option value="">選択してください</option>
                  {Array.from({ length: 20 }, (_, index) => String(index + 1)).map((item) => (
                    <option key={item} value={item}>
                      {item}位
                    </option>
                  ))}
                  <option value="other">数値で入力</option>
                  <option value="unknown">順位なし・不明</option>
                </select>
              </label>
              {choice === "other" ? (
                <label className="or-field">
                  <span>順位（1〜99）</span>
                  <input
                    className="sh-input"
                    inputMode="numeric"
                    value={custom}
                    onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                    placeholder="例：24"
                  />
                </label>
              ) : null}
              {source ? (
                <a href={source} target="_blank" rel="noopener noreferrer">
                  出典を開く
                </a>
              ) : null}
            </div>
          )}
          <p className="or-hint">インターネットから集めた順位は、確認して提出するまでは提出になりません。</p>
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
                <button
                  className="sh-btn"
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
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
                  <button className="sh-btn" type="button" disabled={busy} onClick={() => setEditing(false)}>
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
