"use client";

import React from "react";
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";

import {
  filterWrap,
  filterHeaderRow,
  filterTitle,
  label,
  labelTitle,
  twoCols,
  actionRow,
} from "../styles/matchPageStyles";

type StrengthGuide = {
  rank: StrengthRank;
  short: string;
  title: string;
  bullets: string[];
  note: string;
};

type GroundFilter = "all" | "あり" | "なし";
type BikeFilter = "all" | "あり" | "なし" | "不明";

type Props = {
  filterRef: React.RefObject<HTMLElement | null>;
  loading: boolean;

  draftKeyword: string;
  setDraftKeyword: (value: string) => void;

  draftCategoryFilter: string[];
  setDraftCategoryFilter: (value: string[]) => void;

  draftPrefectureFilter: string;
  setDraftPrefectureFilter: (value: string) => void;

  draftCityFilter: string;
  setDraftCityFilter: (value: string) => void;

  draftTownFilter: string;
  setDraftTownFilter: (value: string) => void;

  draftGroundFilter: GroundFilter;
  setDraftGroundFilter: React.Dispatch<React.SetStateAction<GroundFilter>>;

  draftStrengthFilter: StrengthRank[];
  setDraftStrengthFilter: React.Dispatch<React.SetStateAction<StrengthRank[]>>;

  draftBikeFilter: BikeFilter;
  setDraftBikeFilter: React.Dispatch<React.SetStateAction<BikeFilter>>;

  draftBikeCapacityMin: string;
  setDraftBikeCapacityMin: (value: string) => void;

  draftMemberCountMin: string;
  setDraftMemberCountMin: (value: string) => void;

  hasDraftChanges?: boolean;
  onApply: () => void;
  onReset: () => void;
  onBackToList: () => void;
  onOpenStrengthHelp: () => void;

  onApplyToCalendar?: () => void;
  onOpenTeamList?: () => void;

  strengthGuides: StrengthGuide[];

  bandText?: string;
  titleText?: string;
  descriptionText?: string;

  liveCountLabel?: string;
  liveCountText?: string;
};

export function MatchFilterPanel({
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
  onApply,
  onReset,
  onBackToList,
  onOpenStrengthHelp,
  onApplyToCalendar,
  onOpenTeamList,
  strengthGuides,
  bandText = "条件検索",
  titleText = "相手を探す",
  descriptionText = "レベル・エリア・人数感などから対戦相手を探せます。",
  liveCountLabel = "現在のヒット件数",
  liveCountText = "0件",
}: Props) {
  return (
    <section ref={filterRef} style={overlay}>
      <div style={modal}>
        <div style={stickyTopBox}>
          <div style={stickyCountBox}>
            <div style={stickyCountLabel}>{liveCountLabel}</div>
            <div style={stickyCountValue}>{liveCountText}</div>
          </div>

          <div style={stickyTopActions}>
            {onApplyToCalendar ? (
              <button
                type="button"
                className="sh-btn"
                onClick={onApplyToCalendar}
                disabled={loading}
              >
                カレンダーに反映
              </button>
            ) : null}

            {onOpenTeamList ? (
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={onOpenTeamList}
                disabled={loading}
              >
                チーム一覧表示
              </button>
            ) : null}
          </div>
        </div>

        <div style={modalBody}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={sectionLeadWrap}>
              <div style={sectionBand}>{bandText}</div>
              <div style={sectionLeadTitle}>{titleText}</div>
              <div style={sectionLeadDesc}>{descriptionText}</div>
            </div>

            <div style={filterHeaderRow}>
              <h2 style={filterTitle}>絞り込み条件</h2>

              <button
                type="button"
                className="sh-btn"
                onClick={onBackToList}
                disabled={loading}
              >
                閉じる
              </button>
            </div>

            <label style={label}>
              <span style={labelTitle}>キーワード</span>

              <input
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                className="sh-input"
                disabled={loading}
                placeholder="例：三宿 / 青 / 強度高め / 小学5年 / キッズ / SS"
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
                      setDraftStrengthFilter(strengthGuides.map((o) => o.rank))
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
                        border: active
                          ? "1px solid #145c2a"
                          : "1px solid #d6eadb",
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
                  onChange={(e) =>
                    setDraftGroundFilter(e.target.value as GroundFilter)
                  }
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
                    setDraftBikeFilter(e.target.value as BikeFilter)
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
                disabled={loading}
              >
                条件決定
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
        </div>
      </div>
    </section>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  background: "rgba(15, 23, 42, 0.28)",
  padding: 16,
  overflowY: "auto",
};

const modal: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  background: "#fff",
  borderRadius: 24,
  border: "1px solid #dce9df",
  boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

const stickyTopBox: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  background: "#fff",
  padding: 16,
  borderBottom: "1px solid #e5ece7",
  display: "grid",
  gap: 12,
};

const stickyCountBox: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  boxShadow: "0 8px 20px rgba(20,92,42,0.08)",
};

const stickyTopActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const modalBody: React.CSSProperties = {
  padding: 16,
};

const stickyCountLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#166534",
  letterSpacing: "0.04em",
};

const stickyCountValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#14532d",
  lineHeight: 1.2,
};

const sectionLeadWrap: React.CSSProperties = {
  display: "grid",
  gap: 8,
  paddingBottom: 4,
};

const sectionBand: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#e8f5ec",
  color: "#145c2a",
  border: "1px solid #cfe8d7",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const sectionLeadTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const sectionLeadDesc: React.CSSProperties = {
  fontSize: 14,
  color: "#5b6470",
  lineHeight: 1.7,
};

const strengthCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const strengthHead: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const strengthTitleWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const strengthTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const strengthTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
};

const strengthSubText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const strengthHeadRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const helpButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#23412c",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  transition: "all 0.15s ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

const strengthSimpleList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const strengthSimpleButton: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d6eadb",
  background: "#fff",
  cursor: "pointer",
  transition: "all 0.15s ease",
  fontSize: 14,
  fontWeight: 800,
  color: "#23412c",
  lineHeight: 1.5,
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

const strengthSimpleButtonDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const strengthSimpleCode: React.CSSProperties = {
  display: "inline-block",
  minWidth: 28,
  fontWeight: 900,
};