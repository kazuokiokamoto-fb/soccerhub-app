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

const INITIAL_CITY_PREVIEW_COUNT = 12;
const INITIAL_TOWN_PREVIEW_COUNT = 12;

const CITY_SEARCH_MIN_LENGTH = 1;
const TOWN_SEARCH_MIN_LENGTH = 1;

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

  useEffect(() => {
    if (city && cityQuery !== city) setCityQuery(city);
    if (!city && cityQuery) setCityQuery("");

    if (town && townQuery !== town) setTownQuery(town);
    if (!town && townQuery) setTownQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, town]);

  // 都県変更時：市区町村の先頭候補だけ取得
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
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
          console.error("[cities api init] error:", json);
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

        if (!cancelled) setCityOptions(rows.slice(0, INITIAL_CITY_PREVIEW_COUNT));
      } catch (e) {
        console.error("[cities api init] fetch error:", e);
        if (!cancelled) setCityOptions([]);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture]);

  // 市区町村入力時：検索API
  useEffect(() => {
    let cancelled = false;

    if (!prefecture) return;
    if (allowAll && !prefecture) return;

    const q = cityQuery.trim();

    // 空欄なら初期候補のまま
    if (!q) return;

    const timer = setTimeout(async () => {
      setLoadingCities(true);

      try {
        const url =
          `/api/address/cities?prefecture=${encodeURIComponent(prefecture)}` +
          `&q=${encodeURIComponent(q)}`;

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          console.error("[cities api query] error:", json);
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

        if (!cancelled) setCityOptions(rows.slice(0, 50));
      } catch (e) {
        console.error("[cities api query] fetch error:", e);
        if (!cancelled) setCityOptions([]);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityQuery, prefecture, allowAll, collator]);

  const filteredCityOptions = useMemo(() => {
    const q = cityQuery.trim();

    if (!q) return cityOptions.slice(0, INITIAL_CITY_PREVIEW_COUNT);

    return cityOptions.filter((x) => x.city.includes(q) || x.cityKana.includes(q)).slice(0, 50);
  }, [cityOptions, cityQuery]);

  // 市区町村変更時：町名の先頭候補だけ取得
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setTown("");
      setTownQuery("");
      setTownOptions([]);

      if (!prefecture || !city) return;

      setLoadingTowns(true);

      try {
        const url =
          `/api/address/search-town?prefecture=${encodeURIComponent(prefecture)}` +
          `&city=${encodeURIComponent(city)}` +
          `&limit=${INITIAL_TOWN_PREVIEW_COUNT}`;

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          console.error("[search-town api init] error:", json);
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
        console.error("[search-town api init] fetch error:", e);
        if (!cancelled) setTownOptions([]);
      } finally {
        if (!cancelled) setLoadingTowns(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [prefecture, city, collator, setTown]);

  // 町名入力時：検索API
  useEffect(() => {
    let cancelled = false;

    const q = townQuery.trim();
    if (!prefecture || !city) return;

    // 空欄なら初期候補のまま
    if (!q) return;

    const timer = setTimeout(async () => {
      setLoadingTowns(true);

      try {
        const url =
          `/api/address/search-town?prefecture=${encodeURIComponent(prefecture)}` +
          `&city=${encodeURIComponent(city)}` +
          `&q=${encodeURIComponent(q)}` +
          `&limit=50`;

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
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [townQuery, prefecture, city, collator]);

  const filteredTownOptions = useMemo(() => {
    const q = townQuery.trim();

    if (!q) return townOptions.slice(0, INITIAL_TOWN_PREVIEW_COUNT);

    return townOptions.filter((x) => x.town.includes(q) || (x.townKana && x.townKana.includes(q))).slice(0, 50);
  }, [townOptions, townQuery]);

  const prefectureOptions = allowAll ? ["", ...KANTO_PREFS] : KANTO_PREFS;

  const shouldShowCitySearchHint = !!prefecture && cityQuery.trim().length < CITY_SEARCH_MIN_LENGTH;
  const hasCityQuery = cityQuery.trim().length >= CITY_SEARCH_MIN_LENGTH;

  const shouldShowTownSearchHint = !!city && townQuery.trim().length < TOWN_SEARCH_MIN_LENGTH;
  const hasTownQuery = townQuery.trim().length >= TOWN_SEARCH_MIN_LENGTH;

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

      {/* 市区町村：検索主役の縦リスト型 */}
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>市区町村（{allowAll ? "任意" : "必須"}）</div>
          <div style={{ fontSize: 12, color: "#777" }}>
            {loadingCities ? "読み込み中..." : hasCityQuery ? `候補 ${filteredCityOptions.length} 件` : `先頭候補 ${filteredCityOptions.length} 件`}
          </div>
        </div>

        <input
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          style={input}
          placeholder={allowAll && !prefecture ? "先に都県を選ぶと市区町村が出ます" : "漢字・ひらがなで検索（例：世田谷 / せたがや / 横浜 / よこはま）"}
          disabled={disabled || (allowAll && !prefecture)}
        />

        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          {allowAll && !prefecture
            ? "先に都県を選択してください。"
            : shouldShowCitySearchHint
            ? "市区町村は検索して選ぶ方式です。下には先頭の候補だけ表示しています。"
            : "検索結果から市区町村を選択してください。"}
        </div>

        <div style={listBox}>
          {allowAll && !prefecture ? (
            <div style={{ color: "#777", fontSize: 12 }}>都県を選ぶと市区町村候補が出ます</div>
          ) : loadingCities ? (
            <div style={{ color: "#777", fontSize: 12 }}>市区町村を読み込み中です...</div>
          ) : filteredCityOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>
              {hasCityQuery ? "一致する市区町村候補がありません" : "市区町村候補がありません"}
            </div>
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800 }}>{x.city}</div>
                    <div style={{ fontSize: 12, color: active ? "#111" : "#777", whiteSpace: "nowrap" }}>{x.cityKana}</div>
                  </div>
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

      {/* 町名：検索主役の縦リスト型 */}
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>町名（{townOptional ? "任意" : "必須"}）</div>
          <div style={{ fontSize: 12, color: "#777" }}>
            {loadingTowns ? "読み込み中..." : hasTownQuery ? `候補 ${filteredTownOptions.length} 件` : `先頭候補 ${filteredTownOptions.length} 件`}
          </div>
        </div>

        <input
          value={townQuery}
          onChange={(e) => setTownQuery(e.target.value)}
          style={input}
          placeholder={city ? "漢字・ひらがなで検索（例：三宿 / みしゅく）" : "先に市区町村を選択してください"}
          disabled={disabled || !city}
        />

        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          {!city
            ? "先に市区町村を選択してください。"
            : shouldShowTownSearchHint
            ? "町名は検索して選ぶ方式です。下には先頭の候補だけ表示しています。"
            : "検索結果から町名を選択してください。"}
        </div>

        <div style={listBox}>
          {!city ? (
            <div style={{ color: "#777", fontSize: 12 }}>先に市区町村を選択してください</div>
          ) : loadingTowns ? (
            <div style={{ color: "#777", fontSize: 12 }}>町名候補を読み込み中です...</div>
          ) : filteredTownOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>
              {hasTownQuery ? "一致する町名候補がありません" : "町名候補がありません"}
            </div>
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800 }}>{x.town}</div>
                    {x.townKana ? (
                      <div style={{ fontSize: 12, color: active ? "#111" : "#777", whiteSpace: "nowrap" }}>{x.townKana}</div>
                    ) : null}
                  </div>
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