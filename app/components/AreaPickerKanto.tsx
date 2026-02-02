"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type MunRow = { prefecture: string; city: string };
type TownRow = { prefecture: string; city: string; town: string };

const KANTO_PREFS = [
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  "茨城県",
  "栃木県",
  "群馬県",
];

export function AreaPickerKanto(props: {
  disabled?: boolean;

  prefecture: string;
  setPrefecture: (v: string) => void;

  city: string;
  setCity: (v: string) => void;

  town: string;
  setTown: (v: string) => void;

  // 表示名（チーム登録/検索で文言変えたい時用）
  title?: string;

  // 町名を必須にするか（チーム登録は任意、検索は任意が多い）
  townOptional?: boolean;
}) {
  const {
    disabled,
    prefecture,
    setPrefecture,
    city,
    setCity,
    town,
    setTown,
    title = "エリア（関東）",
    townOptional = true,
  } = props;

  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [townOptions, setTownOptions] = useState<string[]>([]);

  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  // 都県 → 市区町村
  useEffect(() => {
    (async () => {
      setCity("");
      setTown("");
      setCityQuery("");
      setTownQuery("");
      setTownOptions([]);

      const { data, error } = await supabase
        .from("jp_municipalities")
        .select("prefecture,city")
        .eq("prefecture", prefecture)
        .order("city");

      if (error) {
        console.error("[jp_municipalities] error:", error);
        setCityOptions([]);
        return;
      }

      const rows = (data ?? []) as MunRow[];
      setCityOptions(rows.map((r) => r.city).filter(Boolean));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture]);

  // 市区町村 → 町名
  useEffect(() => {
    (async () => {
      setTown("");
      setTownQuery("");
      setTownOptions([]);

      if (!prefecture || !city) return;

      const { data, error } = await supabase
        .from("jp_towns")
        .select("prefecture,city,town")
        .eq("prefecture", prefecture)
        .eq("city", city)
        .order("town");

      if (error) {
        console.error("[jp_towns] error:", error);
        setTownOptions([]);
        return;
      }

      const rows = (data ?? []) as TownRow[];
      setTownOptions(rows.map((r) => r.town).filter(Boolean));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture, city]);

  const filteredCityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return cityOptions.slice(0, 250);
    return cityOptions.filter((x) => x.includes(q)).slice(0, 250);
  }, [cityOptions, cityQuery]);

  const filteredTownOptions = useMemo(() => {
    const q = townQuery.trim();
    if (!q) return townOptions.slice(0, 250);
    return townOptions.filter((x) => x.includes(q)).slice(0, 250);
  }, [townOptions, townQuery]);

  return (
    <div style={{ ...card, background: "#fafafa" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>

      {/* 都県 */}
      <label style={label}>
        <span>都県（必須）</span>
        <select
          value={prefecture}
          onChange={(e) => setPrefecture(e.target.value)}
          style={input}
          disabled={disabled}
        >
          {KANTO_PREFS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      {/* 市区町村 */}
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>市区町村（必須）</div>
          <div style={{ fontSize: 12, color: "#777" }}>候補 {cityOptions.length} 件</div>
        </div>

        <input
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          style={input}
          placeholder="検索（例：世田谷、横浜、さいたま…）"
          disabled={disabled}
        />

        <div style={pickerBox}>
          {filteredCityOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>
              候補がありません（jp_municipalities のデータを確認）
            </div>
          ) : (
            filteredCityOptions.map((c) => (
              <button
                key={c}
                type="button"
                className="sh-btn"
                style={{ ...pill, ...(city === c ? pillActive : null) }}
                onClick={() => {
                  setCity(c);
                  setTown("");
                  setTownQuery("");
                }}
                disabled={disabled}
              >
                {c}
              </button>
            ))
          )}
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          選択中：<b>{city || "（未選択）"}</b>
        </div>
      </div>

      {/* 町名 */}
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>町名（{townOptional ? "任意" : "必須"}）</div>
          <div style={{ fontSize: 12, color: "#777" }}>候補 {townOptions.length} 件</div>
        </div>

        <input
          value={townQuery}
          onChange={(e) => setTownQuery(e.target.value)}
          style={input}
          placeholder={city ? "検索（例：三宿 / 南青山 / 青葉台…）" : "先に市区町村を選択してください"}
          disabled={disabled || !city}
        />

        <div style={pickerBox}>
          {!city ? (
            <div style={{ color: "#777", fontSize: 12 }}>先に市区町村を選択してください</div>
          ) : townOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>
              町名候補がありません（jp_towns のデータを確認）
            </div>
          ) : (
            filteredTownOptions.map((t) => (
              <button
                key={t}
                type="button"
                className="sh-btn"
                style={{ ...pill, ...(town === t ? pillActive : null) }}
                onClick={() => setTown(t)}
                disabled={disabled}
              >
                {t}
              </button>
            ))
          )}
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          表示例：<b>{`${prefecture} ${city || "（市区町村未選択）"}${town ? "・" + town : ""}`}</b>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
};

const label: React.CSSProperties = { display: "grid", gap: 6 };

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

// “候補を押すだけ”UI（iPad向け）
const pickerBox: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
  maxHeight: 240,
  overflow: "auto",
};

const pill: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  fontSize: 13,
  lineHeight: 1,
};

const pillActive: React.CSSProperties = {
  borderColor: "#111",
  background: "#fff",
  fontWeight: 900,
};