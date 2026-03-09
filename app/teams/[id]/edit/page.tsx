"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

import { supabase } from "@/app/lib/supabase";
import { GradeKey } from "@/app/lib/types";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import {
  StrengthRankPicker,
  StrengthRank,
  strengthRankToLegacyLevel,
} from "@/app/components/StrengthRankPicker";
import { CategorySinglePicker } from "@/app/components/CategorySinglePicker";
import { BikeParkingField } from "@/app/components/BikeParkingField";
import { RosterByGradeFields } from "@/app/components/RosterByGradeFields";

const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];

const BIKE_CAPACITY_OPTIONS = [
  { value: "5", label: "5台" },
  { value: "10", label: "10台" },
  { value: "15", label: "15台" },
  { value: "20", label: "20台" },
  { value: "25", label: "25台" },
  { value: "30", label: "30台" },
  { value: "35", label: "35台" },
  { value: "40", label: "40台" },
  { value: "45", label: "45台" },
  { value: "50+", label: "50台以上" },
  { value: "不明", label: "不明" },
] as const;

type Toast = { type: "success" | "error" | "info"; text: string };

function makeDefaultRoster11(): Record<GradeKey, string> {
  return { G1: "11", G2: "11", G3: "11", G4: "11", G5: "11", G6: "11" };
}

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("contact_") ||
        msg.includes("address_detail") ||
        msg.includes("strength_rank") ||
        msg.includes("bike_parking_capacity")))
  );
}

function normalizeCategoryOptions(
  options: Array<string | { value: string; label: string }>
): Array<{ value: string; label: string }> {
  return options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
}

export default function TeamEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [name, setName] = useState("");

  const [category, setCategory] = useState("");
  const [strengthRank, setStrengthRank] = useState<StrengthRank>("A");
  const [hasGround, setHasGround] = useState(false);

  const [bikeParking, setBikeParking] = useState<"なし" | "あり">("なし");
  const [bikeParkingCapacity, setBikeParkingCapacity] = useState<string>("");

  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");

  const [prefecture, setPrefecture] = useState("東京都");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");

  const [addressDetail, setAddressDetail] = useState("");

  const [rosterByGradeText, setRosterByGradeText] =
    useState<Record<GradeKey, string>>(makeDefaultRoster11());

  const [note, setNote] = useState("");

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLineId, setContactLineId] = useState("");

  const categoryOptions = useMemo(
    () =>
      normalizeCategoryOptions(
        CATEGORY_OPTIONS as Array<string | { value: string; label: string }>
      ),
    []
  );

  const canSave = useMemo(() => {
    const bikeOk =
      bikeParking === "なし" || (bikeParking === "あり" && !!bikeParkingCapacity);

    return !!teamId && !!name.trim() && !!prefecture && !!city && !!category && bikeOk && !saving;
  }, [teamId, name, prefecture, city, category, bikeParking, bikeParkingCapacity, saving]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!teamId) return;

    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();

      if (!auth?.user) {
        router.replace("/login");
        return;
      }

      let res = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (res.error || !res.data) {
        setToast({ type: "error", text: "チーム情報の読み込みに失敗しました" });
        setLoading(false);
        return;
      }

      const data: any = res.data;

      if (data.owner_id !== auth.user.id) {
        setToast({ type: "error", text: "このチームは編集できません" });
        setLoading(false);
        return;
      }

      setName(data.name ?? "");
      setCategory(data.category ?? "");

      setStrengthRank(data.strength_rank ?? "A");

      setHasGround(!!data.has_ground);

      setBikeParking(data.bike_parking ?? "なし");
      setBikeParkingCapacity(data.bike_parking_capacity ?? "");

      setUniformMain(data.uniform_main ?? "");
      setUniformSub(data.uniform_sub ?? "");

      setPrefecture(data.prefecture ?? "東京都");
      setCity(data.city ?? "");
      setTown(data.town ?? "");

      setAddressDetail(data.address_detail ?? "");

      const roster = data.roster_by_grade ?? {};

      setRosterByGradeText({
        G1: String(roster.G1 ?? 11),
        G2: String(roster.G2 ?? 11),
        G3: String(roster.G3 ?? 11),
        G4: String(roster.G4 ?? 11),
        G5: String(roster.G5 ?? 11),
        G6: String(roster.G6 ?? 11),
      });

      setNote(data.note ?? "");

      setContactEmail(data.contact_email ?? "");
      setContactPhone(data.contact_phone ?? "");
      setContactLineId(data.contact_line_id ?? "");

      setLoading(false);
    })();
  }, [teamId]);

  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    const roster_by_grade = gradeKeys.reduce((acc, g) => {
      const v = (rosterByGradeText[g] ?? "").trim();
      acc[g] = v === "" ? 0 : Math.max(0, Number(v) || 0);
      return acc;
    }, {} as Record<GradeKey, number>);

    const areaText = `${prefecture} ${city}${town ? "・" + town : ""}`;

    const payload = {
      name,
      category,
      categories: [category],
      level: strengthRankToLegacyLevel(strengthRank),
      strength_rank: strengthRank,
      has_ground: hasGround,
      bike_parking: bikeParking,
      bike_parking_capacity:
        bikeParking === "あり" ? bikeParkingCapacity || "不明" : null,
      uniform_main: uniformMain || "不明",
      uniform_sub: uniformSub || "不明",
      roster_by_grade,
      note,
      prefecture,
      city,
      town,
      area: areaText,
      address_detail: addressDetail || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      contact_line_id: contactLineId || null,
    };

    const res = await supabase.from("teams").update(payload).eq("id", teamId);

    if (res.error) {
      setToast({ type: "error", text: res.error.message });
      setSaving(false);
      return;
    }

    setToast({ type: "success", text: "更新しました" });

    router.push("/teams");
  };

  if (loading) return <main style={{ padding: 24 }}>読み込み中…</main>;

  return (
    <main className="sh-page-wrap" style={{ padding: 24 }}>
      <h1>チーム編集</h1>

      <section style={{ marginTop: 20, display: "grid", gap: 20 }}>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="チーム名"
        />

        <AreaPickerKanto
          prefecture={prefecture}
          setPrefecture={setPrefecture}
          city={city}
          setCity={setCity}
          town={town}
          setTown={setTown}
        />

        <CategorySinglePicker
          options={categoryOptions}
          value={category}
          onChange={setCategory}
        />

        <StrengthRankPicker
          value={strengthRank}
          onChange={setStrengthRank}
        />

        <BikeParkingField
          bikeParking={bikeParking}
          setBikeParking={setBikeParking}
          bikeParkingCapacity={bikeParkingCapacity}
          setBikeParkingCapacity={setBikeParkingCapacity}
          capacityOptions={BIKE_CAPACITY_OPTIONS}
        />

        <RosterByGradeFields
          gradeKeys={gradeKeys}
          roster={rosterByGradeText}
          setRoster={setRosterByGradeText}
        />

        <button onClick={save} disabled={!canSave}>
          更新
        </button>

        <Link href="/teams">一覧へ戻る</Link>

      </section>
    </main>
  );
}