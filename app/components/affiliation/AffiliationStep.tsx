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
      <p>
        公式戦の結果を探すために、都道府県・カテゴリ・所属リーグまたは連盟名を登録します。所属していない場合は「所属なし」を選ぶと、このまま登録できます。
      </p>
      <div className="affiliation-choice" role="radiogroup" aria-label="所属の有無">
        <label>
          <input
            type="radio"
            name="affiliation-mode"
            checked={!value.none}
            onChange={() => onChange({ ...value, none: false })}
          />
          リーグ・連盟に所属している
        </label>
        <label>
          <input
            type="radio"
            name="affiliation-mode"
            checked={value.none}
            onChange={() => onChange({ ...value, none: true })}
          />
          所属なし
        </label>
      </div>
      {value.none ? (
        <p className="affiliation-note">所属なしで登録できます。結果ページの自動探索は行いません。</p>
      ) : (
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
          <label>
            <span>カテゴリ</span>
            <select
              className="sh-select"
              value={value.category}
              onChange={(event) => onChange({ ...value, category: event.target.value })}
            >
              <option value="">選択してください</option>
              {AFFILIATION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>所属リーグ・連盟名</span>
            <input
              className="sh-input"
              value={value.organizationName}
              onChange={(event) => onChange({ ...value, organizationName: event.target.value })}
              placeholder="例：東京都社会人サッカーリーグ"
              maxLength={80}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
