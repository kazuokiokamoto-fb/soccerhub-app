"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "../../lib/supabase";
import { GradeKey } from "../../lib/types";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";

const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];

type Toast = { type: "success" | "error" | "info"; text: string };

type MunRow = { prefecture: string; city: string };
type TownRow = { prefecture: string; city: string; town: string };

function makeDefaultRoster11(): Record<GradeKey, string> {
  return { G1: "11", G2: "11", G3: "11", G4: "11", G5: "11", G6: "11" };
}

// 関東7都県（UI固定）
const KANTO_PREFS = ["東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"];

export default function TeamNewPage() {
  const router = useRouter();

  // --- base ---
  const [name, setName] = useState("");

  // カテゴリ（複数）
  const [categories, setCategories] = useState<string[]>([]);

  const [level, setLevel] = useState(5);
  const [hasGround, setHasGround] = useState(false);
  const [bikeParking, setBikeParking] = useState("不明");
  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");

  // エリア（関東）
  const [prefecture, setPrefecture] = useState("東京都");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");

  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [townOptions, setTownOptions] = useState<string[]>([]);

  // 検索入力（表示している入力欄の中身）
  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  const [rosterByGradeText, setRosterByGradeText] = useState<Record<GradeKey, string>>(
    makeDefaultRoster11()
  );

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canSave = useMemo(() => {
    return !!name.trim() && !!prefecture && !!city && categories.length > 0 && !saving;
  }, [name, prefecture, city, categories, saving]);

  // toast auto close
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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
        console.error(error);
        setCityOptions([]);
        return;
      }

      const rows = (data ?? []) as MunRow[];
      setCityOptions(rows.map((r) => r.city).filter(Boolean));
    })();
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
        console.error(error);
        setTownOptions([]);
        return;
      }

      const rows = (data ?? []) as TownRow[];
      setTownOptions(rows.map((r) => r.town).filter(Boolean));
    })();
  }, [prefecture, city]);

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
  };

  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    const roster_by_grade = gradeKeys.reduce((acc, g) => {
      acc[g] = Number(rosterByGradeText[g] || 0);
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

    const payload = {
      owner_id: auth.user.id,
      name: name.trim(),
      categories,
      category: categories[0],
      level,
      has_ground: hasGround,
      bike_parking: bikeParking,
      uniform_main: uniformMain || "不明",
      uniform_sub: uniformSub || "不明",
      roster_by_grade,
      note,
      prefecture,
      city,
      town: town || null,
      area: areaText,
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

  // ✅ 追加：選択時に「検索ボックスにも反映」するハンドラ
  const selectCity = (c: string) => {
    setCity(c);
    setCityQuery(c); // ★これでボタン押下→入力欄に表示される
    setTown("");
    setTownQuery("");
  };

  const selectTown = (t: string) => {
    setTown(t);
    setTownQuery(t); // ★これでボタン押下→入力欄に表示される
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {toast && (
        <div style={{ marginBottom: 12 }}>
          <b>{toast.text}</b>
        </div>
      )}

      <h1>チーム登録</h1>

      <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        チーム名
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <h3>エリア（関東）</h3>

      <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
        {KANTO_PREFS.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>

      <div style={{ marginTop: 10 }}>
        <input
          placeholder="市区町村検索"
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />

        {/* ✅ 選択中表示 */}
        <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
          選択中：<b>{city || "（未選択）"}</b>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {filteredCityOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCity(c)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: city === c ? "#fff" : "#f5f5f5",
                fontWeight: city === c ? 800 : 400,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {city && (
        <div style={{ marginTop: 14 }}>
          <input
            placeholder="町名検索"
            value={townQuery}
            onChange={(e) => setTownQuery(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />

          {/* ✅ 選択中表示 */}
          <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
            町名：<b>{town || "（未選択）"}</b>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {filteredTownOptions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => selectTown(t)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  background: town === t ? "#fff" : "#f5f5f5",
                  fontWeight: town === t ? 800 : 400,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <CheckboxGroup
          title="カテゴリ"
          options={CATEGORY_OPTIONS}
          values={categories}
          onChange={setCategories}
          columns={3}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <button onClick={save} disabled={!canSave}>
          保存
        </button>
      </div>
    </main>
  );
}