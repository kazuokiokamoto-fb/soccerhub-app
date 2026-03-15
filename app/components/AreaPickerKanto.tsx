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
const LIST_MAX_HEIGHT = 170;

const KANTO_PREFS = [
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  "茨城県",
  "栃木県",
  "群馬県",
] as const;

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
  useChipUI?: boolean;
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
    useChipUI = false,
  } = props;

  const [cityOptions, setCityOptions] = useState<Array<{ city: string; cityKana?: string }>>([]);
  const [townOptions, setTownOptions] = useState<Array<{ town: string; townKana?: string }>>([]);

  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTowns, setLoadingTowns] = useState(false);

  const [showCityList, setShowCityList] = useState(false);
  const [showTownList, setShowTownList] = useState(false);

  const collator = useMemo(() => new Intl.Collator("ja", { sensitivity: "base" }), []);

  const applyPrefecture = (value: string) => {
    setPrefecture(value);
    setCity("");
    setTown("");
    setCityQuery("");
    setTownQuery("");
    setCityOptions([]);
    setTownOptions([]);
    setShowCityList(!!value);
    setShowTownList(false);
  };

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

  const clearPrefecture = () => {
    setPrefecture("");
    setCity("");
    setTown("");
    setCityQuery("");
    setTownQuery("");
    setCityOptions([]);
    setTownOptions([]);
    setShowCityList(false);
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
    if (!prefecture) return;
    setShowCityList(true);
    setShowTownList(false);
    setCityQuery("");
  };

  const reopenTown = () => {
    if (!city) return;
    setShowTownList(true);
    setTownQuery("");
  };

  const handleCityInputChange = (value: string) => {
    setCityQuery(value);

    if (!prefecture) return;

    if (city && value !== city) {
      setCity("");
      setTown("");
      setTownQuery("");
      setTownOptions([]);
      setShowTownList(false);
    }

    setShowCityList(true);
  };

  const handleTownInputChange = (value: string) => {
    setTownQuery(value);

    if (!city) return;

    if (town && value !== town) {
      setTown("");
    }

    setShowTownList(true);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setShowCityList(false);
    if (e.key === "Enter" && filteredCityOptions.length === 1) {
      e.preventDefault();
      applyCity(filteredCityOptions[0].city);
    }
  };

  const handleTownKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setShowTownList(false);
    if (e.key === "Enter" && filteredTownOptions.length === 1) {
      e.preventDefault();
      applyTown(filteredTownOptions[0].town);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setCity("");
      setTown("");
      setCityQuery("");
      setTownQuery("");
      setCityOptions([]);
      setTownOptions([]);
      setShowTownList(false);

      if (!prefecture) {
        setShowCityList(false);
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

        if (!cancelled) {
          setCityOptions(rows);
          setShowCityList(true);
        }
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

  if (useChipUI) {
    return (
      <div style={wrap}>
        <div style={titleStyle}>{title}</div>

        <div style={block}>
          <div style={sectionTitle}>都県</div>
          <div style={prefButtonsWrap}>
            {allowAll ? (
              <button
                type="button"
                onClick={() => applyPrefecture("")}
                disabled={disabled}
                style={{
                  ...prefBtn,
                  ...(!prefecture ? prefBtnActive : prefBtnInactive),
                  ...(disabled ? disabledBtn : null),
                }}
              >
                {allLabel}
              </button>
            ) : null}

            {KANTO_PREFS.map((p) => {
              const active = prefecture === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPrefecture(p)}
                  disabled={disabled}
                  style={{
                    ...prefBtn,
                    ...(active ? prefBtnActive : prefBtnInactive),
                    ...(disabled ? disabledBtn : null),
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {prefecture ? (
          <div style={block}>
            <div style={sectionTitle}>市区町村</div>
            <input
              value={cityQuery}
              onFocus={() => {
                if (prefecture) setShowCityList(true);
              }}
              onChange={(e) => handleCityInputChange(e.target.value)}
              onKeyDown={handleCityKeyDown}
              className="sh-input"
              placeholder="市区町村を検索"
              disabled={disabled || !prefecture}
            />

            {city ? (
              <div style={selectedInline}>
                <span style={selectedInlineText}>選択中：{city}</span>
                <button
                  type="button"
                  className="sh-btn sh-btn--ghost"
                  onClick={clearCity}
                  disabled={disabled}
                >
                  クリア
                </button>
              </div>
            ) : null}

            {showCityList ? (
              <div style={listBoxCompact}>
                {loadingCities ? (
                  <div style={hintText}>市区町村を読み込み中です...</div>
                ) : filteredCityOptions.length === 0 ? (
                  <div style={hintText}>一致する市区町村候補がありません</div>
                ) : (
                  filteredCityOptions.map((x) => {
                    const active = city === x.city;
                    return (
                      <button
                        key={x.city}
                        type="button"
                        onClick={() => applyCity(x.city)}
                        disabled={disabled}
                        style={{
                          ...rowBtn,
                          ...(active ? rowBtnActive : rowBtnInactive),
                          ...(disabled ? disabledBtn : null),
                        }}
                      >
                        <div style={rowInner}>
                          <div style={mainText}>{x.city}</div>
                          {x.cityKana ? <div style={kanaText(active)}>{x.cityKana}</div> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {city ? (
          <div style={block}>
            <div style={sectionTitle}>町名</div>
            <input
              value={townQuery}
              onFocus={() => {
                if (city) setShowTownList(true);
              }}
              onChange={(e) => handleTownInputChange(e.target.value)}
              onKeyDown={handleTownKeyDown}
              className="sh-input"
              placeholder="町名を検索"
              disabled={disabled || !city}
            />

            {town ? (
              <div style={selectedInline}>
                <span style={selectedInlineText}>選択中：{town}</span>
                <button
                  type="button"
                  className="sh-btn sh-btn--ghost"
                  onClick={clearTown}
                  disabled={disabled}
                >
                  クリア
                </button>
              </div>
            ) : null}

            {showTownList ? (
              <div style={listBoxCompact}>
                {loadingTowns ? (
                  <div style={hintText}>町名候補を読み込み中です...</div>
                ) : filteredTownOptions.length === 0 ? (
                  <div style={hintText}>一致する町名候補がありません</div>
                ) : (
                  filteredTownOptions.map((x) => {
                    const active = town === x.town;
                    return (
                      <button
                        key={`${x.town}__${x.townKana ?? ""}`}
                        type="button"
                        onClick={() => applyTown(x.town)}
                        disabled={disabled}
                        style={{
                          ...rowBtn,
                          ...(active ? rowBtnActive : rowBtnInactive),
                          ...(disabled ? disabledBtn : null),
                        }}
                      >
                        <div style={rowInner}>
                          <div style={mainText}>{x.town}</div>
                          {x.townKana ? <div style={kanaText(active)}>{x.townKana}</div> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={previewText}>
          表示例：
          <b>
            {prefecture
              ? `${prefecture} ${city || "（市区町村未選択）"}${town ? "・" + town : ""}`
              : `${allLabel}${city ? " / " + city : ""}${town ? " / " + town : ""}`}
          </b>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={titleStyle}>{title}</div>

      <div style={block}>
        <div style={rowHead}>
          <div style={sectionTitle}>都県（{allowAll ? "任意" : "必須"}）</div>
        </div>

        <div style={prefButtonsWrap}>
          {allowAll ? (
            <button
              type="button"
              onClick={() => applyPrefecture("")}
              disabled={disabled}
              style={{
                ...prefBtn,
                ...(!prefecture ? prefBtnActive : prefBtnInactive),
                ...(disabled ? disabledBtn : null),
              }}
            >
              {allLabel}
            </button>
          ) : null}

          {KANTO_PREFS.map((p) => {
            const active = prefecture === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => applyPrefecture(p)}
                disabled={disabled}
                style={{
                  ...prefBtn,
                  ...(active ? prefBtnActive : prefBtnInactive),
                  ...(disabled ? disabledBtn : null),
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        <div style={helperText}>
          {!prefecture
            ? "関東全体のまま検索できます。都県で絞ると市区町村・町名を選びやすくなります。"
            : `選択中：${prefecture}`}
        </div>

        {prefecture && allowAll ? (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="sh-btn sh-btn--ghost"
              onClick={clearPrefecture}
              disabled={disabled}
            >
              都県をクリア
            </button>
          </div>
        ) : null}
      </div>

      <div style={block}>
        <div style={rowHead}>
          <div style={sectionTitle}>市区町村（任意）</div>
          <div style={statusText}>
            {!prefecture ? "候補 0 件" : loadingCities ? "読み込み中..." : `候補 ${cityOptions.length} 件`}
          </div>
        </div>

        <input
          value={cityQuery}
          onFocus={() => {
            if (prefecture) setShowCityList(true);
          }}
          onChange={(e) => handleCityInputChange(e.target.value)}
          onKeyDown={handleCityKeyDown}
          className="sh-input"
          placeholder={
            prefecture
              ? "漢字・ひらがなで検索（例：世田谷 / せたがや / 横浜 / よこはま）"
              : "先に都県を選んでください"
          }
          disabled={disabled || !prefecture}
        />

        <div style={helperText}>
          {!prefecture
            ? "市区町村を使うときは、先に都県を選んでください。"
            : city
            ? "選択済みです。変更するときは下のボタンを押してください。"
            : "市区町村はあいうえお順です。漢字・ひらがな、どちらでも検索できます。"}
        </div>

        {city ? (
          <div style={selectedBox}>
            <div style={selectedText}>
              選択中：<b>{city}</b>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="sh-btn sh-btn--ghost"
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
              <div style={hintText}>市区町村を読み込み中です...</div>
            ) : filteredCityOptions.length === 0 ? (
              <div style={hintText}>一致する市区町村候補がありません</div>
            ) : (
              filteredCityOptions.map((x) => {
                const active = city === x.city;
                return (
                  <button
                    key={x.city}
                    type="button"
                    onClick={() => applyCity(x.city)}
                    disabled={disabled}
                    style={{
                      ...rowBtn,
                      ...(active ? rowBtnActive : rowBtnInactive),
                      ...(disabled ? disabledBtn : null),
                    }}
                  >
                    <div style={rowInner}>
                      <div style={mainText}>{x.city}</div>
                      {x.cityKana ? <div style={kanaText(active)}>{x.cityKana}</div> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <div style={block}>
        <div style={rowHead}>
          <div style={sectionTitle}>町名（{townOptional ? "任意" : "必須"}）</div>
          <div style={statusText}>
            {!city ? "候補 0 件" : loadingTowns ? "読み込み中..." : `候補 ${townOptions.length} 件`}
          </div>
        </div>

        <input
          value={townQuery}
          onFocus={() => {
            if (city) setShowTownList(true);
          }}
          onChange={(e) => handleTownInputChange(e.target.value)}
          onKeyDown={handleTownKeyDown}
          className="sh-input"
          placeholder={
            city
              ? "漢字・ひらがなで検索（例：三宿 / みしゅく / 南青山）"
              : "先に市区町村を選択してください"
          }
          disabled={disabled || !city}
        />

        <div style={helperText}>
          {!city
            ? "先に市区町村を選択してください。"
            : town
            ? "選択済みです。変更するときは下のボタンを押してください。"
            : "町名はあいうえお順です。漢字・ひらがな、どちらでも検索できます。"}
        </div>

        {town ? (
          <div style={selectedBox}>
            <div style={selectedText}>
              選択中：<b>{town}</b>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="sh-btn sh-btn--ghost"
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
              <div style={hintText}>町名候補を読み込み中です...</div>
            ) : filteredTownOptions.length === 0 ? (
              <div style={hintText}>一致する町名候補がありません</div>
            ) : (
              filteredTownOptions.map((x) => {
                const active = town === x.town;
                return (
                  <button
                    key={`${x.town}__${x.townKana ?? ""}`}
                    type="button"
                    onClick={() => applyTown(x.town)}
                    disabled={disabled}
                    style={{
                      ...rowBtn,
                      ...(active ? rowBtnActive : rowBtnInactive),
                      ...(disabled ? disabledBtn : null),
                    }}
                  >
                    <div style={rowInner}>
                      <div style={mainText}>{x.town}</div>
                      {x.townKana ? <div style={kanaText(active)}>{x.townKana}</div> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : null}

        <div style={previewText}>
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

const wrap: React.CSSProperties = {
  padding: 16,
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  display: "grid",
  gap: 14,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
};

const block: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const rowHead: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#21342a",
};

const statusText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.6,
};

const prefButtonsWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const prefBtn: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 800,
  transition: "all 0.15s ease",
  outline: "none",
  boxShadow: "none",
};

const prefBtnInactive: React.CSSProperties = {
  borderColor: "#d6eadb",
  background: "#fff",
  color: "#23412c",
};

const prefBtnActive: React.CSSProperties = {
  borderColor: "#145c2a",
  background: "#145c2a",
  color: "#fff",
  boxShadow: "0 6px 14px rgba(20,92,42,0.14)",
};

const selectedBox: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  border: "1px solid #e4ebe6",
  borderRadius: 14,
  background: "#fafcfb",
};

const selectedText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const listBoxCompact: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 10,
  border: "1px solid #e4ebe6",
  borderRadius: 14,
  background: "#fff",
  maxHeight: LIST_MAX_HEIGHT,
  overflowY: "auto",
};

const rowBtn: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  boxSizing: "border-box",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  cursor: "pointer",
  transition: "all 0.15s ease",
  outline: "none",
};

const rowBtnInactive: React.CSSProperties = {
  borderColor: "#edf1ee",
  background: "#fafcfb",
  boxShadow: "none",
};

const rowBtnActive: React.CSSProperties = {
  borderColor: "#bfdcc7",
  background: "#eef7f0",
  boxShadow: "0 2px 8px rgba(20,92,42,0.06)",
};

const rowInner: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "baseline",
};

const mainText: React.CSSProperties = {
  fontWeight: 800,
  color: "#21342a",
};

const hintText: React.CSSProperties = {
  color: "#66756d",
  fontSize: 12,
};

const previewText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.6,
};

const disabledBtn: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const kanaText = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  color: active ? "#145c2a" : "#7a867f",
  whiteSpace: "nowrap",
});

const chipWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const selectedInline: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const selectedInlineText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};