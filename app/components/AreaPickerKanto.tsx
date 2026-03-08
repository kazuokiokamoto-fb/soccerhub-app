"use client";

import React, { useEffect, useMemo, useState } from "react";

type PrefApiRow = {
  prefecture: string;
  prefectureKana?: string;
};

type CityApiRow = {
  prefecture: string;
  city: string;
  cityKana?: string;
};

type TownApiRow = {
  prefecture: string;
  city: string;
  town: string;
  townKana?: string;
};

const SEARCH_DEBOUNCE_MS = 250;

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
    title = "エリア",
    townOptional = true,
    allowAll = false,
    allLabel = "すべて",
  } = props;

  const [prefectureOptions, setPrefectureOptions] = useState<
    Array<{ prefecture: string; prefectureKana?: string }>
  >([]);
  const [cityOptions, setCityOptions] = useState<Array<{ city: string; cityKana?: string }>>([]);
  const [townOptions, setTownOptions] = useState<Array<{ town: string; townKana?: string }>>([]);

  const [prefQuery, setPrefQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTowns, setLoadingTowns] = useState(false);

  const collator = useMemo(() => new Intl.Collator("ja", { sensitivity: "base" }), []);

  const applyPrefecture = (p: string) => {
    setPrefecture(p);
    setPrefQuery(p);
    setCity("");
    setTown("");
    setCityQuery("");
    setTownQuery("");
    setCityOptions([]);
    setTownOptions([]);
  };

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

  const clearPrefecture = () => {
    setPrefecture("");
    setCity("");
    setTown("");
    setPrefQuery("");
    setCityQuery("");
    setTownQuery("");
    setCityOptions([]);
    setTownOptions([]);
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
    if (prefecture && prefQuery !== prefecture) setPrefQuery(prefecture);
    if (!prefecture && prefQuery) setPrefQuery("");

    if (city && cityQuery !== city) setCityQuery(city);
    if (!city && cityQuery) setCityQuery("");

    if (town && townQuery !== town) setTownQuery(town);
    if (!town && townQuery) setTownQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefecture, city, town]);

  // 都道府県取得
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadingPrefs(true);
      try {
        const q = prefQuery.trim();
        const url = `/api/address/prefectures${q ? `?q=${encodeURIComponent(q)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          console.error("[prefectures api] error:", json);
          if (!cancelled) setPrefectureOptions([]);
          return;
        }

        const rows = ((json?.items ?? []) as PrefApiRow[])
          .map((r) => ({
            prefecture: r.prefecture,
            prefectureKana: r.prefectureKana ?? "",
          }))
          .filter((r) => r.prefecture);

        rows.sort((a, b) => {
          const ak = a.prefectureKana || a.prefecture;
          const bk = b.prefectureKana || b.prefecture;
          const c1 = collator.compare(ak, bk);
          if (c1 !== 0) return c1;
          return collator.compare(a.prefecture, b.prefecture);
        });

        if (!cancelled) setPrefectureOptions(rows);
      } catch (e) {
        console.error("[prefectures api] fetch error:", e);
        if (!cancelled) setPrefectureOptions([]);
      } finally {
        if (!cancelled) setLoadingPrefs(false);
      }
    };

    const timer = setTimeout(run, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prefQuery, collator]);

  // 都道府県変更時：市区町村全件取得
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setCity("");
      setTown("");
      setCityQuery("");
      setTownQuery("");
      setCityOptions([]);
      setTownOptions([]);

      if (!prefecture) return;

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
            cityKana: r.cityKana ?? "",
          }))
          .filter((r) => r.city);

        rows.sort((a, b) => {
          const ak = a.cityKana || a.city;
          const bk = b.cityKana || b.city;
          const c1 = collator.compare(ak, bk);
          if (c1 !== 0) return c1;
          return collator.compare(a.city, b.city);
        });

        if (!cancelled) setCityOptions(rows);
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
  }, [prefecture, collator]);

  // 市区町村検索
  useEffect(() => {
    let cancelled = false;

    if (!prefecture) return;

    const q = cityQuery.trim();
    if (!q || q === city) return;

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
            cityKana: r.cityKana ?? "",
          }))
          .filter((r) => r.city);

        rows.sort((a, b) => {
          const ak = a.cityKana || a.city;
          const bk = b.cityKana || b.city;
          const c1 = collator.compare(ak, bk);
          if (c1 !== 0) return c1;
          return collator.compare(a.city, b.city);
        });

        if (!cancelled) setCityOptions(rows);
      } catch (e) {
        console.error("[cities api query] fetch error:", e);
        if (!cancelled) setCityOptions([]);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityQuery, city, prefecture, collator]);

  // 市区町村変更時：町名全件取得
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
          `&limit=300`;

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
          const ak = a.townKana || a.town;
          const bk = b.townKana || b.town;
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
  }, [prefecture, city, collator]);

  // 町名検索
  useEffect(() => {
    let cancelled = false;

    if (!prefecture || !city) return;

    const q = townQuery.trim();
    if (!q || q === town) return;

    const timer = setTimeout(async () => {
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
          const ak = a.townKana || a.town;
          const bk = b.townKana || b.town;
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
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [townQuery, town, prefecture, city, collator]);

  const filteredPrefectureOptions = useMemo(() => prefectureOptions, [prefectureOptions]);
  const filteredCityOptions = useMemo(() => cityOptions, [cityOptions]);
  const filteredTownOptions = useMemo(() => townOptions, [townOptions]);

  const showPrefList = !disabled;
  const showCityList = !!prefecture;
  const showTownList = !!prefecture && !!city;

  return (
    <div style={{ ...card, background: "#fafafa" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>

      {/* 都道府県 */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>都道府県（{allowAll ? "任意" : "必須"}）</div>
          <div style={{ fontSize: 12, color: "#777" }}>
            {loadingPrefs ? "読み込み中..." : `候補 ${prefectureOptions.length} 件`}
          </div>
        </div>

        {allowAll ? (
          <button
            type="button"
            className="sh-btn"
            style={{ width: "fit-content" }}
            onClick={clearPrefecture}
            disabled={disabled}
          >
            {allLabel}
          </button>
        ) : null}

        <input
          value={prefQuery}
          onChange={(e) => {
            setPrefQuery(e.target.value);
            if (prefecture && e.target.value !== prefecture) {
              setPrefecture("");
              setCity("");
              setTown("");
              setCityQuery("");
              setTownQuery("");
              setCityOptions([]);
              setTownOptions([]);
            }
          }}
          style={input}
          placeholder="検索（例：東京 / とうきょう / 神奈川）"
          disabled={disabled}
        />

        <div style={listBox}>
          {!showPrefList ? (
            <div style={{ color: "#777", fontSize: 12 }}>都道府県候補はありません</div>
          ) : loadingPrefs ? (
            <div style={{ color: "#777", fontSize: 12 }}>都道府県を読み込み中です...</div>
          ) : filteredPrefectureOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>一致する都道府県候補がありません</div>
          ) : (
            filteredPrefectureOptions.map((x) => {
              const active = prefecture === x.prefecture;
              return (
                <button
                  key={x.prefecture}
                  type="button"
                  onClick={() => applyPrefecture(x.prefecture)}
                  disabled={disabled}
                  style={{ ...rowBtn, ...(active ? rowBtnActive : null) }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800 }}>{x.prefecture}</div>
                    {x.prefectureKana ? (
                      <div style={{ fontSize: 12, color: active ? "#111" : "#777", whiteSpace: "nowrap" }}>
                        {x.prefectureKana}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          選択中：<b>{prefecture || "（未選択）"}</b>
        </div>
      </div>

      {/* 市区町村 */}
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>市区町村（{allowAll ? "任意" : "必須"}）</div>
          <div style={{ fontSize: 12, color: "#777" }}>
            {loadingCities ? "読み込み中..." : `候補 ${cityOptions.length} 件`}
          </div>
        </div>

        <input
          value={cityQuery}
          onChange={(e) => {
            setCityQuery(e.target.value);
            if (city && e.target.value !== city) {
              setCity("");
              setTown("");
              setTownQuery("");
              setTownOptions([]);
            }
          }}
          style={input}
          placeholder={
            prefecture ? "漢字・ひらがなで検索（例：世田谷 / せたがや / 横浜 / よこはま）" : "先に都道府県を選択してください"
          }
          disabled={disabled || !prefecture}
        />

        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          {!prefecture
            ? "先に都道府県を選択してください"
            : "市区町村はあいうえお順で表示します。漢字・ひらがな、どちらでも検索できます。"}
        </div>

        <div style={listBoxTall}>
          {!showCityList ? (
            <div style={{ color: "#777", fontSize: 12 }}>先に都道府県を選択してください</div>
          ) : loadingCities ? (
            <div style={{ color: "#777", fontSize: 12 }}>市区町村を読み込み中です...</div>
          ) : filteredCityOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>一致する市区町村候補がありません</div>
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
                    {x.cityKana ? (
                      <div style={{ fontSize: 12, color: active ? "#111" : "#777", whiteSpace: "nowrap" }}>
                        {x.cityKana}
                      </div>
                    ) : null}
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
          onChange={(e) => {
            setTownQuery(e.target.value);
            if (town && e.target.value !== town) {
              setTown("");
            }
          }}
          style={input}
          placeholder={city ? "漢字・ひらがなで検索（例：三宿 / みしゅく / 南青山）" : "先に市区町村を選択してください"}
          disabled={disabled || !city}
        />

        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          {!city
            ? "先に市区町村を選択してください"
            : "町名はあいうえお順で表示します。漢字・ひらがな、どちらでも検索できます。"}
        </div>

        <div style={listBoxTall}>
          {!showTownList ? (
            <div style={{ color: "#777", fontSize: 12 }}>先に市区町村を選択してください</div>
          ) : loadingTowns ? (
            <div style={{ color: "#777", fontSize: 12 }}>町名候補を読み込み中です...</div>
          ) : filteredTownOptions.length === 0 ? (
            <div style={{ color: "#777", fontSize: 12 }}>一致する町名候補がありません</div>
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
                      <div style={{ fontSize: 12, color: active ? "#111" : "#777", whiteSpace: "nowrap" }}>
                        {x.townKana}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          表示例：<b>{`${prefecture || "（都道府県未選択）"} ${city || "（市区町村未選択）"}${town ? "・" + town : ""}`}</b>
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
  maxHeight: 220,
  overflow: "auto",
};

const listBoxTall: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
  maxHeight: 360,
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