// app/match/components/AreaSelect.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type WardRow = {
  id: string;
  city: string; // 例: 世田谷区
  sort_order: number | null;
};

type AreaRow = {
  id: string;
  city: string; // 例: 世田谷区
  neighborhood: string; // 例: 三宿
  neighborhood_kana: string | null;
  sort_order: number | null;
};

export function AreaSelect(props: {
  label?: string;
  /** 互換のため文字列で受ける（例："世田谷区 三宿"） */
  value: string;
  /** 互換のため文字列で返す */
  onChange: (v: string) => void;
  disabled?: boolean;

  /** 任意：初期の区を固定したいとき */
  defaultCity?: string; // 例: "世田谷区"
}) {
  const { label = "エリア", value, onChange, disabled, defaultCity } = props;

  const [wards, setWards] = useState<WardRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [city, setCity] = useState<string>(defaultCity || "");
  const [q, setQ] = useState<string>(""); // 町名検索
  const [neighborhood, setNeighborhood] = useState<string>("");

  // 初回ロード（DB）
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 23区（tokyo_23wards）
        const { data: w, error: wErr } = await supabase
          .from("tokyo_23wards")
          .select("id,city,sort_order")
          .order("sort_order", { ascending: true })
          .order("city", { ascending: true });

        if (wErr) {
          console.error(wErr);
          setWards([]);
        } else {
          setWards((w ?? []) as WardRow[]);
        }

        // 町名（tokyo_areas）
        const { data: a, error: aErr } = await supabase
          .from("tokyo_areas")
          .select("id,city,neighborhood,neighborhood_kana,sort_order")
          .order("sort_order", { ascending: true })
          .order("neighborhood", { ascending: true });

        if (aErr) {
          console.error(aErr);
          setAreas([]);
        } else {
          setAreas((a ?? []) as AreaRow[]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 既存 value があるときに、UI状態へ寄せる（互換）
  useEffect(() => {
    // 例: "世田谷区 三宿" / "世田谷区" / "三宿" みたいにブレても最低限追従
    const v = (value || "").trim();
    if (!v) return;

    // ward名が入ってる場合はそれを優先
    const wardHit = wards.find((w) => v.includes(w.city));
    if (wardHit && wardHit.city !== city) setCity(wardHit.city);

    // "区 + 町名" の形を想定
    const parts = v.split(/\s+/);
    if (parts.length >= 2) {
      const n = parts.slice(1).join(" ");
      if (n && n !== neighborhood) setNeighborhood(n);
    } else {
      // 町名だけ入ってる可能性
      if (!wardHit && v && v !== neighborhood) setNeighborhood(v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, wards]);

  // cityに紐づく町名候補
  const areasInCity = useMemo(() => {
    const list = city ? areas.filter((a) => a.city === city) : areas;
    // 検索（かなも含める）
    const qq = q.trim();
    if (!qq) return list;

    const low = qq.toLowerCase();
    return list.filter((a) => {
      const s = `${a.neighborhood} ${a.neighborhood_kana || ""}`.toLowerCase();
      return s.includes(low);
    });
  }, [areas, city, q]);

  // valueへ反映（互換：文字列）
  const emit = (nextCity: string, nextNeighborhood: string) => {
    const c = (nextCity || "").trim();
    const n = (nextNeighborhood || "").trim();
    const out = c && n ? `${c} ${n}` : c || n || "";
    onChange(out);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>{label}</div>

      {/* 23区 */}
      <label style={labelStyle}>
        <span style={hint}>23区</span>
        <select
          value={city}
          onChange={(e) => {
            const next = e.target.value;
            setCity(next);
            // 区が変わったら町名は一旦クリア（誤選択を防ぐ）
            setNeighborhood("");
            setQ("");
            emit(next, "");
          }}
          disabled={disabled || loading}
          style={inputStyle}
        >
          <option value="">{loading ? "読み込み中…" : "（区を選択）"}</option>
          {wards.map((w) => (
            <option key={w.id} value={w.city}>
              {w.city}
            </option>
          ))}
        </select>
      </label>

      {/* 町名検索 */}
      <label style={labelStyle}>
        <span style={hint}>町名（検索）</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="例：三宿 / みしゅく"
          disabled={disabled || loading}
          style={inputStyle}
        />
      </label>

      {/* 町名セレクト */}
      <label style={labelStyle}>
        <span style={hint}>町名（選択）</span>
        <select
          value={neighborhood}
          onChange={(e) => {
            const n = e.target.value;
            setNeighborhood(n);
            emit(city, n);
          }}
          disabled={disabled || loading || (!city && wards.length > 0)}
          style={inputStyle}
        >
          <option value="">
            {city ? "（町名を選択）" : "先に区を選んでください"}
          </option>

          {areasInCity.map((a) => (
            <option key={a.id} value={a.neighborhood}>
              {a.neighborhood}
              {a.neighborhood_kana ? `（${a.neighborhood_kana}）` : ""}
            </option>
          ))}
        </select>

        <div style={{ fontSize: 12, color: "#777" }}>
          {city ? `${city} 内の候補：${areasInCity.length}件` : "区未選択"}
        </div>
      </label>

      {/* 現在値 */}
      <div style={{ fontSize: 12, color: "#555" }}>
        現在値：<b>{value || "（未設定）"}</b>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "grid", gap: 6 };
const hint: React.CSSProperties = { fontSize: 12, color: "#555" };

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};