"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

// 標準的な関東順(セレクション一覧ページと合わせています)
const PREFECTURE_OPTIONS: string[] = [
  "東京都",
  "神奈川県",
  "埼玉県",
  "千葉県",
  "茨城県",
  "栃木県",
  "群馬県",
  "山梨県",
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "U12", label: "U-12" },
  { value: "U13", label: "U-13" },
  { value: "U15", label: "U-15" },
  { value: "U18", label: "U-18" },
  { value: "U23", label: "U-23" },
  { value: "OPEN", label: "一般" },
  { value: "GK", label: "GK" },
  { value: "女子", label: "女子" },
];

const RANK_OPTIONS: { value: string; label: string }[] = [
  { value: "j_academy", label: "J下部" },
  { value: "pref_top", label: "T1 / 1部" },
  { value: "pref_2", label: "T2 / 2部" },
  { value: "pref_3", label: "T3 / 3部" },
  { value: "pref_4", label: "T4 / 4部" },
  { value: "district", label: "地区リーグ" },
  { value: "school", label: "スクール" },
  { value: "girls", label: "女子" },
];

type Toast = { type: "success" | "error" | "info"; text: string } | null;

export default function SelectionNotifySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meId, setMeId] = useState("");

  const [enabled, setEnabled] = useState(true);
  const [prefectures, setPrefectures] = useState<string[]>([]); // 空 = すべて
  const [categories, setCategories] = useState<string[]>([]); // 空 = すべて
  const [ranks, setRanks] = useState<string[]>([]); // 空 = すべて

  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      setMeId(user.id);

      const { data, error } = await supabase
        .from("selection_alert_subscriptions")
        .select("prefectures, categories, ranks, enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("selection notify load error:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setPrefectures(Array.isArray(data.prefectures) ? data.prefectures : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setRanks(Array.isArray((data as any).ranks) ? (data as any).ranks : []);
        setEnabled(data.enabled ?? true);
      }
    } catch (e) {
      console.error("selection notify load error:", e);
    } finally {
      setLoading(false);
    }
  }

  const summaryText = useMemo(() => {
    const prefText =
      prefectures.length === 0 ? "全都道府県" : prefectures.join("・");
    const catText =
      categories.length === 0
        ? "全カテゴリ"
        : categories
            .map((c) => CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c)
            .join("・");
    const rankText =
      ranks.length === 0
        ? "全ランク"
        : ranks
            .map((r) => RANK_OPTIONS.find((o) => o.value === r)?.label ?? r)
            .join("・");
    return `${prefText} / ${catText} / ${rankText}`;
  }, [prefectures, categories, ranks]);

  function togglePrefecture(pref: string) {
    setPrefectures((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleRank(r: string) {
    setRanks((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  async function save() {
    if (!meId) {
      setToast({ type: "error", text: "ログインが必要です" });
      return;
    }

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    try {
      const { error } = await supabase
        .from("selection_alert_subscriptions")
        .upsert(
          {
            user_id: meId,
            prefectures: prefectures.length > 0 ? prefectures : null,
            categories: categories.length > 0 ? categories : null,
            ranks: ranks.length > 0 ? ranks : null,
            enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `保存に失敗しました: ${error.message}` });
        return;
      }

      setToast({ type: "success", text: "✅ 通知条件を保存しました" });
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ color: "#666", fontSize: 14 }}>読み込み中…</div>;
  }

  if (!meId) {
    return null;
  }

  return (
    <div style={wrap}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
              ? toastError
              : toastInfo),
          }}
        >
          {toast.text}
        </div>
      ) : null}

      <div style={title}>セレクション新着通知の条件</div>
      <div style={helper}>
        条件に合う新着セレクション情報が登録されたときに通知します。
        何も選ばなければ「すべて」が対象になります。
      </div>

      <label style={enableRow}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={saving}
        />
        セレクション新着通知を受け取る
      </label>

      <div style={groupTitle}>都道府県(未選択=すべて)</div>
      <div style={chipRow}>
        {PREFECTURE_OPTIONS.map((pref) => {
          const active = prefectures.includes(pref);
          return (
            <button
              key={pref}
              type="button"
              onClick={() => togglePrefecture(pref)}
              disabled={saving || !enabled}
              style={{ ...chip, ...(active ? chipActive : null) }}
            >
              {pref}
            </button>
          );
        })}
      </div>

      <div style={groupTitle}>カテゴリ(未選択=すべて)</div>
      <div style={chipRow}>
        {CATEGORY_OPTIONS.map((opt) => {
          const active = categories.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleCategory(opt.value)}
              disabled={saving || !enabled}
              style={{ ...chip, ...(active ? chipActive : null) }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={groupTitle}>ランク(未選択=すべて)</div>
      <div style={chipRow}>
        {RANK_OPTIONS.map((opt) => {
          const active = ranks.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleRank(opt.value)}
              disabled={saving || !enabled}
              style={{ ...chip, ...(active ? chipActive : null) }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={summaryBox}>現在の条件: {enabled ? summaryText : "通知オフ"}</div>

      <button
        type="button"
        className="sh-btn sh-btn--primary"
        onClick={save}
        disabled={saving}
        style={{ width: "fit-content" }}
      >
        {saving ? "保存中…" : "条件を保存"}
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #edf1ee",
  background: "#fafcfb",
};

const title: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
  fontSize: 14,
};

const helper: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.7,
};

const enableRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 700,
  color: "#21342a",
};

const groupTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#2d3b31",
  marginTop: 4,
};

const chipRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const chip: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
  cursor: "pointer",
};

const chipActive: React.CSSProperties = {
  background: "#dcfce7",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const summaryBox: React.CSSProperties = {
  fontSize: 12,
  color: "#4b5563",
};

const toastBox: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
};

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  color: "#166534",
};

const toastError: React.CSSProperties = {
  background: "#fef2f2",
  color: "#991b1b",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1e3a8a",
};
