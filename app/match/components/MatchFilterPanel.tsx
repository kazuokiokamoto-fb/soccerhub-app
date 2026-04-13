"use client";

import React from "react";
import {
  CATEGORY_OPTIONS as CATEGORY_MASTER_OPTIONS,
  categoryLabel,
} from "@/app/lib/categories";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";

type StrengthGuide = {
  rank: string;
  short: string;
  title: string;
  bullets: string[];
  note: string;
};

type MatchFilterPanelProps = {
  filterRef?: React.RefObject<HTMLElement | null>;
  loading?: boolean;

  keyword: string;
  setKeyword: (value: string) => void;

  categoryFilter: string[];
  setCategoryFilter: (value: string[]) => void;

  prefectureFilter: string;
  setPrefectureFilter: (value: string) => void;

  cityFilter: string;
  setCityFilter: (value: string) => void;

  townFilter: string;
  setTownFilter: (value: string) => void;

  groundFilter: "all" | "あり" | "なし";
  setGroundFilter: (value: "all" | "あり" | "なし") => void;

  strengthFilter: StrengthRank[];
  setStrengthFilter: (value: StrengthRank[]) => void;

  bikeFilter: "all" | "あり" | "なし" | "不明";
  setBikeFilter: (value: "all" | "あり" | "なし" | "不明") => void;

  bikeCapacityMin: string;
  setBikeCapacityMin: (value: string) => void;

  memberCountMin: string;
  setMemberCountMin: (value: string) => void;

  onBackToCalendar: () => void;
  onOpenTeamList: () => void;
  onReset: () => void;
  onBackToList: () => void;
  onOpenStrengthHelp: () => void;

  strengthGuides: StrengthGuide[];

  titleText?: string;
  descriptionText?: string;
  liveCountLabel?: string;
  liveCountText?: string;

  hideFilterBadge?: boolean;
  inlineHeaderActions?: boolean;

  showTopActions?: boolean;
  showTopHitBox?: boolean;
  stickyHitBox?: boolean;
  renderHeaderActionsInHitBox?: boolean;

  hidePanelHeader?: boolean;
  hidePanelTitleBlock?: boolean;
  compactTopHitBox?: boolean;
};

const PREF_OPTIONS = [
  "関東（すべて）",
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  "茨城県",
  "栃木県",
  "群馬県",
];

const CATEGORY_OPTIONS = CATEGORY_MASTER_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}));

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
  onBackToCalendar,
  onOpenTeamList,
  onReset,
  onBackToList,
  onOpenStrengthHelp,
  titleText = "相手を探す",
  descriptionText = "レベル・エリア・人数感などから相手チームを探せます。",
  liveCountLabel = "現在のヒット件数",
  liveCountText = "",
  hideFilterBadge = false,
  inlineHeaderActions = false,
  showTopActions = true,
  showTopHitBox = true,
  stickyHitBox = false,
  renderHeaderActionsInHitBox = false,
  hidePanelHeader = false,
  hidePanelTitleBlock = false,
  compactTopHitBox = false,
}: MatchFilterPanelProps) {
  const toggleStrength = (rank: StrengthRank) => {
    if (strengthFilter.includes(rank)) {
      setStrengthFilter(strengthFilter.filter((v) => v !== rank));
    } else {
      setStrengthFilter([...strengthFilter, rank]);
    }
  };

  const toggleCategory = (value: string) => {
    if (categoryFilter.includes(value)) {
      setCategoryFilter(categoryFilter.filter((v) => v !== value));
    } else {
      setCategoryFilter([...categoryFilter, value]);
    }
  };

  return (
    <section style={wrap}>
      {showTopHitBox ? (
        <section
          style={{
            ...hitBox,
            ...(compactTopHitBox ? compactHitBox : {}),
            ...(stickyHitBox ? stickyHitBoxStyle : {}),
          }}
        >
          <div style={hitMainRow}>
            <div style={hitCountBlock}>
              <div style={hitLabelInline}>{liveCountLabel}</div>
              <div style={hitValueInline}>{liveCountText}</div>
            </div>

            <div style={hitBottomActions}>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={onOpenTeamList}
                disabled={loading}
              >
                チーム一覧
              </button>

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
        </section>
      ) : null}

      <section ref={filterRef} style={panelBox}>
        {!hidePanelHeader ? (
          <div style={headerRow}>
            {!hidePanelTitleBlock ? (
              <div style={headerLeft}>
                {!hideFilterBadge ? <div style={tinyBadge}>条件検索</div> : null}
                <div style={title}>{titleText}</div>
                <div style={desc}>{descriptionText}</div>
              </div>
            ) : (
              <div />
            )}

            {!renderHeaderActionsInHitBox && inlineHeaderActions ? (
              <div style={headerActions}>
                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={onOpenTeamList}
                  disabled={loading}
                >
                  チーム一覧
                </button>
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
            ) : null}
          </div>
        ) : null}

        {!renderHeaderActionsInHitBox &&
        !inlineHeaderActions &&
        !hidePanelHeader ? (
          <div style={actionRow}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={onOpenTeamList}
              disabled={loading}
            >
              チーム一覧
            </button>
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
        ) : null}

        <div style={sectionTitle}>絞り込み条件</div>

        <div style={fieldBlock}>
          <div style={label}>キーワード</div>
          <input
            className="sh-input"
            placeholder="例：三宿 / 青 / 小学5年 / キッズ / SS"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div style={card}>
          <div style={cardTitle}>エリア</div>

          <div style={subLabel}>都県</div>
          <div style={chipWrap}>
            {PREF_OPTIONS.map((pref) => {
              const selected = prefectureFilter === pref;
              return (
                <button
                  key={pref}
                  type="button"
                  onClick={() => setPrefectureFilter(selected ? "" : pref)}
                  style={{
                    ...(selected ? chipActive : chip),
                    ...(loading ? disabledButtonStyle : {}),
                  }}
                  disabled={loading}
                >
                  {pref}
                </button>
              );
            })}
          </div>

          <div style={hintText}>表示例：{prefectureFilter || "未選択"}</div>

          <div style={inlineInputs}>
            <input
              className="sh-input"
              placeholder="市区町村"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              disabled={loading}
            />
            <input
              className="sh-input"
              placeholder="町名"
              value={townFilter}
              onChange={(e) => setTownFilter(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>カテゴリ</div>
              <div style={cardSub}>複数選択できます</div>
            </div>
            <div style={miniActions}>
              <button
                type="button"
                className="sh-btn"
                onClick={() =>
                  setCategoryFilter(CATEGORY_OPTIONS.map((item) => item.value))
                }
                disabled={loading}
              >
                全選択
              </button>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setCategoryFilter([])}
                disabled={loading}
              >
                クリア
              </button>
            </div>
          </div>

          <div style={chipWrap}>
            {CATEGORY_OPTIONS.map((item) => {
              const selected = categoryFilter.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => toggleCategory(item.value)}
                  style={{
                    ...(selected ? chipActive : chip),
                    ...(loading ? disabledButtonStyle : {}),
                  }}
                  disabled={loading}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {categoryFilter.length > 0 ? (
            <div style={hintText}>
              選択中：
              {categoryFilter.map((v) => categoryLabel(v) || v).join(" / ")}
            </div>
          ) : null}
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div>
              <div style={cardTitle}>強さ</div>
              <div style={cardSub}>複数選択できます</div>
            </div>
            <button
              type="button"
              style={{
                ...helpBtn,
                ...(loading ? disabledButtonStyle : {}),
              }}
              onClick={onOpenStrengthHelp}
              aria-label="強さの説明"
              disabled={loading}
            >
              ？
            </button>
          </div>

          <div style={chipWrap}>
            {(["SS", "S", "A", "B", "C"] as StrengthRank[]).map((rank) => {
              const selected = strengthFilter.includes(rank);
              return (
                <button
                  key={rank}
                  type="button"
                  onClick={() => toggleStrength(rank)}
                  style={{
                    ...(selected ? chipActive : chip),
                    ...(loading ? disabledButtonStyle : {}),
                  }}
                  disabled={loading}
                >
                  {rank}
                </button>
              );
            })}
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>グラウンド</div>
          <div style={chipWrap}>
            {["all", "あり", "なし"].map((value) => {
              const selected = groundFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setGroundFilter(value as "all" | "あり" | "なし")
                  }
                  style={{
                    ...(selected ? chipActive : chip),
                    ...(loading ? disabledButtonStyle : {}),
                  }}
                  disabled={loading}
                >
                  {value === "all" ? "すべて" : value}
                </button>
              );
            })}
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>駐輪場</div>
          <div style={chipWrap}>
            {["all", "あり", "なし", "不明"].map((value) => {
              const selected = bikeFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setBikeFilter(value as "all" | "あり" | "なし" | "不明")
                  }
                  style={{
                    ...(selected ? chipActive : chip),
                    ...(loading ? disabledButtonStyle : {}),
                  }}
                  disabled={loading}
                >
                  {value === "all" ? "すべて" : value}
                </button>
              );
            })}
          </div>

          <div style={inlineInputs}>
            <input
              className="sh-input"
              placeholder="最低駐輪台数"
              inputMode="numeric"
              value={bikeCapacityMin}
              onChange={(e) => setBikeCapacityMin(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>所属人数</div>
          <div style={inlineInputs}>
            <input
              className="sh-input"
              placeholder="最低人数"
              inputMode="numeric"
              value={memberCountMin}
              onChange={(e) => setMemberCountMin(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {loading ? <div style={loadingText}>読み込み中…</div> : null}
      </section>
    </section>
  );
}

const wrap: React.CSSProperties = {
  display: "block",
};

const hitBox: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#fff",
  padding: 12,
};

const compactHitBox: React.CSSProperties = {
  padding: "10px 12px",
};

const stickyHitBoxStyle: React.CSSProperties = {
  position: "sticky",
  top: 8,
  zIndex: 40,
};

const hitMainRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const hitCountBlock: React.CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const hitLabelInline: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#5f6f66",
  lineHeight: 1.2,
};

const hitValueInline: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#14532d",
  lineHeight: 1.1,
};

const hitSub: React.CSSProperties = {
  display: "none",
};

const topActions: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const hitBottomActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  marginLeft: "auto",
};

const panelBox: React.CSSProperties = {
  marginTop: 10,
  borderRadius: 18,
  border: "1px solid #dce9df",
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 18,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const headerLeft: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 8,
};

const tinyBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: 28,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #cfe6d5",
  background: "#eef7f0",
  color: "#2f5d3a",
  fontSize: 14,
  fontWeight: 800,
};

const title: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.2,
};

const desc: React.CSSProperties = {
  fontSize: 16,
  color: "#5f6f66",
  lineHeight: 1.8,
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginLeft: "auto",
  justifyContent: "flex-end",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#2f5d3a",
};

const fieldBlock: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const label: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#22372a",
};

const card: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 14,
};

const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const cardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#2f5d3a",
};

const cardSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 14,
  color: "#6b7280",
};

const subLabel: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#22372a",
};

const hintText: React.CSSProperties = {
  color: "#6b7280",
  lineHeight: 1.7,
};

const chipWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const chip: React.CSSProperties = {
  minHeight: 48,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid #cfe0d3",
  background: "#fff",
  color: "#22372a",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const chipActive: React.CSSProperties = {
  ...chip,
  background: "#2f7d3d",
  border: "1px solid #2f7d3d",
  color: "#fff",
};

const inlineInputs: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const miniActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const helpBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "1px solid #cfe0d3",
  background: "#fff",
  color: "#2f5d3a",
  fontSize: 20,
  fontWeight: 900,
  cursor: "pointer",
};

const loadingText: React.CSSProperties = {
  textAlign: "center",
  color: "#6b7280",
  padding: 8,
};

const disabledButtonStyle: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};