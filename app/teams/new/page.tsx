// app/teams/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/app/lib/supabase";
import { GradeKey } from "@/app/lib/types";
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";

type Toast = { type: "success" | "error" | "info"; text: string };
type MunRow = { prefecture: string; city: string };
type TownRow = { prefecture: string; city: string; town: string };

const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];
const KANTO_PREFS = ["東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"];

function makeDefaultRoster11(): Record<GradeKey, string> {
  return { G1: "11", G2: "11", G3: "11", G4: "11", G5: "11", G6: "11" };
}

export default function TeamNewPage() {
  const router = useRouter();

  // base
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [level, setLevel] = useState(5);
  const [hasGround, setHasGround] = useState(false);
  const [bikeParking, setBikeParking] = useState("不明");
  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");

  // address
  const [prefecture, setPrefecture] = useState("東京都");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");

  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [townOptions, setTownOptions] = useState<string[]>([]);
  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  // roster / note
  const [rosterByGradeText, setRosterByGradeText] = useState<Record<GradeKey, string>>(makeDefaultRoster11());
  const [note, setNote] = useState("");

  // ✅ 連絡先
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLineId, setContactLineId] = useState("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canSave = useMemo(() => {
    return !!name.trim() && !!prefecture && !!city && categories.length > 0 && !saving;
  }, [name, prefecture, city, categories, saving]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // 都県 → 市区町村（あいうえお順）
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
        .order("city", { ascending: true });

      if (error) {
        console.error(error);
        setCityOptions([]);
        return;
      }

      const rows = (data ?? []) as MunRow[];
      setCityOptions(rows.map((r) => r.city).filter(Boolean));
    })();
  }, [prefecture]);

  // 市区町村 → 町名（あいうえお順）
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
        .order("town", { ascending: true });

      if (error) {
        console.error(error);
        setTownOptions([]);
        return;
      }

      const rows = (data ?? []) as TownRow[];
      setTownOptions(rows.map((r) => r.town).filter(Boolean));
    })();
  }, [prefecture, city]);

  const selectCity = (c: string) => {
    setCity(c);
    setCityQuery(c);
    setTown("");
    setTownQuery("");
  };

  const selectTown = (t: string) => {
    setTown(t);
    setTownQuery(t);
  };

  const filteredCityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return cityOptions.slice(0, 200);
    return cityOptions.filter((c) => c.includes(q)).slice(0, 200);
  }, [cityOptions, cityQuery]);

  const filteredTownOptions = useMemo(() => {
    const q = townQuery.trim();
    if (!q) return townOptions.slice(0, 200);
    return townOptions.filter((t) => t.includes(q)).slice(0, 200);
  }, [townOptions, townQuery]);

  const resetForm = () => {
    setName("");
    setCategories([]);
    setLevel(5);
    setHasGround(false);
    setBikeParking("不明");
    setUniformMain("");
    setUniformSub("");
    setPrefecture("東京都");
    setCity("");
    setTown("");
    setCityQuery("");
    setTownQuery("");
    setRosterByGradeText(makeDefaultRoster11());
    setNote("");
    setContactEmail("");
    setContactPhone("");
    setContactLineId("");
  };

  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    const roster_by_grade = gradeKeys.reduce((acc, g) => {
      const v = (rosterByGradeText[g] ?? "").trim();
      acc[g] = v === "" ? 0 : Math.max(0, Number(v) || 0);
      return acc;
    }, {} as Record<GradeKey, number>);

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) console.error(authErr);

    if (!auth?.user) {
      setToast({ type: "error", text: "ログインが必要です" });
      setSaving(false);
      return;
    }

    const areaText = `${prefecture} ${city}${town ? "・" + town : ""}`;
    const payload: any = {
      owner_id: auth.user.id,
      name: name.trim(),
      categories,
      category: categories[0], // 互換
      level,
      has_ground: hasGround,
      bike_parking: bikeParking,
      uniform_main: uniformMain.trim() || "不明",
      uniform_sub: uniformSub.trim() || "不明",
      roster_by_grade,
      note: note || "",
      prefecture,
      city,
      town: town || null,
      area: areaText,

      // ✅ 連絡先
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_line_id: contactLineId.trim() || null,
    };

    const { error, data } = await supabase.from("teams").insert(payload).select("id").single();

    if (error) {
      console.error(error);
      setToast({ type: "error", text: error.message });
      setSaving(false);
      return;
    }

    setToast({ type: "success", text: "✅ 登録しました" });
    router.push(`/teams?created=${data.id}`);
    resetForm();
    setSaving(false);
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {toast ? <div style={{ marginBottom: 12, fontWeight: 800 }}>{toast.text}</div> : null}

      <h1 style={{ margin: 0 }}>チーム登録</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/teams" className="sh-btn">一覧へ</Link>
        <Link href="/" className="sh-btn">トップへ</Link>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span>チーム名（必須）</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} disabled={saving} />
          </label>

          <div style={{ ...card, background: "#fafafa" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>エリア（関東・あいうえお順）</div>

            <label style={label}>
              <span>都県</span>
              <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} style={input} disabled={saving}>
                {KANTO_PREFS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            <div style={{ marginTop: 10 }}>
              <input
                placeholder="市区町村検索"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                style={{ ...input, width: "100%" }}
                disabled={saving}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
                選択中：<b>{city || "（未選択）"}</b>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {filteredCityOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectCity(c)}
                    className="sh-btn"
                    style={{
                      borderRadius: 999,
                      background: city === c ? "#fff" : "#f5f5f5",
                      fontWeight: city === c ? 900 : 600,
                    }}
                    disabled={saving}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {city ? (
              <div style={{ marginTop: 14 }}>
                <input
                  placeholder="町名検索（任意）"
                  value={townQuery}
                  onChange={(e) => setTownQuery(e.target.value)}
                  style={{ ...input, width: "100%" }}
                  disabled={saving}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
                  町名：<b>{town || "（未選択）"}</b>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {filteredTownOptions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => selectTown(t)}
                      className="sh-btn"
                      style={{
                        borderRadius: 999,
                        background: town === t ? "#fff" : "#f5f5f5",
                        fontWeight: town === t ? 900 : 600,
                      }}
                      disabled={saving}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <CheckboxGroup
            title="カテゴリ（複数選択）"
            options={CATEGORY_OPTIONS}
            values={categories}
            onChange={setCategories}
            columns={3}
            disabled={saving}
          />

          <label style={label}>
            <span>強さ（自己申告 1〜10）：{level}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ width: "100%" }}
              disabled={saving}
            />
          </label>

          <label style={{ ...checkLabel, opacity: saving ? 0.7 : 1 }}>
            <input type="checkbox" checked={hasGround} onChange={(e) => setHasGround(e.target.checked)} disabled={saving} />
            自チームでグラウンド提供できる
          </label>

          <label style={label}>
            <span>🚲 駐輪場（チーム側）</span>
            <select value={bikeParking} onChange={(e) => setBikeParking(e.target.value)} style={input} disabled={saving}>
              <option value="あり">あり</option>
              <option value="なし">なし</option>
              <option value="不明">不明</option>
            </select>
          </label>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={label}>
              <span>ユニフォーム（メイン）</span>
              <input value={uniformMain} onChange={(e) => setUniformMain(e.target.value)} style={input} disabled={saving} />
            </label>
            <label style={label}>
              <span>ユニフォーム（サブ）</span>
              <input value={uniformSub} onChange={(e) => setUniformSub(e.target.value)} style={input} disabled={saving} />
            </label>
          </div>

          <div style={{ ...card, background: "#fafafa" }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>各学年の人数（ざっくり）</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, 1fr)" }}>
              {gradeKeys.map((g) => (
                <label key={g} style={label}>
                  <span>{g}</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={rosterByGradeText[g]}
                    onChange={(e) => setRosterByGradeText({ ...rosterByGradeText, [g]: e.target.value.replace(/[^\d]/g, "") })}
                    style={input}
                    disabled={saving}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* ✅ 連絡先 */}
          <div style={{ ...card, background: "#fafafa" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>連絡先（任意）</div>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={label}>
                <span>メール</span>
                <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={input} disabled={saving} />
              </label>
              <label style={label}>
                <span>電話番号</span>
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={input} disabled={saving} />
              </label>
              <label style={label}>
                <span>LINE ID</span>
                <input value={contactLineId} onChange={(e) => setContactLineId(e.target.value)} style={input} disabled={saving} />
              </label>
            </div>
          </div>

          <label style={label}>
            <span>メモ（任意）</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, minHeight: 90 }} disabled={saving} />
          </label>

          <button className="sh-btn" onClick={save} type="button" disabled={!canSave}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </section>
    </main>
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

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  border: "1px solid #eee",
  borderRadius: 10,
  background: "#fafafa",
};