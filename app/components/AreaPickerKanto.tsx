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

  // ✅ かな/カナ/漢字の比較を安定させる（毎回 new しない）
  const collator = useMemo(() => new Intl.Collator("ja", { sensitivity: "base" }), []);

  // ====== handlers ======
  const applyCity = (c: string) => {
    setCity(c);
    setCityQuery(c);
    setTown("");
    setTownQuery("");
    setTownOptions([]);
  };

  const applyTown = (t: string) => {
    setTown(t);
    setTownQuery(t);
  };

  const clearCity = () => {
    setCity("");
    setTown("");
    setCityQuery("");
    setTownQuery("");
    setTownOptions([]);
  };

  const clearTown = () => {
    setTown("");
    setTownQuery("");
  };

  // =============================
  // 都県 → 市区町村（かな順）
  // =============================
  useEffect(() => {
    // 都県変更時：下流全部クリア
    clearCity();

    // allowAll で prefecture="" の時は候補を出さない
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture]);

  // =============================
  // 市区町村 → 町名（完全あいうえお順）
  //  - DBが .order("town_kana") できるならDBでソート
  //  - できない/欠損がある場合に備えて、最終的にJSでも安定ソート
  // =============================
  useEffect(() => {
    (async () => {
      setTown("");
      setTownQuery("");
      setTownOptions([]);

      if (!prefecture || !city) return;

      // ✅ まずはDBで town_kana で並べる（高速＆正確）
      const r1 = await supabase
        .from("jp_towns")
        .select("prefecture,city,town,town_kana")
        .eq("prefecture", prefecture)
        .eq("city", city)
        .order("town_kana", { ascending: true })
        .order("town", { ascending: true }); // 同一かなのときの安定化

      if (!r1.error) {
        const rows = (r1.data ?? []) as TownRow[];
        const mapped = rows.map((r) => ({
          town: r.town,
          townKana: r.town_kana ?? "",
        }));

        // ✅ 念のためJSでも安定ソート（DBのNULL/空文字/揺れ対策）
        mapped.sort((a, b) => {
          const ak = (a.townKana || a.town).trim();
          const bk = (b.townKana || b.town).trim();
          const c1 = collator.compare(ak, bk);
          if (c1 !== 0) return c1;
          return collator.compare(a.town, b.town);
        });

        setTownOptions(mapped);
        return;
      }

      // ✅ town_kana列が無い等 → townで取得してJSソート
      if (r1.error) console.warn("[jp_towns] town_kana order fallback:", r1.error);

      const r2 = await supabase
        .from("jp_towns")
        .select("prefecture,city,town,town_kana")
        .eq("prefecture", prefecture)
        .eq("city", city);

      if (r2.error) {
        console.error("[jp_towns] error:", r2.error);
        setTownOptions([]);
        return;
      }

      const rows2 = (r2.data ?? []) as TownRow[];
      const mapped2 = rows2.map((r) => ({
        town: r.town,
        townKana: r.town_kana ?? "",
      }));

      mapped2.sort((a, b) => {
        const ak = (a.townKana || a.town).trim();
        const bk = (b.townKana || b.town).trim();
        const c1 = collator.compare(ak, bk);
        if (c1 !== 0) return c1;
        return collator.compare(a.town, b.town);
      });

      setTownOptions(mapped2);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture, city]);

  // =============================
  // ✅ 外部（親）から city/town が入ってきたときも、検索欄を同期
  // =============================
  useEffect(() => {
    if (city && cityQuery !== city) setCityQuery(city);
    if (!city && cityQuery) setCityQuery("");

    if (town && townQuery !== town) setTownQuery(town);
    if (!town && townQuery) setTownQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, town]);

  // =============================
  // フィルタ
  // =============================
  const filteredCityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return cityOptions.slice(0, 300);

    return cityOptions.filter((x) => x.city.includes(q) || x.cityKana.includes(q)).slice(0, 300);
  }, [cityOptions, cityQuery]);

  const filteredTownOptions = useMemo(() => {
    const q = townQuery.trim();
    if (!q) return townOptions.slice(0, 300);

    return townOptions
      .filter((x) => x.town.includes(q) || (x.townKana && x.townKana.includes(q)))
      .slice(0, 300);
  }, [townOptions, townQuery]);

  const prefectureOptions = allowAll ? ["", ...KANTO_PREFS] : KANTO_PREFS;

  return (
    <div style={{ ...card, background: "#fafafa" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>

      {/* 都県 */}
      <label style={label}>
        <span>都県（{allowAll ? "任意" : "必須"}）</span>
        <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} style={input} disabled={disabled}>
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
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>市区町村（{allowAll ? "任意" : "必須"}）</div>
          <div style={{ fontSize: 12, color: "#777" }}>候補 {cityOptions.length} 件</div>
        </div>

        <input
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          style={input}
          placeholder={allowAll && !prefecture ? "先に都県を選ぶと市区町村が出ます" : "検索（例：世田谷 / せたがや / 横浜 / よこはま）"}
          disabled={disabled || (allowAll && !prefecture)}
        />

        <div style={listBox}>
          {allowAll && !prefecture ? (
            <div style={{ color: "#777", fontSize: 12 }}>都県を選ぶと市区町村候補が出ます</div>
          ) : filteredCityOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>候補がありません（kanto_municipalities_kana.json を確認）</div>
          ) : (
            filteredCityOptions.map((x) => {
              const active = city === x.city;
              return (
                <button
                  key={x.city}
                  type="button"
                  onClick={() => applyCity(x.city)}
                  disabled={disabled}
                  style={{ ...rowBtn, ...(active ? rowBtnActive : null) }}
                >
                  <div style={{ fontWeight: 800 }}>{x.city}</div>
                  <div style={{ fontSize: 12, color: active ? "#111" : "#777" }}>{x.cityKana}</div>
                </button>
              );
            })
          )}
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          選択中：<b>{city || "（未選択）"}</b>
        </div>

        {city ? (
          <button type="button" className="sh-btn" style={{ width: "fit-content" }} onClick={clearCity} disabled={disabled}>
            市区町村をクリア
          </button>
        ) : null}
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
          placeholder={city ? "検索（例：三宿 / 南青山 / みしゅく / みなみあおやま）" : "先に市区町村を選択してください"}
          disabled={disabled || !city}
        />

        <div style={listBox}>
          {!city ? (
            <div style={{ color: "#777", fontSize: 12 }}>先に市区町村を選択してください</div>
          ) : townOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>町名候補がありません（jp_towns を確認）</div>
          ) : (
            filteredTownOptions.map((x) => {
              const active = town === x.town;
              return (
                <button
                  key={`${x.town}__${x.townKana ?? ""}`}
                  type="button"
                  onClick={() => applyTown(x.town)}
                  disabled={disabled}
                  style={{ ...rowBtn, ...(active ? rowBtnActive : null) }}
                >
                  <div style={{ fontWeight: 800 }}>{x.town}</div>
                  {x.townKana ? <div style={{ fontSize: 12, color: active ? "#111" : "#777" }}>{x.townKana}</div> : null}
                </button>
              );
            })
          )}
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          表示例：<b>{`${prefecture || "（都県未選択）"} ${city || "（市区町村未選択）"}${town ? "・" + town : ""}`}</b>
        </div>

        {town ? (
          <button type="button" className="sh-btn" style={{ width: "fit-content" }} onClick={clearTown} disabled={disabled}>
            町名をクリア
          </button>
        ) : null}
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