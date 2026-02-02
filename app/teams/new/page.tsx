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
const KANTO_PREFS = [
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  "茨城県",
  "栃木県",
  "群馬県",
];

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

  const [cityQuery, setCityQuery] = useState("");
  const [townQuery, setTownQuery] = useState("");

  const [rosterByGradeText, setRosterByGradeText] =
    useState<Record<GradeKey, string>>(makeDefaultRoster11());

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canSave = useMemo(() => {
    return (
      !!name.trim() &&
      !!prefecture &&
      !!city &&
      categories.length > 0 &&
      !saving
    );
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

      const { data } = await supabase
        .from("jp_municipalities")
        .select("prefecture,city")
        .eq("prefecture", prefecture)
        .order("city");

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

      const { data } = await supabase
        .from("jp_towns")
        .select("prefecture,city,town")
        .eq("prefecture", prefecture)
        .eq("city", city)
        .order("town");

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

    const { data: auth } = await supabase.auth.getUser();
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

    const { error, data } = await supabase
      .from("teams")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
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
    if (!cityQuery) return cityOptions.slice(0, 200);
    return cityOptions.filter((c) => c.includes(cityQuery)).slice(0, 200);
  }, [cityOptions, cityQuery]);

  const filteredTownOptions = useMemo(() => {
    if (!townQuery) return townOptions.slice(0, 200);
    return townOptions.filter((t) => t.includes(townQuery)).slice(0, 200);
  }, [townOptions, townQuery]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {toast && (
        <div style={{ marginBottom: 12 }}>
          <b>{toast.text}</b>
        </div>
      )}

      <h1>チーム登録</h1>

      <label>
        チーム名
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <h3>エリア（関東）</h3>

      <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
        {KANTO_PREFS.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>

      <input
        placeholder="市区町村検索"
        value={cityQuery}
        onChange={(e) => setCityQuery(e.target.value)}
      />
      <div>
        {filteredCityOptions.map((c) => (
          <button key={c} onClick={() => setCity(c)}>
            {c}
          </button>
        ))}
      </div>

      {city && (
        <>
          <input
            placeholder="町名検索"
            value={townQuery}
            onChange={(e) => setTownQuery(e.target.value)}
          />
          <div>
            {filteredTownOptions.map((t) => (
              <button key={t} onClick={() => setTown(t)}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      <CheckboxGroup
        title="カテゴリ"
        options={CATEGORY_OPTIONS}
        values={categories}
        onChange={setCategories}
        columns={3}
      />

      <button onClick={save} disabled={!canSave}>
        保存
      </button>
    </main>
  );
}