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
  opponentUniform: string; // ★追加
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

const CATEGORY_OPTIONS = ["U-8", "U-10", "U-12", "U-15", "一般"];
const STRENGTH_OPTIONS = ["SS", "S", "A", "B", "C"];
const PARKING_OPTIONS = ["あり", "なし", "不明"];

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

  const [venues, setVenues] = useState<
    { name: string; address: string }[]
  >([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues({
      ...defaultValues,
      ...initialValues,
    });

    const saved = localStorage.getItem("venues");
    if (saved) setVenues(JSON.parse(saved));
  }, [initialValues]);

  function update<K extends keyof ScheduleFormValues>(
    key: K,
    value: ScheduleFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleTeamChange(teamId: string) {
    const selectedTeam = teams.find((t) => t.id === teamId);

    setValues((prev) => ({
      ...prev,
      teamId,
      category: selectedTeam?.category ?? prev.category,
    }));
  }

  function handleVenueSelect(name: string) {
    const v = venues.find((v) => v.name === name);
    if (!v) return;

    setValues((prev) => ({
      ...prev,
      venueName: v.name,
      address: v.address,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!values.teamId) return alert("チーム選択");
    if (!values.date) return alert("日付必須");
    if (!values.opponentName) return alert("対戦相手必須");

    setSubmitting(true);

    try {
      await onSubmit(values);

      // 会場保存
      if (values.venueName) {
        const updated = [
          { name: values.venueName, address: values.address },
          ...venues.filter((v) => v.name !== values.venueName),
        ].slice(0, 5);

        localStorage.setItem("venues", JSON.stringify(updated));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || submitting;

  return (
    <form style={formWrap} onSubmit={handleSubmit}>
      <div style={sectionTitle}>基本情報</div>

      {/* チーム */}
      {teams.length > 0 && (
        <select
          value={values.teamId}
          onChange={(e) => handleTeamChange(e.target.value)}
          style={input}
        >
          <option value="">チーム選択</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {/* 対戦相手 */}
      <input
        placeholder="対戦相手"
        value={values.opponentName}
        onChange={(e) => update("opponentName", e.target.value)}
        style={input}
      />

      {/* ユニ色 */}
      <input
        placeholder="相手ユニ色（例：赤）"
        value={values.opponentUniform}
        onChange={(e) => update("opponentUniform", e.target.value)}
        style={input}
      />

      {/* カテゴリ */}
      <select
        value={values.category}
        onChange={(e) => update("category", e.target.value)}
        style={input}
      >
        <option value="">カテゴリ</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>

      {/* 強さ */}
      <select
        value={values.strength}
        onChange={(e) => update("strength", e.target.value)}
        style={input}
      >
        <option value="">強さ</option>
        {STRENGTH_OPTIONS.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>

      {/* 日付 */}
      <input
        type="date"
        value={values.date}
        onChange={(e) => update("date", e.target.value)}
        style={input}
      />

      {/* 時間 */}
      <input type="time" value={values.startTime} onChange={(e)=>update("startTime",e.target.value)} style={input}/>
      <input type="time" value={values.endTime} onChange={(e)=>update("endTime",e.target.value)} style={input}/>
      <input type="time" value={values.meetupTime} onChange={(e)=>update("meetupTime",e.target.value)} style={input}/>
      <input type="time" value={values.dissolveTime} onChange={(e)=>update("dissolveTime",e.target.value)} style={input}/>

      <div style={sectionTitle}>会場</div>

      {/* 会場選択 */}
      {venues.length > 0 && (
        <select
          onChange={(e) => handleVenueSelect(e.target.value)}
          style={input}
        >
          <option>履歴から選択</option>
          {venues.map((v) => (
            <option key={v.name}>{v.name}</option>
          ))}
        </select>
      )}

      <input
        placeholder="会場名"
        value={values.venueName}
        onChange={(e) => update("venueName", e.target.value)}
        style={input}
      />

      <input
        placeholder="住所"
        value={values.address}
        onChange={(e) => update("address", e.target.value)}
        style={input}
      />

      <select
        value={values.parking}
        onChange={(e) => update("parking", e.target.value)}
        style={input}
      >
        <option value="">駐車場</option>
        {PARKING_OPTIONS.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>

      <textarea
        placeholder="メモ"
        value={values.note}
        onChange={(e) => update("note", e.target.value)}
        style={textarea}
      />

      <div style={actions}>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button type="submit">
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

const formWrap = { display: "grid", gap: 10 };
const sectionTitle = { fontWeight: "bold", marginTop: 10 };
const input = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
};
const textarea = { ...input, minHeight: 80 };
const actions = { display: "flex", gap: 10, justifyContent: "flex-end" };