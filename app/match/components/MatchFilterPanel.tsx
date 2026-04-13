"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  "",
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  "茨城県",
  "栃木県",
  "群馬県",
];

const GROUND_OPTIONS: Array<"all" | "あり" | "なし"> = ["all", "あり", "なし"];
const BIKE_OPTIONS: Array<"all" | "あり" | "なし" | "不明"> = [
  "all",
  "あり",
  "なし",
  "不明",
];
const STRENGTH_OPTIONS: StrengthRank[] = ["SS", "S", "A", "B", "C"];

const CATEGORY_OPTIONS = CATEGORY_MASTER_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}));

async function tryFetchJson(urls: string[]) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      return json;
    } catch {
      continue;
    }
  }
  return null;
}

function normalizeStringList(value: unknown): string[] {
  let raw: string[] = [];

  if (Array.isArray(value)) {
    raw = value.map((v) => String(v ?? "").trim());
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidateKeys = [
      "items",
      "data",
      "results",
      "cities",
      "towns",
      "list",
    ];

    for (const key of candidateKeys) {
      const found = obj[key];
      if (!Array.isArray(found)) continue;

      raw = found.map((v) => {
        if (typeof v === "string") return v.trim();

        if (v && typeof v === "object") {
          const row = v as Record<string, unknown>;
          return String(
            row.town ??
              row.name ??
              row.label ??
              row.value ??
              row.city ??
              row.ward ??
              ""
          ).trim();
        }

        return "";
      });

      break;
    }
  }

  return Array.from(
    new Set(
      raw
        .map((v) => v.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
  );
}

function cleanTownOptions(towns: string[], city: string): string[] {
  const normalizedCity = city.replace(/\s+/g, "").trim();

  return Array.from(
    new Set(
      towns.filter((town) => {
        const normalizedTown = town.replace(/\s+/g, "").trim();

        if (!normalizedTown) return false;
        if (normalizedTown === normalizedCity) return false;
        if (normalizedTown === "未設定") return false;
        if (normalizedTown === "不明") return false;

        return true;
      })
    )
  );
}

type MultiSelectModalProps = {
  open: boolean;
  title: string;
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  onSelectAll?: () => void;
  onClose: () => void;
};

function MultiSelectModal({
  open,
  title,
  options,
  selectedValues,
  onToggle,
  onClear,
  onSelectAll,
  onClose,
}: MultiSelectModalProps) {
  if (!open) return null;

  return (
    <div style={modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={selectModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={selectModalHeader}>
          <div style={selectModalTitle}>{title}</div>
          <button type="button" className="sh-btn" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div style={selectModalActionRow}>
          {onSelectAll ? (
            <button type="button" className="sh-btn" onClick={onSelectAll}>
              全選択
            </button>
          ) : null}
          <button type="button" className="sh-btn" onClick={onClear}>
            クリア
          </button>
        </div>

        <div style={modalChipWrap}>
          {options.map((item) => {
            const selected = selectedValues.includes(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onToggle(item.value)}
                style={selected ? chipActive : chip}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SearchableSelectProps = {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
};

function SearchableSelect({
  label,
  placeholder,
  value,
  options,
  disabled,
  loading,
  onChange,
  onClear,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!value) {
      setQuery("");
    }
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div style={searchableWrap}>
      <div style={subLabel}>{label}</div>

      <input
        className="sh-input"
        placeholder={`${placeholder}を検索`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />

      <select
        className="sh-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">
          {loading ? `${placeholder}を読み込み中…` : `${placeholder}を選択`}
        </option>
        {filteredOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <div style={searchableFooter}>
        <div style={hintText}>
          {loading ? `${placeholder}を読み込み中…` : `${filteredOptions.length}件`}
        </div>

        {value && onClear ? (
          <button type="button" className="sh-btn" onClick={onClear}>
            解除
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [townOptions, setTownOptions] = useState<string[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [townLoading, setTownLoading] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);

  const normalizedPrefecture = useMemo(() => {
    return prefectureFilter.trim();
  }, [prefectureFilter]);

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

  useEffect(() => {
    let active = true;

    const loadCities = async () => {
      if (!normalizedPrefecture) {
        setCityOptions([]);
        return;
      }

      setCityLoading(true);

      const json = await tryFetchJson([
        `/api/address/cities?prefecture=${encodeURIComponent(normalizedPrefecture)}`,
        `/api/address/cities?pref=${encodeURIComponent(normalizedPrefecture)}`,
      ]);

      if (!active) return;

      setCityOptions(normalizeStringList(json));
      setCityLoading(false);
    };

    void loadCities();

    return () => {
      active = false;
    };
  }, [normalizedPrefecture]);

  useEffect(() => {
    let active = true;

    const loadTowns = async () => {
      if (!normalizedPrefecture || !cityFilter.trim()) {
        setTownOptions([]);
        return;
      }

      setTownLoading(true);

      const city = cityFilter.trim();

      const json = await tryFetchJson([
        `/api/address/search-town?prefecture=${encodeURIComponent(
          normalizedPrefecture
        )}&city=${encodeURIComponent(city)}`,
        `/api/address/search-town?pref=${encodeURIComponent(
          normalizedPrefecture
        )}&city=${encodeURIComponent(city)}`,
      ]);

      if (!active) return;

      const rawTowns = normalizeStringList(json);
      setTownOptions(cleanTownOptions(rawTowns, city));
      setTownLoading(false);
    };

    void loadTowns();

    return () => {
      active = false;
    };
  }, [normalizedPrefecture, cityFilter]);

  return (
    <>
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
              <div style={hitCountInlineRow}>
                <span style={hitLabelInline}>{liveCountLabel}</span>
                <span style={hitValueInline}>{liveCountText}</span>
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
            <div style={cardTitle}>都道府県</div>
            <select
              className="sh-select"
              value={prefectureFilter}
              onChange={(e) => {
                setPrefectureFilter(e.target.value);
                setCityFilter("");
                setTownFilter("");
                setCityOptions([]);
                setTownOptions([]);
              }}
              disabled={loading}
            >
              <option value="">都道府県を選択</option>
              {PREF_OPTIONS.filter(Boolean).map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>

          <div style={card}>
            <SearchableSelect
              label="市区町村"
              placeholder="市区町村"
              value={cityFilter}
              options={cityOptions}
              disabled={loading || !normalizedPrefecture}
              loading={cityLoading}
              onChange={(value) => {
                setCityFilter(value);
                setTownFilter("");
                setTownOptions([]);
              }}
              onClear={() => {
                setCityFilter("");
                setTownFilter("");
                setTownOptions([]);
              }}
            />

            <SearchableSelect
              label="町名"
              placeholder="町名"
              value={townFilter}
              options={townOptions}
              disabled={loading || !normalizedPrefecture || !cityFilter.trim()}
              loading={townLoading}
              onChange={(value) => setTownFilter(value)}
              onClear={() => setTownFilter("")}
            />

            <div style={hintText}>
              選択中：
              {prefectureFilter || "未選択"}
              {cityFilter ? ` ＞ ${cityFilter}` : ""}
              {townFilter ? ` ＞ ${townFilter}` : ""}
            </div>
          </div>

          <div style={card}>
            <div style={cardHead}>
              <div>
                <div style={cardTitle}>カテゴリ</div>
                <div style={cardSub}>複数選択できます</div>
              </div>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setShowCategoryModal(true)}
                disabled={loading}
              >
                選択する
              </button>
            </div>

            <div style={chipWrap}>
              {categoryFilter.length === 0 ? (
                <div style={emptySelectedText}>未選択</div>
              ) : (
                categoryFilter.map((value) => (
                  <span key={value} style={selectedChip}>
                    {categoryLabel(value) || value}
                  </span>
                ))
              )}
            </div>
          </div>

          <div style={card}>
            <div style={cardHead}>
              <div>
                <div style={cardTitle}>強さ</div>
                <div style={cardSub}>複数選択できます</div>
              </div>

              <div style={miniActions}>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => setShowStrengthModal(true)}
                  disabled={loading}
                >
                  選択する
                </button>
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
            </div>

            <div style={chipWrap}>
              {strengthFilter.length === 0 ? (
                <div style={emptySelectedText}>未選択</div>
              ) : (
                strengthFilter.map((value) => (
                  <span key={value} style={selectedChip}>
                    {value}
                  </span>
                ))
              )}
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>チーム人数</div>
            <input
              className="sh-input"
              placeholder="最低人数を入力"
              inputMode="numeric"
              value={memberCountMin}
              onChange={(e) => setMemberCountMin(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={card}>
            <div style={cardTitle}>グラウンド</div>
            <select
              className="sh-select"
              value={groundFilter}
              onChange={(e) =>
                setGroundFilter(e.target.value as "all" | "あり" | "なし")
              }
              disabled={loading}
            >
              {GROUND_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "すべて" : value}
                </option>
              ))}
            </select>
          </div>

          <div style={card}>
            <div style={cardTitle}>駐輪場</div>
            <select
              className="sh-select"
              value={bikeFilter}
              onChange={(e) =>
                setBikeFilter(
                  e.target.value as "all" | "あり" | "なし" | "不明"
                )
              }
              disabled={loading}
            >
              {BIKE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "すべて" : value}
                </option>
              ))}
            </select>
          </div>

          <div style={card}>
            <div style={cardTitle}>駐輪台数</div>
            <input
              className="sh-input"
              placeholder="最低駐輪台数を入力"
              inputMode="numeric"
              value={bikeCapacityMin}
              onChange={(e) => setBikeCapacityMin(e.target.value)}
              disabled={loading}
            />
          </div>

          {loading ? <div style={loadingText}>読み込み中…</div> : null}
        </section>
      </section>

      <MultiSelectModal
        open={showCategoryModal}
        title="カテゴリを選択"
        options={CATEGORY_OPTIONS}
        selectedValues={categoryFilter}
        onToggle={toggleCategory}
        onClear={() => setCategoryFilter([])}
        onSelectAll={() =>
          setCategoryFilter(CATEGORY_OPTIONS.map((item) => item.value))
        }
        onClose={() => setShowCategoryModal(false)}
      />

      <MultiSelectModal
        open={showStrengthModal}
        title="強さを選択"
        options={STRENGTH_OPTIONS.map((value) => ({
          value,
          label: value,
        }))}
        selectedValues={strengthFilter}
        onToggle={(value) => toggleStrength(value as StrengthRank)}
        onClear={() => setStrengthFilter([])}
        onClose={() => setShowStrengthModal(false)}
      />
    </>
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

const hitCountInlineRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  minWidth: 0,
  flexWrap: "wrap",
};

const hitLabelInline: React.CSSProperties = {
  fontSize: 14,
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

const miniActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
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

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.38)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 120,
};

const selectModalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "80vh",
  overflowY: "auto",
  borderRadius: 20,
  background: "#fff",
  border: "1px solid #dce9df",
  padding: 16,
  display: "grid",
  gap: 14,
};

const selectModalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const selectModalTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const selectModalActionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const modalChipWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const selectedChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 999,
  background: "#eef7f0",
  border: "1px solid #cfe6d5",
  color: "#2f5d3a",
  fontSize: 14,
  fontWeight: 800,
};

const emptySelectedText: React.CSSProperties = {
  fontSize: 14,
  color: "#6b7280",
  lineHeight: 1.7,
};

const searchableWrap: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const searchableFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};