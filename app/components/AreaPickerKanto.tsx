"use client";

import React, { useEffect, useMemo, useState } from "react";

type CityApiRow = {
  prefecture: string;
  city: string;
  cityKana: string;
};

type TownApiRow = {
  prefecture: string;
  city: string;
  town: string;
  townKana?: string;
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

  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTowns, setLoadingTowns] = useState(false);

  const collator = useMemo(() => new Intl.Collator("ja", { sensitivity: "base" }), []);

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
  // 都県 → 市区町村（API）
  // =============================
  useEffect(() => {
    let cancelled = false;

    (async () => {
      clearCity();

      if (allowAll && !prefecture) {
        setCityOptions([]);
        return;
      }

      if (!prefecture) {
        setCityOptions([]);
        return;
      }

      setLoadingCities(true);

      try {
        const url = `/api/address/cities?prefecture=${encodeURIComponent(prefecture)}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          console.error("[cities api] error:", json);
          if (!cancelled) setCityOptions([]);
          return;
        }

        const rows = ((json?.items ?? []) as CityApiRow[])
          .map((r) => ({
            city: r.city,
            cityKana: r.cityKana,
          }))
          .filter((r) => r.city && r.cityKana);

        rows.sort((a, b) => collator.compare(a.cityKana, b.cityKana));

        if (!cancelled) setCityOptions(rows);
      } catch (e) {
        console.error("[cities api] fetch error:", e);
        if (!cancelled) setCityOptions([]);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture]);

  // =============================
  // 市区町村 → 町名（API）
  // =============================
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setTown("");
      setTownQuery("");
      setTownOptions([]);

      if (!prefecture || !city) return;

      setLoadingTowns(true);

      try {
        // 空検索で先頭候補を取得
        const url =
          `/api/address/search-town?prefecture=${encodeURIComponent(prefecture)}` +
          `&city=${encodeURIComponent(city)}` +
          `&q=` +
          `&limit=300`;

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          console.error("[search-town api] error:", json);
          if (!cancelled) setTownOptions([]);
          return;
        }

        const rows = ((json?.items ?? []) as TownApiRow[])
          .map((r) => ({
            town: r.town,
            townKana: r.townKana ?? "",
          }))
          .filter((r) => r.town);

        rows.sort((a, b) => {
          const ak = (a.townKana || a.town).trim();
          const bk = (b.townKana || b.town).trim();
          const c1 = collator.compare(ak, bk);
          if (c1 !== 0) return c1;
          return collator.compare(a.town, b.town);
        });

        if (!cancelled) setTownOptions(rows);
      } catch (e) {
        console.error("[search-town api] fetch error:", e);
        if (!cancelled) setTownOptions([]);
      } finally {
        if (!cancelled) setLoadingTowns(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture, city]);

  // =============================
  // 外部（親）から city/town が入ってきたときも同期
  // =============================
  useEffect(() => {
    if (city && cityQuery !== city) setCityQuery(city);
    if (!city && cityQuery) setCityQuery("");

    if (town && townQuery !== town) setTownQuery(town);
    if (!town && townQuery) setTownQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, town]);

  // =============================
  // 町名の追加検索（入力時）
  // =============================
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!prefecture || !city) return;

      const q = townQuery.trim();

      // 町名未入力時は useEffect([prefecture, city]) 側の初期候補をそのまま使う
      if (!q) return;

      setLoadingTowns(true);

      try {
        const url =
          `/api/address/search-town?prefecture=${encodeURIComponent(prefecture)}` +
          `&city=${encodeURIComponent(city)}` +
          `&q=${encodeURIComponent(q)}` +
          `&limit=300`;

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          console.error("[search-town api query] error:", json);
          if (!cancelled) setTownOptions([]);
          return;
        }

        const rows = ((json?.items ?? []) as TownApiRow[])
          .map((r) => ({
            town: r.town,
            townKana: r.townKana ?? "",
          }))
          .filter((r) => r.town);

        rows.sort((a, b) => {
          const ak = (a.townKana || a.town).trim();
          const bk = (b.townKana || b.town).trim();
          const c1 = collator.compare(ak, bk);
          if (c1 !== 0) return c1;
          return collator.compare(a.town, b.town);
        });

        if (!cancelled) setTownOptions(rows);
      } catch (e) {
        console.error("[search-town api query] fetch error:", e);
        if (!cancelled) setTownOptions([]);
      } finally {
        if (!cancelled) setLoadingTowns(false);
      }
    };

    const timer = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [townQuery, prefecture, city, collator]);

  // =============================
  // フィルタ
  // cities は API 側でも絞れるが、UXのためローカルも残す
  // towns は APIで絞っているが、初期一覧用にローカルも残す
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
          <div style={{ fontSize: 12, color: "#777" }}>
            {loadingCities ? "読み込み中..." : `候補 ${cityOptions.length} 件`}
          </div>
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
          ) : loadingCities ? (
            <div style={{ color: "#777", fontSize: 12 }}>市区町村を読み込み中です...</div>
          ) : filteredCityOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>候補がありません</div>
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
          <div style={{ fontSize: 12, color: "#777" }}>
            {loadingTowns ? "読み込み中..." : `候補 ${townOptions.length} 件`}
          </div>
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
          ) : loadingTowns ? (
            <div style={{ color: "#777", fontSize: 12 }}>町名候補を読み込み中です...</div>
          ) : filteredTownOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>町名候補がありません</div>
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