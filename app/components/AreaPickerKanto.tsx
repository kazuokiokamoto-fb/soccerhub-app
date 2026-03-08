"use client";

import React, { useEffect, useMemo, useState } from "react";

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

// 関東だけ
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
    title = "エリアで絞り込み（関東）",
    townOptional = true,
    allowAll = true,
    allLabel = "関東（すべて）",
  } = props;

  const [cityOptions, setCityOptions] = useState<Array<{ city: string; cityKana?: string }>>([]);
  const [townOptions, setTownOptions] = useState<Array<{ town: string; townKana?: string }>>([]);

  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTowns, setLoadingTowns] = useState(false);

  const [showCityList, setShowCityList] = useState(true);
  const [showTownList, setShowTownList] = useState(true);

  const collator = useMemo(() => new Intl.Collator("ja", { sensitivity: "base" }), []);

  const prefectureOptions = allowAll ? ["", ...KANTO_PREFS] : KANTO_PREFS;

  const applyCity = (value: string) => {
    setCity(value);
    setCityQuery(value);
    setTown("");
    setTownQuery("");
    setTownOptions([]);
    setShowCityList(false);
    setShowTownList(true);
  };

  const applyTown = (value: string) => {
    setTown(value);
    setTownQuery(value);
    setShowTownList(false);
  };

  const clearCity = () => {
    setCity("");
    setTown("");
    setCityQuery("");
    setTownQuery("");
    setTownOptions([]);
    setShowCityList(true);
    setShowTownList(false);
  };

  const clearTown = () => {
    setTown("");
    setTownQuery("");
    setShowTownList(true);
  };

  const reopenCity = () => {
    setShowCityList(true);
    if (city) setCityQuery(city);
  };

  const reopenTown = () => {
    setShowTownList(true);
    if (town) setTownQuery(town);
  };

  // 外部 state と入力欄同期
  useEffect(() => {
    if (city && !showCityList && cityQuery !== city) setCityQuery(city);
    if (!city && !showCityList && cityQuery) setCityQuery("");

    if (town && !showTownList && townQuery !== town) setTownQuery(town);
    if (!town && !showTownList && townQuery) setTownQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, town, showCityList, showTownList]);

  // 都道府県変更時：下流クリア + 市区町村取得
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setCity("");
      setTown("");
      setCityQuery("");
      setTownQuery("");
      setCityOptions([]);
      setTownOptions([]);
      setShowCityList(true);
      setShowTownList(false);

      // allowAll で空 = 関東全体のまま。市区町村は出さない
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
  }, [prefecture, collator, setCity, setTown]);

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

  // 市区町村変更時：町名取得
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setTown("");
      setTownQuery("");
      setTownOptions([]);
      setShowTownList(false);

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

        if (!cancelled) {
          setTownOptions(rows);
          setShowTownList(true);
        }
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

  const filteredCityOptions = useMemo(() => cityOptions, [cityOptions]);
  const filteredTownOptions = useMemo(() => townOptions, [townOptions]);

  return (
    <div style={{ ...card, background: "#fafafa" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>

      {/* 都県 */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>都県（{allowAll ? "任意" : "必須"}）</div>
        </div>

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
          onFocus={() => {
            if (prefecture) setShowCityList(true);
          }}
          onChange={(e) => {
            setCityQuery(e.target.value);
            if (prefecture) setShowCityList(true);

            if (city && e.target.value !== city) {
              setCity("");
              setTown("");
              setTownQuery("");
              setTownOptions([]);
              setShowTownList(false);
            }
          }}
          style={input}
          placeholder={
            prefecture
              ? "漢字・ひらがなで検索（例：世田谷 / せたがや / 横浜 / よこはま）"
              : "関東全体のままなら未選択でOK"
          }
          disabled={disabled || !prefecture}
        />

        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          {!prefecture
            ? "都県を絞る場合だけ選択してください。関東全体のままでも使えます。"
            : "市区町村はあいうえお順で表示します。漢字・ひらがな、どちらでも検索できます。"}
        </div>

        {city ? (
          <div style={selectedBox}>
            <div style={{ fontSize: 12, color: "#777" }}>
              選択中：<b>{city}</b>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="sh-btn"
                style={{ width: "fit-content" }}
                onClick={reopenCity}
                disabled={disabled}
              >
                市区町村を変更
              </button>
              <button
                type="button"
                className="sh-btn"
                style={{ width: "fit-content" }}
                onClick={clearCity}
                disabled={disabled}
              >
                市区町村をクリア
              </button>
            </div>
          </div>
        ) : null}

        {showCityList && prefecture ? (
          <div style={listBoxCompact}>
            {loadingCities ? (
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
          onFocus={() => {
            if (city) setShowTownList(true);
          }}
          onChange={(e) => {
            setTownQuery(e.target.value);
            if (city) setShowTownList(true);

            if (town && e.target.value !== town) {
              setTown("");
            }
          }}
          style={input}
          placeholder={
            city
              ? "漢字・ひらがなで検索（例：三宿 / みしゅく / 南青山）"
              : "先に市区町村を選択してください"
          }
          disabled={disabled || !city}
        />

        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          {!city
            ? "先に市区町村を選択してください"
            : "町名はあいうえお順で表示します。漢字・ひらがな、どちらでも検索できます。"}
        </div>

        {town ? (
          <div style={selectedBox}>
            <div style={{ fontSize: 12, color: "#777" }}>
              選択中：<b>{town}</b>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="sh-btn"
                style={{ width: "fit-content" }}
                onClick={reopenTown}
                disabled={disabled}
              >
                町名を変更
              </button>
              <button
                type="button"
                className="sh-btn"
                style={{ width: "fit-content" }}
                onClick={clearTown}
                disabled={disabled}
              >
                町名をクリア
              </button>
            </div>
          </div>
        ) : null}

        {showTownList && city ? (
          <div style={listBoxCompact}>
            {loadingTowns ? (
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
        ) : null}

        <div style={{ fontSize: 12, color: "#777" }}>
          表示例：
          <b>
            {prefecture
              ? `${prefecture} ${city || "（市区町村未選択）"}${town ? "・" + town : ""}`
              : `${allLabel}${city ? " / " + city : ""}${town ? " / " + town : ""}`}
          </b>
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

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const selectedBox: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
};

const listBoxCompact: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
  maxHeight: 170, // 3.5件くらい見える高さ
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