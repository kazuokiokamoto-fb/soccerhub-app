"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import kantoKana from "@/app/lib/kanto_municipalities_kana.json";

type TownRow = {
  prefecture: string;
  city: string;
  town: string;
  town_kana?: string | null;
};

type KantoKanaRow = {
  pref: string;
  city: string;
  prefKana?: string;
  cityKana: string;
};

const KANTO_PREFS = ["東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"];

export function AreaPickerKanto(props: {
  disabled?: boolean;
  prefecture: string;
  setPrefecture: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  town: string;
  setTown: (v: string) => void;
  title?: string;
  townOptional?: boolean;
  allowAll?: boolean;
  allLabel?: string;
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
    allowAll = false,
    allLabel = "関東（すべて）",
  } = props;

  const [cityOptions, setCityOptions] = useState<Array<{ city: string; cityKana: string }>>([]);
  const [townOptions, setTownOptions] = useState<Array<{ town: string; townKana?: string }>>([]);

  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  const collator = new Intl.Collator("ja", { sensitivity: "base" });

  // =============================
  // 都県 → 市区町村（かな順）
  // =============================
  useEffect(() => {
    setCity("");
    setTown("");
    setCityQuery("");
    setTownQuery("");
    setTownOptions([]);

    if (allowAll && !prefecture) {
      setCityOptions([]);
      return;
    }

    const rows = (kantoKana as KantoKanaRow[])
      .filter((r) => r.pref === prefecture)
      .map((r) => ({ city: r.city, cityKana: r.cityKana }))
      .filter((r) => r.city && r.cityKana);

    rows.sort((a, b) => collator.compare(a.cityKana, b.cityKana));

    setCityOptions(rows);
  }, [prefecture]);

  // =============================
  // 市区町村 → 町名（完全あいうえお順）
  // =============================
  useEffect(() => {
    (async () => {
      setTown("");
      setTownQuery("");
      setTownOptions([]);

      if (!prefecture || !city) return;

      const { data, error } = await supabase
        .from("jp_towns")
        .select("prefecture,city,town,town_kana")
        .eq("prefecture", prefecture)
        .eq("city", city);

      if (error) {
        console.error("[jp_towns] error:", error);
        return;
      }

      const rows = (data ?? []) as TownRow[];

      const mapped = rows.map((r) => ({
        town: r.town,
        townKana: r.town_kana ?? r.town,
      }));

      // ✅ かな優先でJS側ソート（DB依存しない）
      mapped.sort((a, b) =>
        collator.compare(a.townKana ?? a.town, b.townKana ?? b.town)
      );

      setTownOptions(mapped);
    })();
  }, [prefecture, city]);

  // =============================
  // フィルタ
  // =============================
  const filteredCityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return cityOptions.slice(0, 300);

    return cityOptions
      .filter((x) => x.city.includes(q) || x.cityKana.includes(q))
      .slice(0, 300);
  }, [cityOptions, cityQuery]);

  const filteredTownOptions = useMemo(() => {
    const q = townQuery.trim();
    if (!q) return townOptions.slice(0, 300);

    return townOptions
      .filter(
        (x) =>
          x.town.includes(q) ||
          (x.townKana && x.townKana.includes(q))
      )
      .slice(0, 300);
  }, [townOptions, townQuery]);

  const prefectureOptions = allowAll ? ["", ...KANTO_PREFS] : KANTO_PREFS;

  return (
    <div style={{ ...card, background: "#fafafa" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>

      {/* 都県 */}
      <label style={label}>
        <span>都県</span>
        <select
          value={prefecture}
          onChange={(e) => setPrefecture(e.target.value)}
          style={input}
          disabled={disabled}
        >
          {prefectureOptions.map((p) =>
            p === "" ? (
              <option key="__all__" value="">
                {allLabel}
              </option>
            ) : (
              <option key={p} value={p}>
                {p}
              </option>
            )
          )}
        </select>
      </label>

      {/* 市区町村 */}
      <div style={{ marginTop: 12 }}>
        <input
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          style={input}
          placeholder="検索（漢字 / かな）"
          disabled={disabled}
        />

        <div style={listBox}>
          {filteredCityOptions.map((x) => {
            const active = city === x.city;
            return (
              <button
                key={x.city}
                type="button"
                onClick={() => {
                  setCity(x.city);
                  setCityQuery(x.city);
                }}
                disabled={disabled}
                style={{ ...rowBtn, ...(active ? rowBtnActive : null) }}
              >
                <div style={{ fontWeight: 800 }}>{x.city}</div>
                <div style={{ fontSize: 12, color: "#777" }}>
                  {x.cityKana}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 町名 */}
      <div style={{ marginTop: 14 }}>
        <input
          value={townQuery}
          onChange={(e) => setTownQuery(e.target.value)}
          style={input}
          placeholder="町名検索（漢字 / かな）"
          disabled={!city || disabled}
        />

        <div style={listBox}>
          {filteredTownOptions.map((x) => {
            const active = town === x.town;
            return (
              <button
                key={x.town}
                type="button"
                onClick={() => {
                  setTown(x.town);
                  setTownQuery(x.town);
                }}
                disabled={disabled}
                style={{ ...rowBtn, ...(active ? rowBtnActive : null) }}
              >
                <div style={{ fontWeight: 800 }}>{x.town}</div>
                {x.townKana && (
                  <div style={{ fontSize: 12, color: "#777" }}>
                    {x.townKana}
                  </div>
                )}
              </button>
            );
          })}
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

const listBox: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
  maxHeight: 260,
  overflow: "auto",
};

const rowBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #eee",
  background: "#fafafa",
  cursor: "pointer",
};

const rowBtnActive: React.CSSProperties = {
  borderColor: "#111",
  background: "#fff",
};