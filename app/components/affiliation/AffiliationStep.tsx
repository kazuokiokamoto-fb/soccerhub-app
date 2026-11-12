"use client";

import { RankSuggestion } from "@/app/components/RankSuggestion";
import {
  LEAGUE_DIVISIONS,
  LEAGUE_LEVELS,
  suggestRankFromLeague,
  type LeagueLevelId,
  type StrengthRank,
} from "@/app/match/constants/strengthGuides";
import {
  AFFILIATION_CATEGORIES,
  AFFILIATION_PREFECTURES,
} from "@/lib/affiliation/catalog";
import type { AffiliationDraft } from "@/lib/affiliation/validate";

export function AffiliationStep({
  value,
  onChange,
  disabled = false,
  currentRank = null,
  onApplyRank,
  applyHint,
}: {
  value: AffiliationDraft;
  onChange: (next: AffiliationDraft) => void;
  disabled?: boolean;
  currentRank?: string | null;
  onApplyRank?: (rank: StrengthRank) => void;
  applyHint?: string;
}) {
  const leagueLevel = value.leagueLevel ?? "";
  const leagueDivision = value.leagueDivision ?? "";
  const suggested = value.none ? null : suggestRankFromLeague(leagueLevel, leagueDivision);
  const showDivision = leagueLevel === "prefecture" || leagueLevel === "district";

  function chooseLevel(nextLevel: LeagueLevelId) {
    onChange({
      ...value,
      leagueLevel: nextLevel,
      leagueDivision: nextLevel === "other" ? "" : leagueDivision,
    });
  }

  return (
    <fieldset className="affiliation-step" disabled={disabled}>
      <legend>所属</legend>
      <div className="seg" role="radiogroup" aria-label="所属の有無">
        <label className={!value.none ? "seg-on" : ""}>
          <input
            type="radio"
            name="affiliation-mode"
            checked={!value.none}
            onChange={() => onChange({ ...value, none: false })}
          />
          所属あり
        </label>
        <label className={value.none ? "seg-on" : ""}>
          <input
            type="radio"
            name="affiliation-mode"
            checked={value.none}
            onChange={() =>
              onChange({ ...value, none: true, leagueLevel: "", leagueDivision: "" })
            }
          />
          所属なし
        </label>
      </div>
      {value.none ? null : (
        <div className="affiliation-fields">
          <label>
            <span>都道府県</span>
            <select
              className="sh-select"
              value={value.prefecture}
              onChange={(event) => onChange({ ...value, prefecture: event.target.value })}
            >
              <option value="">選択してください</option>
              {AFFILIATION_PREFECTURES.map((prefecture) => (
                <option key={prefecture} value={prefecture}>
                  {prefecture}
                </option>
              ))}
            </select>
          </label>
          <div className="chip-block">
            <span>カテゴリ</span>
            <div className="chip-grid" role="radiogroup" aria-label="カテゴリ">
              {AFFILIATION_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={value.category === category}
                  onClick={() => onChange({ ...value, category })}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <div className="chip-block">
            <span>リーグ</span>
            <div className="chip-grid" role="radiogroup" aria-label="リーグ">
              {LEAGUE_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  aria-pressed={leagueLevel === level.id}
                  onClick={() => chooseLevel(level.id)}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="affiliation-help">強さの目安に使います。あとから変えられます。</p>
          </div>
          {showDivision ? (
            <div className="chip-block">
              <span>部</span>
              <div className="chip-grid" role="radiogroup" aria-label="部">
                {LEAGUE_DIVISIONS.map((division) => (
                  <button
                    key={division}
                    type="button"
                    aria-pressed={leagueDivision === String(division)}
                    onClick={() => onChange({ ...value, leagueDivision: String(division) })}
                  >
                    {division}部
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <label>
            <span>所属リーグ・連盟名</span>
            <input
              className="sh-input"
              value={value.organizationName}
              onChange={(event) => onChange({ ...value, organizationName: event.target.value })}
              placeholder="リーグ・連盟名"
              maxLength={80}
            />
          </label>
          <RankSuggestion
            suggested={suggested}
            current={currentRank}
            onApply={onApplyRank}
            disabled={disabled}
            hint={applyHint}
          />
        </div>
      )}
    </fieldset>
  );
}
