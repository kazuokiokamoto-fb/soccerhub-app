"use client";

import React, { useMemo } from "react";
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
  teamId: string;
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

  const initialValues = useMemo<Partial<ScheduleFormValues>>(() => {
    return {
      ...defaultValues,
      teamId,
    };
  }, [defaultValues, teamId]);

  const formKey = useMemo(() => {
    return JSON.stringify({
      open,
      teamId,
      date: initialValues.date ?? "",
      startTime: initialValues.startTime ?? "",
      endTime: initialValues.endTime ?? "",
      opponentName: (initialValues as any).opponentName ?? "",
      opponentUniform: (initialValues as any).opponentUniform ?? "",
      category: (initialValues as any).category ?? "",
      strength: (initialValues as any).strength ?? "",
    });
  }, [open, teamId, initialValues]);

  if (!open) return null;

  return (
    <>
      <div style={modalBackdrop} onClick={onClose} />

      <div style={modalWrap}>
        <div style={modalPanel}>
          <div style={modalTitle}>予定を作成</div>

          <ScheduleForm
            key={formKey}
            initialValues={initialValues}
            loading={loading}
            submitLabel="作成"
            submittingLabel="作成中…"
            onCancel={onClose}
            onSubmit={async (values) => {
              await onSubmit(values);
              onClose();
            }}
          />
        </div>
      </div>
    </>
  );
}