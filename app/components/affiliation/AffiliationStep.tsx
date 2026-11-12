"use client";

import {
  AFFILIATION_CATEGORIES,
  AFFILIATION_PREFECTURES,
} from "@/lib/affiliation/catalog";
import type { AffiliationDraft } from "@/lib/affiliation/validate";

export function AffiliationStep({
  value,
  onChange,
  disabled = false,
}: {
  value: AffiliationDraft;
  onChange: (next: AffiliationDraft) => void;
  disabled?: boolean;
}) {
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
            onChange={() => onChange({ ...value, none: true })}
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
        </div>
      )}
    </fieldset>
  );
}
