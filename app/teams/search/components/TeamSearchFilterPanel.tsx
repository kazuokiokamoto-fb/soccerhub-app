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

  keyword: string;
  setKeyword: (v: string) => void;

  categoryFilter: string[];
  setCategoryFilter: (v: string[]) => void;

  prefectureFilter: string;
  setPrefectureFilter: (v: string) => void;

  cityFilter: string;
  setCityFilter: (v: string) => void;

  townFilter: string;
  setTownFilter: (v: string) => void;

  groundFilter: "all" | "あり" | "なし";
  setGroundFilter: (v: "all" | "あり" | "なし") => void;

  strengthFilter: StrengthRank[];
  setStrengthFilter: React.Dispatch<React.SetStateAction<StrengthRank[]>>;

  bikeFilter: "all" | "あり" | "なし" | "不明";
  setBikeFilter: (v: "all" | "あり" | "なし" | "不明") => void;

  bikeCapacityMin: string;
  setBikeCapacityMin: (v: string) => void;

  memberCountMin: string;
  setMemberCountMin: (v: string) => void;

  onReset: () => void;
  onBackToResults: () => void;
  onOpenStrengthHelp: () => void;

  strengthGuides: StrengthGuide[];
  strengthOptions: { value: string; label: string }[];
  liveCount?: number;
};

export function TeamSearchFilterPanel({
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
  onBackToResults,
  onOpenStrengthHelp,
  strengthGuides,
  strengthOptions,
  liveCount = 0,
}: Props) {
  return (
    <section ref={filterRef} style={filterWrap}>
      <div style={panelRoot}>
        <div style={stickyTopArea}>
          <div style={stickyCard}>
            <div style={filterHeaderRow}>
              <div style={{ display: "grid", gap: 4 }}>
                <h2 style={filterTitle}>検索条件</h2>
                <div style={liveCountTitle}>対象チーム数：{liveCount}件</div>
                <div style={liveCountSub}>
                  条件を変えるたびに、この件数がリアルタイムで変わります。
                </div>
              </div>
            </div>

            <div style={stickyActionRow}>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={onBackToResults}
                disabled={loading}
              >
                この条件で一覧を見る
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

        <div style={filterBodyArea}>
          <div style={filterSectionTitle}>絞り込み条件</div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={label}>
              <span style={labelTitle}>キーワード</span>

              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
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
                      setStrengthFilter(
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
                    setGroundFilter(e.target.value as "all" | "あり" | "なし")
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
                  onChange={(e) =>
                    setBikeFilter(
                      e.target.value as "all" | "あり" | "なし" | "不明"
                    )
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
          </div>
        </div>
      </div>
    </section>
  );
}

const panelRoot: React.CSSProperties = {
  display: "grid",
  gap: 0,
};

const stickyTopArea: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  background: "#fff",
  paddingBottom: 12,
};

const stickyCard: React.CSSProperties = {
  display: "grid",
  gap: 12,
  paddingBottom: 12,
  borderBottom: "1px solid #e5ece7",
  background: "#fff",
};

const filterBodyArea: React.CSSProperties = {
  paddingTop: 16,
  display: "grid",
  gap: 12,
};

const filterSectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.5,
};

const stickyActionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const liveCountTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#166534",
  lineHeight: 1.6,
};

const liveCountSub: React.CSSProperties = {
  fontSize: 13,
  color: "#66756d",
  lineHeight: 1.7,
};