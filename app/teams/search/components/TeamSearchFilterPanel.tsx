"use client";

import React from "react";
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import type { StrengthGuide } from "./teamSearchUtils";
import {
  filterWrap,
  filterHeaderRow,
  filterTitle,
  label,
  labelTitle,
  twoCols,
  actionRow,
  strengthCard,
  strengthHead,
  strengthTitleWrap,
  strengthTitleRow,
  strengthTitle,
  strengthSubText,
  strengthHeadRight,
  helpButton,
  strengthSimpleList,
  strengthSimpleButton,
  strengthSimpleButtonDisabled,
  strengthSimpleCode,
} from "./teamSearchStyles";

type Props = {
  filterRef: React.RefObject<HTMLElement | null>;
  loading: boolean;
  draftKeyword: string;
  setDraftKeyword: (v: string) => void;
  draftCategoryFilter: string[];
  setDraftCategoryFilter: (v: string[]) => void;
  draftPrefectureFilter: string;
  setDraftPrefectureFilter: (v: string) => void;
  draftCityFilter: string;
  setDraftCityFilter: (v: string) => void;
  draftTownFilter: string;
  setDraftTownFilter: (v: string) => void;
  draftGroundFilter: "all" | "あり" | "なし";
  setDraftGroundFilter: (v: "all" | "あり" | "なし") => void;
  draftStrengthFilter: StrengthRank[];
  setDraftStrengthFilter: React.Dispatch<React.SetStateAction<StrengthRank[]>>;
  draftBikeFilter: "all" | "あり" | "なし" | "不明";
  setDraftBikeFilter: (v: "all" | "あり" | "なし" | "不明") => void;
  draftBikeCapacityMin: string;
  setDraftBikeCapacityMin: (v: string) => void;
  draftMemberCountMin: string;
  setDraftMemberCountMin: (v: string) => void;
  hasDraftChanges: boolean;
  onApply: () => void;
  onReset: () => void;
  onBackToResults: () => void;
  onOpenStrengthHelp: () => void;
  strengthGuides: StrengthGuide[];
  strengthOptions: { value: string; label: string }[];
};

export function TeamSearchFilterPanel({
  filterRef,
  loading,
  draftKeyword,
  setDraftKeyword,
  draftCategoryFilter,
  setDraftCategoryFilter,
  draftPrefectureFilter,
  setDraftPrefectureFilter,
  draftCityFilter,
  setDraftCityFilter,
  draftTownFilter,
  setDraftTownFilter,
  draftGroundFilter,
  setDraftGroundFilter,
  draftStrengthFilter,
  setDraftStrengthFilter,
  draftBikeFilter,
  setDraftBikeFilter,
  draftBikeCapacityMin,
  setDraftBikeCapacityMin,
  draftMemberCountMin,
  setDraftMemberCountMin,
  hasDraftChanges,
  onApply,
  onReset,
  onBackToResults,
  onOpenStrengthHelp,
  strengthGuides,
  strengthOptions,
}: Props) {
  return (
    <section ref={filterRef} style={filterWrap}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={filterHeaderRow}>
          <h2 style={filterTitle}>検索条件</h2>

          <button type="button" className="sh-btn" onClick={onBackToResults}>
            検索結果へ
          </button>
        </div>

        <label style={label}>
          <span style={labelTitle}>キーワード</span>

          <input
            value={draftKeyword}
            onChange={(e) => setDraftKeyword(e.target.value)}
            className="sh-input"
            disabled={loading}
            placeholder="例：三宿 / 青 / 強度高め / U-12 / SS"
          />
        </label>

        <AreaPickerKanto
          title="エリア"
          allowAll={true}
          allLabel="関東（すべて）"
          disabled={loading}
          prefecture={draftPrefectureFilter}
          setPrefecture={setDraftPrefectureFilter}
          city={draftCityFilter}
          setCity={setDraftCityFilter}
          town={draftTownFilter}
          setTown={setDraftTownFilter}
          townOptional={true}
          useChipUI={true}
        />

        <CheckboxGroup
          title="カテゴリ"
          options={CATEGORY_OPTIONS}
          values={draftCategoryFilter}
          onChange={setDraftCategoryFilter}
          columns={3}
          disabled={loading}
          useChipUI={true}
        />

        <div style={strengthCard}>
          <div style={strengthHead}>
            <div style={strengthTitleWrap}>
              <div style={strengthTitleRow}>
                <div style={strengthTitle}>強さ</div>
                <button
                  type="button"
                  aria-label="強さの説明"
                  title="強さの説明"
                  style={helpButton}
                  onClick={onOpenStrengthHelp}
                  disabled={loading}
                >
                  ?
                </button>
              </div>
              <div style={strengthSubText}>複数選択できます</div>
            </div>

            <div style={strengthHeadRight}>
              <button
                type="button"
                className="sh-btn sh-btn--ghost"
                onClick={() =>
                  setDraftStrengthFilter(
                    strengthOptions.map((o) => o.value as StrengthRank)
                  )
                }
                disabled={loading}
              >
                全選択
              </button>

              <button
                type="button"
                className="sh-btn"
                onClick={() => setDraftStrengthFilter([])}
                disabled={loading}
              >
                クリア
              </button>
            </div>
          </div>

          <div style={strengthSimpleList}>
            {strengthGuides.map((item) => {
              const active = draftStrengthFilter.includes(item.rank);

              return (
                <button
                  key={item.rank}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setDraftStrengthFilter((prev) => {
                      if (prev.includes(item.rank)) {
                        return prev.filter((v) => v !== item.rank);
                      }
                      return [...prev, item.rank];
                    });
                  }}
                  aria-pressed={active}
                  style={{
                    ...strengthSimpleButton,
                    border: active ? "1px solid #145c2a" : "1px solid #d6eadb",
                    background: active ? "#145c2a" : "#fff",
                    color: active ? "#fff" : "#23412c",
                    boxShadow: active
                      ? "0 6px 14px rgba(20,92,42,0.14)"
                      : "none",
                    ...(loading ? strengthSimpleButtonDisabled : {}),
                  }}
                >
                  <span style={strengthSimpleCode}>{item.rank}</span>
                  <span>{item.short}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={twoCols}>
          <label style={label}>
            <span style={labelTitle}>チーム所属人数（以上）</span>

            <select
              value={draftMemberCountMin}
              onChange={(e) => setDraftMemberCountMin(e.target.value)}
              className="sh-select"
              disabled={loading}
            >
              <option value="">指定なし</option>
              <option value="5">5人以上</option>
              <option value="10">10人以上</option>
              <option value="15">15人以上</option>
              <option value="20">20人以上</option>
              <option value="25">25人以上</option>
              <option value="30">30人以上</option>
            </select>
          </label>

          <label style={label}>
            <span style={labelTitle}>グラウンド</span>

            <select
              value={draftGroundFilter}
              onChange={(e) => setDraftGroundFilter(e.target.value as "all" | "あり" | "なし")}
              className="sh-select"
              disabled={loading}
            >
              <option value="all">指定なし</option>
              <option value="あり">あり</option>
              <option value="なし">なし</option>
            </select>
          </label>
        </div>

        <div style={twoCols}>
          <label style={label}>
            <span style={labelTitle}>駐輪場</span>

            <select
              value={draftBikeFilter}
              onChange={(e) =>
                setDraftBikeFilter(e.target.value as "all" | "あり" | "なし" | "不明")
              }
              className="sh-select"
              disabled={loading}
            >
              <option value="all">指定なし</option>
              <option value="あり">あり</option>
              <option value="なし">なし</option>
              <option value="不明">不明</option>
            </select>
          </label>

          <label style={label}>
            <span style={labelTitle}>駐輪場台数（以上）</span>

            <select
              value={draftBikeCapacityMin}
              onChange={(e) => setDraftBikeCapacityMin(e.target.value)}
              className="sh-select"
              disabled={loading}
            >
              <option value="">指定なし</option>
              <option value="5">5台以上</option>
              <option value="10">10台以上</option>
              <option value="15">15台以上</option>
              <option value="20">20台以上</option>
              <option value="25">25台以上</option>
              <option value="30">30台以上</option>
              <option value="40">40台以上</option>
              <option value="50">50台以上</option>
            </select>
          </label>
        </div>

        <div style={actionRow}>
          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={onApply}
            disabled={!hasDraftChanges || loading}
          >
            この条件で一覧表示
          </button>

          <button
            type="button"
            className="sh-btn"
            onClick={onReset}
            disabled={loading}
          >
            条件リセット
          </button>
        </div>
      </div>
    </section>
  );
}