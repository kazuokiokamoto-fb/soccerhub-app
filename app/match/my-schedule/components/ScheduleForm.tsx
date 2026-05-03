"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  opponentUniform: string;
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
  opponentUniform: "",
  venueName: "",
  address: "",
  category: "",
  strength: "",
  parking: "",
  belongings: "",
  note: "",
};

const BASE_CATEGORY_OPTIONS = [
  "キッズ",
  "KIDS",
  "U-8",
  "U-10",
  "U-12",
  "U-15",
  "一般",
];

const BASE_STRENGTH_OPTIONS = [
  "SS",
  "S",
  "A",
  "B",
  "C",
  "強め",
  "普通",
  "弱め",
  "未設定",
];

const PARKING_OPTIONS = ["あり", "なし", "不明"];

function normalizeTimeForInput(value?: string | null) {
  const s = String(value ?? "").trim();
  if (!s) return "";

  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const h = match[1].padStart(2, "0");
  const m = match[2];

  return `${h}:${m}`;
}

function mergeValues(initialValues?: Partial<ScheduleFormValues>) {
  return {
    ...defaultValues,
    ...initialValues,
    startTime: normalizeTimeForInput(initialValues?.startTime),
    endTime: normalizeTimeForInput(initialValues?.endTime),
    meetupTime: normalizeTimeForInput(initialValues?.meetupTime),
    dissolveTime: normalizeTimeForInput(initialValues?.dissolveTime),
  };
}

function buildOptions(base: string[], current?: string | null) {
  const value = String(current ?? "").trim();
  if (!value || base.includes(value)) return base;
  return [value, ...base];
}

export default function ScheduleForm(props: ScheduleFormProps) {
  const {
    teams = [],
    initialValues,
    submitLabel = "保存",
    submittingLabel = "保存中…",
    loading = false,
    onSubmit,
    onCancel,
  } = props;

  const [values, setValues] = useState<ScheduleFormValues>(() =>
    mergeValues(initialValues)
  );

  const [venues, setVenues] = useState<{ name: string; address: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(
    () => buildOptions(BASE_CATEGORY_OPTIONS, values.category),
    [values.category]
  );

  const strengthOptions = useMemo(
    () => buildOptions(BASE_STRENGTH_OPTIONS, values.strength),
    [values.strength]
  );

  useEffect(() => {
    setValues(mergeValues(initialValues));
  }, [initialValues]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("venues");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setVenues(parsed);
      }
    } catch (e) {
      console.error("venues localStorage parse error:", e);
    }
  }, []);

  function update<K extends keyof ScheduleFormValues>(
    key: K,
    value: ScheduleFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleTeamChange(teamId: string) {
    const selected = teams.find((t) => t.id === teamId);

    setValues((prev) => ({
      ...prev,
      teamId,
      category: selected?.category ?? prev.category,
    }));
  }

  function handleVenueSelect(name: string) {
    const v = venues.find((item) => item.name === name);
    if (!v) return;

    setValues((prev) => ({
      ...prev,
      venueName: v.name,
      address: v.address,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!values.teamId.trim()) {
      alert("自チームを選択してください");
      return;
    }

    if (!values.opponentName.trim()) {
      alert("対戦相手を入力してください");
      return;
    }

    if (!values.date.trim()) {
      alert("日付を入力してください");
      return;
    }

    setSubmitting(true);

    try {
      const trimmedValues: ScheduleFormValues = {
        teamId: values.teamId.trim(),
        date: values.date.trim(),
        startTime: values.startTime.trim(),
        endTime: values.endTime.trim(),
        meetupTime: values.meetupTime.trim(),
        dissolveTime: values.dissolveTime.trim(),
        opponentName: values.opponentName.trim(),
        opponentUniform: values.opponentUniform.trim(),
        venueName: values.venueName.trim(),
        address: values.address.trim(),
        category: values.category.trim(),
        strength: values.strength.trim(),
        parking: values.parking.trim(),
        belongings: values.belongings.trim(),
        note: values.note.trim(),
      };

      await onSubmit(trimmedValues);

      if (trimmedValues.venueName) {
        const updated = [
          {
            name: trimmedValues.venueName,
            address: trimmedValues.address,
          },
          ...venues.filter((v) => v.name !== trimmedValues.venueName),
        ].slice(0, 8);

        setVenues(updated);
        window.localStorage.setItem("venues", JSON.stringify(updated));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || submitting;

  return (
    <form style={wrap} onSubmit={handleSubmit}>
      <div style={section}>基本情報</div>

      {teams.length > 0 ? (
        <Field label="自チーム *">
          <select
            value={values.teamId}
            onChange={(e) => handleTeamChange(e.target.value)}
            style={input}
            disabled={disabled}
          >
            <option value="">選択してください</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="対戦相手 *">
        <input
          value={values.opponentName}
          onChange={(e) => update("opponentName", e.target.value)}
          placeholder="例：〇〇FC"
          style={input}
          disabled={disabled}
        />
      </Field>

      <Field label="相手ユニ色">
        <input
          value={values.opponentUniform}
          onChange={(e) => update("opponentUniform", e.target.value)}
          placeholder="例：赤 / 白 / 青"
          style={input}
          disabled={disabled}
        />
      </Field>

      <div style={responsiveRow}>
        <Field label="カテゴリ">
          <select
            value={values.category}
            onChange={(e) => update("category", e.target.value)}
            style={input}
            disabled={disabled}
          >
            <option value="">選択してください</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="強さ">
          <select
            value={values.strength}
            onChange={(e) => update("strength", e.target.value)}
            style={input}
            disabled={disabled}
          >
            <option value="">選択してください</option>
            {strengthOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="日付 *">
        <input
          type="date"
          value={values.date}
          onChange={(e) => update("date", e.target.value)}
          style={input}
          disabled={disabled}
        />
      </Field>

      <div style={responsiveRow}>
        <Field label="開始時間">
          <input
            type="time"
            value={values.startTime}
            onChange={(e) => update("startTime", e.target.value)}
            style={input}
            disabled={disabled}
          />
        </Field>

        <Field label="終了時間">
          <input
            type="time"
            value={values.endTime}
            onChange={(e) => update("endTime", e.target.value)}
            style={input}
            disabled={disabled}
          />
        </Field>
      </div>

      <div style={responsiveRow}>
        <Field label="集合時間">
          <input
            type="time"
            value={values.meetupTime}
            onChange={(e) => update("meetupTime", e.target.value)}
            style={input}
            disabled={disabled}
          />
        </Field>

        <Field label="解散時間">
          <input
            type="time"
            value={values.dissolveTime}
            onChange={(e) => update("dissolveTime", e.target.value)}
            style={input}
            disabled={disabled}
          />
        </Field>
      </div>

      <div style={section}>会場</div>

      {venues.length > 0 ? (
        <Field label="会場履歴">
          <select
            value=""
            onChange={(e) => handleVenueSelect(e.target.value)}
            style={input}
            disabled={disabled}
          >
            <option value="">履歴から選択</option>
            {venues.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="会場名">
        <input
          value={values.venueName}
          onChange={(e) => update("venueName", e.target.value)}
          placeholder="例：〇〇グラウンド"
          style={input}
          disabled={disabled}
        />
      </Field>

      <Field label="住所">
        <input
          value={values.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="例：東京都〇〇区〇〇"
          style={input}
          disabled={disabled}
        />
      </Field>

      <Field label="駐車場・駐輪場">
        <select
          value={values.parking}
          onChange={(e) => update("parking", e.target.value)}
          style={input}
          disabled={disabled}
        >
          <option value="">選択してください</option>
          {PARKING_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="持ち物">
        <input
          value={values.belongings}
          onChange={(e) => update("belongings", e.target.value)}
          placeholder="例：ユニフォーム白、ボール、ビブス"
          style={input}
          disabled={disabled}
        />
      </Field>

      <Field label="メモ">
        <textarea
          value={values.note}
          onChange={(e) => update("note", e.target.value)}
          placeholder="共有事項や注意点"
          style={textarea}
          disabled={disabled}
        />
      </Field>

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
          {disabled ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  const { label, children } = props;

  return (
    <label style={field}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gap: 14,
  width: "100%",
  maxWidth: "100%",
  overflowX: "hidden",
};

const section: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
  marginTop: 4,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const responsiveRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
  minWidth: 0,
  width: "100%",
};

const input: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  minHeight: 48,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 16,
  boxSizing: "border-box",
  WebkitAppearance: "none",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 104,
  resize: "vertical",
  lineHeight: 1.7,
};

const actions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 4,
};