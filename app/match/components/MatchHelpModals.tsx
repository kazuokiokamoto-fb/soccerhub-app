"use client";

import React from "react";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";

type StrengthGuide = {
  rank: StrengthRank;
  short: string;
  title: string;
  bullets: string[];
  note: string;
};

type Props = {
  showStrengthHelp: boolean;
  showCalendarHelp: boolean;
  onCloseStrengthHelp: () => void;
  onCloseCalendarHelp: () => void;
  strengthGuides: StrengthGuide[];
};

export function MatchHelpModals({
  showStrengthHelp,
  showCalendarHelp,
  onCloseStrengthHelp,
  onCloseCalendarHelp,
  strengthGuides,
}: Props) {
  return (
    <>
      {showStrengthHelp ? (
        <div
          style={modalOverlay}
          onClick={onCloseStrengthHelp}
          role="dialog"
          aria-modal="true"
          aria-label="強さの説明"
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>強さの説明</h3>
              <button
                type="button"
                style={modalCloseButton}
                onClick={onCloseStrengthHelp}
              >
                閉じる
              </button>
            </div>

            <div style={guideList}>
              {strengthGuides.map((item) => (
                <div key={item.rank} style={guideCard}>
                  <div style={guideTop}>
                    <div style={guideRank}>{item.rank}</div>
                    <div style={guideShort}>{item.short}</div>
                  </div>

                  <div style={guideTitleText}>{item.title}</div>

                  <div style={guideBulletList}>
                    {item.bullets.map((bullet) => (
                      <div key={bullet} style={guideBulletRow}>
                        <span style={guideBulletMark}>•</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  <div style={guideNote}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showCalendarHelp ? (
        <div
          style={modalOverlay}
          onClick={onCloseCalendarHelp}
          role="dialog"
          aria-modal="true"
          aria-label="カレンダー表示の説明"
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>決・募・他 の見方</h3>
              <button
                type="button"
                style={modalCloseButton}
                onClick={onCloseCalendarHelp}
              >
                閉じる
              </button>
            </div>

            <div style={guideList}>
              <div style={guideCard}>
                <div style={guideTop}>
                  <div style={calendarLegendBadgeDecided}>決</div>
                  <div style={guideShort}>決定済</div>
                </div>
                <div style={guideTitleText}>
                  あなたのチームで試合が決まった募集です。
                </div>
              </div>

              <div style={guideCard}>
                <div style={guideTop}>
                  <div style={calendarLegendBadgeOpen}>募</div>
                  <div style={guideShort}>募集中</div>
                </div>
                <div style={guideTitleText}>
                  まだ申し込みできる募集です。
                </div>
              </div>

              <div style={guideCard}>
                <div style={guideTop}>
                  <div style={calendarLegendBadgeOther}>他</div>
                  <div style={guideShort}>他決定</div>
                </div>
                <div style={guideTitleText}>
                  他チームで決まった募集です。
                </div>
              </div>

              <div style={guideCard}>
                <div style={guideTop}>
                  <div style={calendarLegendBadgeInfo}>👥</div>
                  <div style={guideShort}>チームメンバー管理</div>
                </div>
                <div style={guideTitleText}>
                  マイページのチーム欄から「詳細」を開くと、チーム詳細ページに進めます。
                  管理者・コーチは「メンバー管理」から招待コードを発行し、
                  保護者やコーチをチームメンバーとして追加できます。
                  メンバーはマイスケジュールの確認、出欠回答、チーム連絡の確認ができます。
                </div>
              </div>

              <div style={guideCard}>
                <div style={guideTop}>
                  <div style={calendarLegendBadgeInfo}>✅</div>
                  <div style={guideShort}>出欠確認</div>
                </div>
                <div style={guideTitleText}>
                  試合が決まった後だけでなく、交渉中の予定でも出欠確認ができます。
                  チームメンバーは「参加・未定・不参加」を回答でき、
                  出欠集計は試合詳細ページで確認できます。
                </div>
              </div>

              <div style={guideCard}>
                <div style={guideTop}>
                  <div style={calendarLegendBadgeInfo}>💬</div>
                  <div style={guideShort}>チーム連絡</div>
                </div>
                <div style={guideTitleText}>
                  チーム詳細ページの「チーム連絡」から、集合時間・持ち物・連絡事項などを
                  チーム内で共有できます。
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 2000,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "80vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5ece7",
  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  padding: 18,
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  position: "sticky",
  top: 0,
  background: "#fff",
  paddingBottom: 8,
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const modalCloseButton: React.CSSProperties = {
  border: "1px solid #d6ded9",
  background: "#fff",
  borderRadius: 12,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const guideList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const guideCard: React.CSSProperties = {
  border: "1px solid #e7ece9",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 14,
};

const guideTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const guideRank: React.CSSProperties = {
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#145c2a",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const guideShort: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
  fontSize: 15,
};

const guideTitleText: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 800,
  color: "#314137",
  lineHeight: 1.7,
};

const guideBulletList: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
};

const guideBulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 8,
  alignItems: "start",
  color: "#314137",
  fontSize: 14,
  lineHeight: 1.7,
};

const guideBulletMark: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const guideNote: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e7d08a",
  background: "#fff8dd",
  color: "#4d3a00",
  fontWeight: 800,
  lineHeight: 1.7,
  fontSize: 13,
};

const calendarLegendBadgeBase: React.CSSProperties = {
  minWidth: 34,
  height: 28,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 14,
};

const calendarLegendBadgeDecided: React.CSSProperties = {
  ...calendarLegendBadgeBase,
  background: "#dcfce7",
  color: "#166534",
};

const calendarLegendBadgeOpen: React.CSSProperties = {
  ...calendarLegendBadgeBase,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const calendarLegendBadgeOther: React.CSSProperties = {
  ...calendarLegendBadgeBase,
  background: "#f3f4f6",
  color: "#4b5563",
};

const calendarLegendBadgeInfo: React.CSSProperties = {
  ...calendarLegendBadgeBase,
  background: "#eef6f0",
  color: "#14532d",
};