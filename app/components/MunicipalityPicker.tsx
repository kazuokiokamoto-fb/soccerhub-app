// app/components/MunicipalityPicker.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import type { Prefecture } from "@/app/lib/prefectures";

type Row = { city: string };

type Props = {
  prefecture: Prefecture | ""; // 都県が空のときもある
  value: string;              // 選択済みの市区町村
  onChange: (next: string) => void;

  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export default function MunicipalityPicker({
  prefecture,
  value,
  onChange,
  label = "市区町村（検索して選択）",
  placeholder = "例：世田谷区 / 横浜市 / さいたま市 / 水戸市",
  disabled,
}: Props) {
  const [q, setQ] = useState<string>(value || "");
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);

  // 親の value が変わったら入力欄も追従
  useEffect(() => {
    setQ(value || "");
  }, [value]);

  // 都県が変わったらクリア
  useEffect(() => {
    setItems([]);
    setOpen(false);
    setQ(""); // UI的に分かりやすくするなら空にする（必要なら外してOK）
    onChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture]);

  // 外クリックで閉じる
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // 検索（debounce）
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;

      if (!prefecture || disabled) {
        setItems([]);
        return;
      }

      const keyword = (q || "").trim();
      if (keyword.length === 0) {
        // 未入力なら「よくある上位」を軽く出す（任意）
        setLoading(true);
        const { data, error } = await supabase
          .from("jp_municipalities")
          .select("city")
          .eq("prefecture", prefecture)
          .order("city", { ascending: true })
          .limit(30);

        setLoading(false);
        if (!alive) return;

        if (error) {
          console.warn("jp_municipalities query error:", error.message);
          setItems([]);
          return;
        }

        setItems(uniq((data ?? []).map((r: Row) => r.city)));
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("jp_municipalities")
        .select("city")
        .eq("prefecture", prefecture)
        .ilike("city", `%${keyword}%`)
        .order("city", { ascending: true })
        .limit(50);

      setLoading(false);
      if (!alive) return;

      if (error) {
        console.warn("jp_municipalities query error:", error.message);
        setItems([]);
        return;
      }

      setItems(uniq((data ?? []).map((r: Row) => r.city)));
    }, 180);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [prefecture, q, disabled]);

  const hint = useMemo(() => {
    if (!prefecture) return "先に都県を選んでください";
    if (loading) return "検索中…";
    if (q.trim() && items.length === 0) return "該当なし（入力を変えてみてください）";
    return "";
  }, [prefecture, loading, q, items.length]);

  const pick = (city: string) => {
    onChange(city);
    setQ(city);
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>

      <div style={{ position: "relative" }}>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={!prefecture ? "先に都県を選択" : placeholder}
          disabled={disabled || !prefecture}
          style={input}
        />

        {open && prefecture ? (
          <div style={dropdown}>
            {hint ? <div style={hintStyle}>{hint}</div> : null}

            {items.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => pick(city)}
                style={{
                  ...rowBtn,
                  background: city === value ? "#eef6ff" : "white",
                }}
              >
                {city}
              </button>
            ))}

            {!loading && items.length > 0 ? (
              <div style={footer}>
                <span style={{ color: "#666", fontSize: 12 }}>
                  候補 {items.length} 件（入力で絞り込み）
                </span>
                {value ? (
                  <button type="button" className="sh-btn" onClick={() => pick("")}>
                    クリア
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 表示用 */}
      <div style={{ color: "#777", fontSize: 12 }}>
        選択中：{value ? <b>{value}</b> : "（未選択）"}
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const dropdown: React.CSSProperties = {
  position: "absolute",
  zIndex: 50,
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  background: "white",
  border: "1px solid #eee",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
  maxHeight: 320,
  overflow: "auto",
  padding: 8,
};

const rowBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
  fontSize: 14,
};

const hintStyle: React.CSSProperties = {
  padding: "8px 10px",
  color: "#666",
  fontSize: 12,
};

const footer: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 8,
  borderTop: "1px solid #f0f0f0",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};