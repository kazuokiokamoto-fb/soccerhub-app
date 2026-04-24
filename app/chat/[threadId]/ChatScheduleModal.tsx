"use client";

import React, { useEffect, useState } from "react";
import {
  modalBackdrop,
  modalWrap,
  modalPanel,
  modalTitle,
  modalField,
  modalLabel,
  modalInput,
  modalRow,
  modalActions,
  modalCancelButton,
  modalSubmitButton,
} from "./chat-thread.styles";

export type ChatScheduleModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    date: string;
    startTime: string;
    endTime: string;
    venueName: string;
    note: string;
  }) => void;
  loading?: boolean;
  defaultValues?: {
    date?: string;
    startTime?: string;
    endTime?: string;
    venueName?: string;
    note?: string;
  };
};

export default function ChatScheduleModal(props: ChatScheduleModalProps) {
  const { open, onClose, onSubmit, loading, defaultValues } = props;

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;

    setDate(defaultValues?.date ?? "");
    setStartTime(defaultValues?.startTime ?? "");
    setEndTime(defaultValues?.endTime ?? "");
    setVenueName(defaultValues?.venueName ?? "");
    setNote(defaultValues?.note ?? "");
  }, [open, defaultValues]);

  if (!open) return null;

  return (
    <>
      <div style={modalBackdrop} onClick={onClose} />

      <div style={modalWrap}>
        <div style={modalPanel}>
          <div style={modalTitle}>予定を作成</div>

          <div style={modalField}>
            <div style={modalLabel}>日付</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={modalInput}
            />
          </div>

          <div style={modalRow}>
            <div style={modalField}>
              <div style={modalLabel}>開始時間</div>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={modalInput}
              />
            </div>

            <div style={modalField}>
              <div style={modalLabel}>終了時間</div>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={modalInput}
              />
            </div>
          </div>

          <div style={modalField}>
            <div style={modalLabel}>会場</div>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="〇〇グラウンド"
              style={modalInput}
            />
          </div>

          <div style={modalField}>
            <div style={modalLabel}>メモ（任意）</div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="集合時間など"
              style={modalInput}
            />
          </div>

          <div style={modalActions}>
            <button
              type="button"
              style={modalCancelButton}
              onClick={onClose}
              disabled={loading}
            >
              キャンセル
            </button>

            <button
              type="button"
              style={modalSubmitButton}
              onClick={() =>
                onSubmit({
                  date,
                  startTime,
                  endTime,
                  venueName,
                  note,
                })
              }
              disabled={loading}
            >
              {loading ? "作成中…" : "作成"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}