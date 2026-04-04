"use client";

import React from "react";
import Link from "next/link";
import type { DbTeam } from "./teamSearchUtils";
import {
  buildAreaText,
  formatBikeParking,
  formatTeamCategory,
  getMemberCount,
  getStrength,
} from "./teamSearchUtils";
import {
  dayListWrap,
  dayListHeaderRow,
  dayListTitle,
  emptyBox,
  resultCard,
  resultHeader,
  resultHeaderRight,
  resultTitle,
  resultSub,
  strengthBadge,
  detailWrap,
  detailGrid,
  detailBox,
  detailLabel,
  detailValue,
  buttonRow,
} from "./teamSearchStyles";

type Props = {
  loading: boolean;
  filteredTeams: DbTeam[];
  myTeams: DbTeam[];
  openTeamId: string;
  setOpenTeamId: (v: string) => void;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  onScrollToFilter: () => void;
  onOpenDmAndGo: (otherTeamId: string) => void;
  onOpenOfferModal: (team: DbTeam) => void;
};

export function TeamSearchResultList({
  loading,
  filteredTeams,
  myTeams,
  openTeamId,
  setOpenTeamId,
  resultsRef,
  onScrollToFilter,
  onOpenDmAndGo,
  onOpenOfferModal,
}: Props) {
  return (
    <div ref={resultsRef} style={dayListWrap}>
      <div style={dayListHeaderRow}>
        <h2 style={dayListTitle}>検索結果</h2>

        <button type="button" className="sh-btn" onClick={onScrollToFilter}>
          絞り込み
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#777" }}>読み込み中...</p>
      ) : filteredTeams.length === 0 ? (
        <div style={emptyBox}>条件に合うチームがありません。</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredTeams.map((team) => {
            const expanded = openTeamId === team.id;
            const isMyTeam = myTeams.some((t) => t.id === team.id);

            return (
              <div key={team.id} style={resultCard}>
                <div style={resultHeader}>
                  <div>
                    <div style={resultTitle}>{team.name ?? "（名称未設定）"}</div>
                    <div style={resultSub}>
                      📍 {buildAreaText(team)}
                      <br />
                      🏷 {formatTeamCategory(team)}
                      {" / "}💪 強さ {getStrength(team)}
                    </div>
                  </div>

                  <div style={resultHeaderRight}>
                    <span style={strengthBadge}>{getStrength(team)}</span>
                    <button
                      type="button"
                      className="sh-btn"
                      onClick={() => setOpenTeamId(expanded ? "" : team.id)}
                    >
                      {expanded ? "詳細を閉じる" : "詳細"}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div style={detailWrap}>
                    <div style={detailGrid}>
                      <div style={detailBox}>
                        <div style={detailLabel}>グラウンド・駐輪場</div>
                        <div style={detailValue}>
                          グラウンド {team.has_ground ? "あり" : "なし"} / 駐輪場{" "}
                          {formatBikeParking(team)}
                        </div>
                      </div>

                      <div style={detailBox}>
                        <div style={detailLabel}>所属人数</div>
                        <div style={detailValue}>{getMemberCount(team)}人</div>
                      </div>

                      <div style={detailBox}>
                        <div style={detailLabel}>ユニフォーム</div>
                        <div style={detailValue}>
                          {team.uniform_main ?? "不明"}（メイン） /{" "}
                          {team.uniform_sub ?? "不明"}（サブ）
                        </div>
                      </div>

                      {team.note ? (
                        <div style={detailBox}>
                          <div style={detailLabel}>メモ</div>
                          <div style={detailValue}>{team.note}</div>
                        </div>
                      ) : null}
                    </div>

                    <div style={buttonRow}>
                      <button
                        type="button"
                        className="sh-btn sh-btn--primary"
                        onClick={() => onOpenDmAndGo(team.id)}
                        disabled={loading || isMyTeam}
                      >
                        チャットを開く
                      </button>

                      <button
                        type="button"
                        className="sh-btn"
                        onClick={() => onOpenOfferModal(team)}
                        disabled={loading || isMyTeam}
                      >
                        オファーを送る
                      </button>

                      <Link href="/match" className="sh-btn">
                        試合を探すへ
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}