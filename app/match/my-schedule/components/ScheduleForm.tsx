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

const CATEGORY_OPTIONS = ["U-8", "U-10", "U-12", "U-15", "一般"];
const STRENGTH_OPTIONS = ["SS", "S", "A", "B", "C"];
const PARKING_OPTIONS = ["あり", "なし", "不明"];

export default function ScheduleForm(props: ScheduleFormProps) {
  const { teams = [], initialValues, loading = false, onSubmit, onCancel } = props;

  const [values, setValues] = useState<ScheduleFormValues>({
    ...defaultValues,
    ...initialValues,
  });

  const [venues, setVenues] = useState<{ name: string; address: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues({ ...defaultValues, ...initialValues });

    const saved = localStorage.getItem("venues");
    if (saved) setVenues(JSON.parse(saved));
  }, [initialValues]);

  function update<K extends keyof ScheduleFormValues>(key: K, value: ScheduleFormValues[K]) {
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
    const v = venues.find((v) => v.name === name);
    if (!v) return;

    setValues((prev) => ({
      ...prev,
      venueName: v.name,
      address: v.address,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!values.teamId) return alert("チーム選択");
    if (!values.date) return alert("日付必須");
    if (!values.opponentName) return alert("対戦相手必須");

    setSubmitting(true);

    try {
      await onSubmit(values);

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
    <form style={wrap} onSubmit={handleSubmit}>
      <div style={section}>基本情報</div>

      {/* チーム */}
      {teams.length > 0 && (
        <Field label="自チーム">
          <select value={values.teamId} onChange={(e) => handleTeamChange(e.target.value)} style={input}>
            <option value="">選択</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="対戦相手">
        <input value={values.opponentName} onChange={(e) => update("opponentName", e.target.value)} style={input}/>
      </Field>

      <Field label="相手ユニ色">
        <input value={values.opponentUniform} onChange={(e) => update("opponentUniform", e.target.value)} style={input}/>
      </Field>

      <Row>
        <Field label="カテゴリ">
          <select value={values.category} onChange={(e) => update("category", e.target.value)} style={input}>
            <option value="">選択</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="強さ">
          <select value={values.strength} onChange={(e) => update("strength", e.target.value)} style={input}>
            <option value="">選択</option>
            {STRENGTH_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </Row>

      <Field label="日付">
        <input type="date" value={values.date} onChange={(e) => update("date", e.target.value)} style={input}/>
      </Field>

      <Row>
        <Field label="開始">
          <input type="time" value={values.startTime} onChange={(e)=>update("startTime",e.target.value)} style={input}/>
        </Field>
        <Field label="終了">
          <input type="time" value={values.endTime} onChange={(e)=>update("endTime",e.target.value)} style={input}/>
        </Field>
      </Row>

      <Row>
        <Field label="集合">
          <input type="time" value={values.meetupTime} onChange={(e)=>update("meetupTime",e.target.value)} style={input}/>
        </Field>
        <Field label="解散">
          <input type="time" value={values.dissolveTime} onChange={(e)=>update("dissolveTime",e.target.value)} style={input}/>
        </Field>
      </Row>

      <div style={section}>会場</div>

      {venues.length > 0 && (
        <Field label="履歴">
          <select onChange={(e)=>handleVenueSelect(e.target.value)} style={input}>
            <option>選択</option>
            {venues.map((v)=><option key={v.name}>{v.name}</option>)}
          </select>
        </Field>
      )}

      <Field label="会場名">
        <input value={values.venueName} onChange={(e)=>update("venueName",e.target.value)} style={input}/>
      </Field>

      <Field label="住所">
        <input value={values.address} onChange={(e)=>update("address",e.target.value)} style={input}/>
      </Field>

      <Field label="駐車場">
        <select value={values.parking} onChange={(e)=>update("parking",e.target.value)} style={input}>
          <option value="">選択</option>
          {PARKING_OPTIONS.map((p)=><option key={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="メモ">
        <textarea value={values.note} onChange={(e)=>update("note",e.target.value)} style={textarea}/>
      </Field>

      <div style={actions}>
        {onCancel && <button type="button" onClick={onCancel}>キャンセル</button>}
        <button type="submit">{submitting ? "保存中…" : "保存"}</button>
      </div>
    </form>
  );
}

/* UI */
const wrap = { display:"grid", gap:16 };
const section = { fontWeight:900, fontSize:16 };
const input = {
  width:"100%",
  padding:12,
  borderRadius:12,
  border:"1px solid #ccc",
  boxSizing:"border-box",
  minWidth:0,
};
const textarea = { ...input, minHeight:100 };

const actions = {
  display:"flex",
  justifyContent:"flex-end",
  gap:10,
};

/* components */
function Field({label, children}:{label:string, children:React.ReactNode}) {
  return (
    <div style={{display:"grid", gap:4}}>
      <div style={{fontSize:12, fontWeight:700}}>{label}</div>
      {children}
    </div>
  );
}

function Row({children}:{children:React.ReactNode}) {
  return (
    <div style={{
      display:"grid",
      gridTemplateColumns:"1fr 1fr",
      gap:10,
      minWidth:0,
    }}>
      {children}
    </div>
  );
}