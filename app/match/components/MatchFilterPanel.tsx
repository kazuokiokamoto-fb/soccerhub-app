"use client";

import React from "react";
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";

import {
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

  keyword: string;
  setKeyword: React.Dispatch<React.SetStateAction<string>>;

  categoryFilter: string[];
  setCategoryFilter: React.Dispatch<React.SetStateAction<string[]>>;

  prefectureFilter: string;
  setPrefectureFilter: React.Dispatch<React.SetStateAction<string>>;

  cityFilter: string;
  setCityFilter: React.Dispatch<React.SetStateAction<string>>;

  townFilter: string;
  setTownFilter: React.Dispatch<React.SetStateAction<string>>;

  groundFilter: GroundFilter;
  setGroundFilter: React.Dispatch<React.SetStateAction<GroundFilter>>;

  strengthFilter: StrengthRank[];
  setStrengthFilter: React.Dispatch<React.SetStateAction<StrengthRank[]>>;

  bikeFilter: BikeFilter;
  setBikeFilter: React.Dispatch<React.SetStateAction<BikeFilter>>;

  bikeCapacityMin: string;
  setBikeCapacityMin: React.Dispatch<React.SetStateAction<string>>;

  memberCountMin: string;
  setMemberCountMin: React.Dispatch<React.SetStateAction<string>>;

  onReset: () => void;
  onBackToList: () => void;
  onBackToCalendar?: () => void;
  onOpenStrengthHelp: () => void;
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
  keyword,
  setKeyword,
  categoryFilter,
  setCategoryFilter,
  prefectureFilter,
  setPrefectureFilter,
  cityFilter,
  setCityFilter,
  townFilter,
  setTownFilter,
  groundFilter,
  setGroundFilter,
  strengthFilter,
  setStrengthFilter,
  bikeFilter,
  setBikeFilter,
  bikeCapacityMin,
  setBikeCapacityMin,
  memberCountMin,
  setMemberCountMin,
  onReset,
  onBackToList,
  onBackToCalendar,
  onOpenStrengthHelp,
  onOpenTeamList,
  strengthGuides,
  bandText = "条件検索",
  titleText = "相手を探す",
  descriptionText = "レベル・エリア・人数感などから対戦相手を探せます。",
  liveCountLabel = "現在のヒット件数",
  liveCountText = "0件",
}: Props) {
  return (
    <section ref={filterRef} style={overlay} aria-modal="true" role="dialog">
      <div style={modal}>
        <div style={stickyTopBox}>
          <div style={stickyCountBox}>
            <div style={stickyCountLabel}>{liveCountLabel}</div>
            <div style={stickyCountValue}>{liveCountText}</div>
            <div style={stickyCountSub}>
              条件を変えるたびに、この件数がリアルタイムで変わります
            </div>
          </div>

          <div style={stickyTopActions}>
            {onBackToCalendar ? (
              <button
                type="button"
                className="sh-btn"
                onClick={onBackToCalendar}
                disabled={loading}
              >
                カレンダーへ戻る
              </button>
            ) : null}

            {onOpenTeamList ? (
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={onOpenTeamList}
                disabled={loading}
              >
                チーム一覧
              </button>
            ) : null}
          </div>
        </div>

        <div style={modalBody}>
          <div style={panelInner}>
            <div style={sectionLeadWrap}>
              <div style={sectionBand}>{bandText}</div>
              <div style={sectionLeadTitle}>{titleText}</div>
              <div style={sectionLeadDesc}>{descriptionText}</div>
            </div>

            <div style={filterHeaderRow}>
              <h2 style={filterTitle}>絞り込み条件</h2>

              <div style={headerActions}>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={onReset}
                  disabled={loading}
                >
                  条件リセット
                </button>

                <button
                  type="button"
                  className="sh-btn"
                  onClick={onBackToList}
                  disabled={loading}
                >
                  閉じる
                </button>
              </div>
            </div>

            <label style={label}>
              <span style={labelTitle}>キーワード</span>

              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
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
              prefecture={prefectureFilter}
              setPrefecture={setPrefectureFilter}
              city={cityFilter}
              setCity={setCityFilter}
              town={townFilter}
              setTown={setTownFilter}
              townOptional={true}
              useChipUI={true}
            />

            <CheckboxGroup
              title="カテゴリ"
              options={CATEGORY_OPTIONS}
              values={categoryFilter}
              onChange={setCategoryFilter}
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
                      setStrengthFilter(strengthGuides.map((o) => o.rank))
                    }
                    disabled={loading}
                  >
                    全選択
                  </button>

                  <button
                    type="button"
                    className="sh-btn"
                    onClick={() => setStrengthFilter([])}
                    disabled={loading}
                  >
                    クリア
                  </button>
                </div>
              </div>

              <div style={strengthSimpleList}>
                {strengthGuides.map((item) => {
                  const active = strengthFilter.includes(item.rank);

                  return (
                    <button
                      key={item.rank}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setStrengthFilter((prev) => {
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
                  value={memberCountMin}
                  onChange={(e) => setMemberCountMin(e.target.value)}
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
                  value={groundFilter}
                  onChange={(e) =>
                    setGroundFilter(e.target.value as GroundFilter)
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
                  value={bikeFilter}
                  onChange={(e) => setBikeFilter(e.target.value as BikeFilter)}
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
                  value={bikeCapacityMin}
                  onChange={(e) => setBikeCapacityMin(e.target.value)}
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

            <div style={footerNote}>
              条件を選んだら、上の
              「カレンダーへ戻る」または「チーム一覧」を押してください。
            </div>

            <div style={actionRow}>
              <button
                type="button"
                className="sh-btn"
                onClick={onBackToList}
                disabled={loading}
              >
                閉じる
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
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #86efac",
  background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  boxShadow: "0 8px 20px rgba(20,92,42,0.10)",
};

const stickyTopActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  width: "100%",
  justifyContent: "flex-end",
};

const modalBody: React.CSSProperties = {
  padding: 16,
};

const panelInner: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const stickyCountLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#166534",
  letterSpacing: "0.04em",
};

const stickyCountValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#14532d",
  lineHeight: 1.15,
};

const stickyCountSub: React.CSSProperties = {
  fontSize: 12,
  color: "#3f5f47",
  lineHeight: 1.6,
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

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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

const footerNote: React.CSSProperties = {
  fontSize: 12,
  color: "#5b6470",
  lineHeight: 1.7,
  padding: "4px 2px 0",
};