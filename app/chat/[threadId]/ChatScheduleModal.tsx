"use client";

import React from "react";
import ScheduleForm, {
  type ScheduleFormValues,
} from "@/app/match/my-schedule/components/ScheduleForm";
import {
  modalBackdrop,
  modalWrap,
  modalPanel,
  modalTitle,
} from "./chat-thread.styles";

export type ChatScheduleModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ScheduleFormValues) => void | Promise<void>;
  loading?: boolean;
  defaultValues?: Partial<ScheduleFormValues>;
  teamId: string; // ← ★追加（重要）
};

export default function ChatScheduleModal(props: ChatScheduleModalProps) {
  const {
    open,
    onClose,
    onSubmit,
    loading = false,
    defaultValues,
    teamId,
  } = props;

  if (!open) return null;

  return (
    <>
      <div style={modalBackdrop} onClick={onClose} />

      <div style={modalWrap}>
        <div style={modalPanel}>
          <div style={modalTitle}>予定を作成</div>

          <ScheduleForm
            initialValues={{
              teamId, // ← ★ここが最重要
              ...defaultValues,
            }}
            loading={loading}
            submitLabel="作成"
            submittingLabel="作成中…"
            onCancel={onClose}
            onSubmit={async (values) => {
              await onSubmit(values);
              onClose(); // ← 保存後に閉じる
            }}
          />
        </div>
      </div>
    </>
  );
}