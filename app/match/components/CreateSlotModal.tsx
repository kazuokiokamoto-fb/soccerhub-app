// app/match/components/CreateSlotModal.tsx
"use client";

import React from "react";
import type { DbTeam, DbVenue } from "../types";
import { AreaSelect } from "./AreaSelect";

export function CreateSlotModal(props: {
  open: boolean;
  loading?: boolean;
  myTeams: DbTeam[];
  venues: DbVenue[];

  slotDate: string;
  hostTeamId: string;
  startTime: string;
  endTime: string;
  slotArea: string;
  slotCategory: string;
  venueId: string;

  setSlotDate: (v: string) => void;
  setHostTeamId: (v: string) => void;
  setStartTime: (v: string) => void;
  setEndTime: (v: string) => void;
  setSlotArea: (v: string) => void;
  setSlotCategory: (v: string) => void;
  setVenueId: (v: string) => void;

  onClose: () => void;
  onCreate: () => void;
}) {
  const {
    open,
    loading,
    myTeams,
    venues,
    slotDate,
    hostTeamId,
    startTime,
    endTime,
    slotArea,
    slotCategory,
    venueId,
    setSlotDate,
    setHostTeamId,
    setStartTime,
    setEndTime,
    setSlotArea,
    setSlotCategory,
    setVenueId,
    onClose,
    onCreate,
  } = props;

  if (!open) return null;

  return (
    <div style={modalOverlay} role="dialog" aria-modal="true">
      <div style={modalCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>募集枠を作る</div>
          <button className="sh-btn" type="button" onClick={onClose} disabled={!!loading}>
            ×
          </button>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <label style={label}>
            <span>日付</span>
            <input
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
              style={input}
              disabled={!!loading}
            />
          </label>

          <label style={label}>
            <span>ホストチーム</span>
            <select
              value={hostTeamId}
              onChange={(e) => setHostTeamId(e.target.value)}
              style={input}
              disabled={!!loading}
            >
              {myTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <label style={label}>
              <span>開始</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={input}
                disabled={!!loading}
              />
            </label>
            <label style={label}>
              <span>終了</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={input}
                disabled={!!loading}
              />
            </label>
          </div>

          {/* ✅ エリア：23区 → 町名（検索付き） */}
          <div style={{ ...cardLite }}>
            <AreaSelect
              label="エリア（23区→町名）"
              value={slotArea}
              onChange={setSlotArea}
              disabled={!!loading}
              // defaultCity を固定したければここで指定できる
              // defaultCity="世田谷区"
            />
            <p style={{ margin: "8px 0 0", color: "#777", fontSize: 12 }}>
              例：「世田谷区 三宿」のような形式で保存されます（既存 string と互換）
            </p>
          </div>

          <label style={label}>
            <span>カテゴリ</span>
            <select
              value={slotCategory}
              onChange={(e) => setSlotCategory(e.target.value)}
              style={input}
              disabled={!!loading}
            >
              <option value="U-12">U-12</option>
              <option value="U-15">U-15</option>
              <option value="社会人">社会人</option>
            </select>
          </label>

          <label style={label}>
            <span>グラウンド（任意）</span>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              style={input}
              disabled={!!loading}
            >
              <option value="">（未設定）</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.area ? ` / ${v.area}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <button className="sh-btn" type="button" onClick={onClose} disabled={!!loading}>
              キャンセル
            </button>
            <button className="sh-btn" type="button" onClick={onCreate} disabled={!!loading}>
              {loading ? "作成中…" : "作成"}
            </button>
          </div>

          <p style={{ margin: 0, color: "#777", fontSize: 12 }}>
            ※ まずは「日付×時間で募集を作る」→ 相手が合わせる、で運用が回ります
          </p>
        </div>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "grid", gap: 6 };

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const cardLite: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fafafa",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.25)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 14,
  zIndex: 50,
};

const modalCard: React.CSSProperties = {
  width: "min(520px, 100%)",
  borderRadius: 14,
  border: "1px solid #eee",
  background: "white",
  padding: 14,
};