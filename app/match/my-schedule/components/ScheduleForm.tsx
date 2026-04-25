"use client";

import React, { useEffect, useState } from "react";

export type ScheduleFormTeam = {
  id: string;
  name: string;
  category?: string | null;
};

export type ScheduleFormValues = {
  teamId: string;
  date: string;
  startTime: string;
  endTime: string;
  meetupTime: string;
  dissolveTime: string;
  opponentName: string;
  venueName: string;
  address: string;
  category: string;
  strength: string;
  parking: string;
  belongings: string;
  note: string;
};

export type ScheduleFormProps = {
  teams?: ScheduleFormTeam[];
  initialValues?: Partial<ScheduleFormValues>;
  submitLabel?: string;
  submittingLabel?: string;
  loading?: boolean;
  onSubmit: (values: ScheduleFormValues) => Promise<void> | void;
  onCancel?: () => void;
};

const defaultValues: ScheduleFormValues = {
  teamId: "",
  date: "",
  startTime: "",
  endTime: "",
  meetupTime: "",
  dissolveTime: "",
  opponentName: "",
  venueName: "",
  address: "",
  category: "",
  strength: "",
  parking: "",
  belongings: "",
  note: "",
};

export default function ScheduleForm(props: ScheduleFormProps) {
  const {
    teams = [],
    initialValues,
    submitLabel = "保存する",
    submittingLabel = "保存中…",
    loading = false,
    onSubmit,
    onCancel,
  } = props;

  const [values, setValues] = useState<ScheduleFormValues>({
    ...defaultValues,
    ...initialValues,
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues({
      ...defaultValues,
      ...initialValues,
    });
  }, [initialValues]);

  function update<K extends keyof ScheduleFormValues>(
    key: K,
    value: ScheduleFormValues[K]
  ) {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleTeamChange(teamId: string) {
    const selectedTeam = teams.find((t) => t.id === teamId);

    setValues((prev) => ({
      ...prev,
      teamId,
      category: selectedTeam?.category ?? prev.category,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting || loading) return;

    if (!values.teamId.trim()) {
      alert("自チームを選択してください");
      return;
    }

    if (!values.date.trim()) {
      alert("日付を入力してください");
      return;
    }

    if (!values.opponentName.trim()) {
      alert("対戦相手を入力してください");
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        ...values,
        teamId: values.teamId.trim(),
        date: values.date.trim(),
        startTime: values.startTime.trim(),
        endTime: values.endTime.trim(),
        meetupTime: values.meetupTime.trim(),
        dissolveTime: values.dissolveTime.trim(),
        opponentName: values.opponentName.trim(),
        venueName: values.venueName.trim(),
        address: values.address.trim(),
        category: values.category.trim(),
        strength: values.strength.trim(),
        parking: values.parking.trim(),
        belongings: values.belongings.trim(),
        note: values.note.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || submitting;

  return (
    <form style={formWrap} onSubmit={handleSubmit}>
      <div style={sectionTitle}>基本情報</div>

      <div style={fieldGrid}>
        {teams.length > 0 ? (
          <label style={field}>
            <span style={label}>自チーム *</span>
            <select
              value={values.teamId}
              onChange={(e) => handleTeamChange(e.target.value)}
              style={input}
              disabled={disabled}
            >
              <option value="">選択してください</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label style={field}>
          <span style={label}>日付 *</span>
          <input
            type="date"
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
            style={input}
            disabled={disabled}
          />
        </label>

        <div style={twoColumn}>
          <label style={field}>
            <span style={label}>開始時間</span>
            <input
              type="time"
              value={values.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              style={input}
              disabled={disabled}
            />
          </label>

          <label style={field}>
            <span style={label}>終了時間</span>
            <input
              type="time"
              value={values.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              style={input}
              disabled={disabled}
            />
          </label>
        </div>

        <div style={twoColumn}>
          <label style={field}>
            <span style={label}>集合時間</span>
            <input
              type="time"
              value={values.meetupTime}
              onChange={(e) => update("meetupTime", e.target.value)}
              style={input}
              disabled={disabled}
            />
          </label>

          <label style={field}>
            <span style={label}>解散時間</span>
            <input
              type="time"
              value={values.dissolveTime}
              onChange={(e) => update("dissolveTime", e.target.value)}
              style={input}
              disabled={disabled}
            />
          </label>
        </div>

        <label style={field}>
          <span style={label}>対戦相手 *</span>
          <input
            type="text"
            value={values.opponentName}
            onChange={(e) => update("opponentName", e.target.value)}
            placeholder="例：〇〇FC / 外部チーム名"
            style={input}
            disabled={disabled}
          />
        </label>
      </div>

      <div style={sectionTitle}>会場・条件</div>

      <div style={fieldGrid}>
        <label style={field}>
          <span style={label}>会場名</span>
          <input
            type="text"
            value={values.venueName}
            onChange={(e) => update("venueName", e.target.value)}
            placeholder="例：〇〇グラウンド"
            style={input}
            disabled={disabled}
          />
        </label>

        <label style={field}>
          <span style={label}>住所</span>
          <input
            type="text"
            value={values.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="例：東京都〇〇区〇〇"
            style={input}
            disabled={disabled}
          />
        </label>

        <div style={twoColumn}>
          <label style={field}>
            <span style={label}>カテゴリ</span>
            <input
              type="text"
              value={values.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="例：U-12"
              style={input}
              disabled={disabled}
            />
          </label>

          <label style={field}>
            <span style={label}>相手の強さ</span>
            <input
              type="text"
              value={values.strength}
              onChange={(e) => update("strength", e.target.value)}
              placeholder="例：A / B / 強め"
              style={input}
              disabled={disabled}
            />
          </label>
        </div>

        <label style={field}>
          <span style={label}>駐車場・駐輪場</span>
          <input
            type="text"
            value={values.parking}
            onChange={(e) => update("parking", e.target.value)}
            placeholder="例：駐車場あり / 駐輪場あり"
            style={input}
            disabled={disabled}
          />
        </label>

        <label style={field}>
          <span style={label}>持ち物</span>
          <input
            type="text"
            value={values.belongings}
            onChange={(e) => update("belongings", e.target.value)}
            placeholder="例：ユニフォーム白、ボール、ビブス"
            style={input}
            disabled={disabled}
          />
        </label>

        <label style={field}>
          <span style={label}>メモ</span>
          <textarea
            value={values.note}
            onChange={(e) => update("note", e.target.value)}
            placeholder="チャット内容から補足したいことなど"
            style={textarea}
            disabled={disabled}
          />
        </label>
      </div>

      <div style={actions}>
        {onCancel ? (
          <button
            type="button"
            className="sh-btn"
            onClick={onCancel}
            disabled={disabled}
          >
            キャンセル
          </button>
        ) : null}

        <button
          type="submit"
          className="sh-btn sh-btn--primary"
          disabled={disabled}
        >
          {submitting || loading ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

const formWrap: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.4,
};

const fieldGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const twoColumn: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#4b5563",
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 15,
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 96,
  resize: "vertical",
  lineHeight: 1.7,
};

const actions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};