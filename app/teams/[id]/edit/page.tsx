// app/teams/[id]/edit/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

import { supabase } from "@/app/lib/supabase";
import { GradeKey } from "@/app/lib/types";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";

const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];
type Toast = { type: "success" | "error" | "info"; text: string };

function makeDefaultRoster11(): Record<GradeKey, string> {
  return { G1: "11", G2: "11", G3: "11", G4: "11", G5: "11", G6: "11" };
}

// contact_* / address_detail カラムが無い環境でも落ちないようにする（列差分の吸収）
function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") && (msg.includes("contact_") || msg.includes("address_detail")))
  );
}

export default function TeamEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // fields
  const [name, setName] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [level, setLevel] = useState(5);
  const [hasGround, setHasGround] = useState(false);
  const [bikeParking, setBikeParking] = useState("不明");
  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");

  const [prefecture, setPrefecture] = useState("東京都");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");

  // ✅ NEW: 丁目・番地・号（例: "1-2-3"）
  const [addressDetail, setAddressDetail] = useState("");

  const [rosterByGradeText, setRosterByGradeText] =
    useState<Record<GradeKey, string>>(makeDefaultRoster11());

  const [note, setNote] = useState("");

  // 連絡先（任意）
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLineId, setContactLineId] = useState("");

  const canSave = useMemo(() => {
    return !!teamId && !!name.trim() && !!prefecture && !!city && categories.length > 0 && !saving;
  }, [teamId, name, prefecture, city, categories, saving]);

  // toast auto close
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

      // ✅ まず optional列（contact_* / address_detail）込みで取得 → 無ければフォールバック
      let res = await supabase
        .from("teams")
        .select(
          "id,owner_id,name,categories,category,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,note,prefecture,city,town,address_detail,contact_email,contact_phone,contact_line_id"
        )
        .eq("id", teamId)
        .single();

      if (res.error && isMissingColumnError(res.error)) {
        res = await supabase
          .from("teams")
          .select(
            "id,owner_id,name,categories,category,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,note,prefecture,city,town"
          )
          .eq("id", teamId)
          .single();
      }

      if (res.error || !res.data) {
        console.error(res.error);
        setToast({ type: "error", text: "チーム情報の読み込みに失敗しました" });
        setLoading(false);
        return;
      }

      const data: any = res.data;

      // owner guard（念のため）
      if (data.owner_id !== auth.user.id) {
        setToast({ type: "error", text: "このチームは編集できません（owner違い）" });
        setLoading(false);
        return;
      }

      setName(data.name ?? "");

      // categories（新）なければ category（旧）を入れる
      const cats: string[] =
        Array.isArray(data.categories) && data.categories.length > 0
          ? data.categories
          : data.category
          ? [data.category]
          : [];
      setCategories(cats);

      setLevel(Number(data.level ?? 5));
      setHasGround(!!data.has_ground);
      setBikeParking(data.bike_parking ?? "不明");
      setUniformMain(data.uniform_main ?? "");
      setUniformSub(data.uniform_sub ?? "");

      setPrefecture(data.prefecture ?? "東京都");
      setCity(data.city ?? "");
      setTown(data.town ?? "");

      // ✅ NEW
      setAddressDetail(data.address_detail ?? "");

      const roster = (data.roster_by_grade ?? {}) as Record<string, number>;
      setRosterByGradeText({
        G1: String(roster.G1 ?? 11),
        G2: String(roster.G2 ?? 11),
        G3: String(roster.G3 ?? 11),
        G4: String(roster.G4 ?? 11),
        G5: String(roster.G5 ?? 11),
        G6: String(roster.G6 ?? 11),
      });

      setNote(data.note ?? "");

      // 連絡先（DB未追加なら undefined → ""）
      setContactEmail(data.contact_email ?? "");
      setContactPhone(data.contact_phone ?? "");
      setContactLineId(data.contact_line_id ?? "");

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    try {
      const roster_by_grade = gradeKeys.reduce((acc, g) => {
        const v = (rosterByGradeText[g] ?? "").trim();
        acc[g] = v === "" ? 0 : Math.max(0, Number(v) || 0);
        return acc;
      }, {} as Record<GradeKey, number>);

      const areaText = `${prefecture} ${city}${town ? "・" + town : ""}`;
      const primaryCategory = categories[0];

      const addrDetail = addressDetail.trim();
      // 地図リンク等で使うなら、ここで fullAddressText を作れる（DB保存は任意）
      // const fullAddressText = `${prefecture}${city}${town}${addrDetail ? addrDetail : ""}`.trim();

      const baseUpdate: any = {
        name: name.trim(),
        categories,
        category: primaryCategory,
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

        // ✅ NEW（列があれば保存）
        address_detail: addrDetail || null,
      };

      // ✅ まず optional列（contact_*）込みで更新 → 無ければフォールバック
      let res = await supabase
        .from("teams")
        .update({
          ...baseUpdate,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_line_id: contactLineId.trim() || null,
        })
        .eq("id", teamId);

      // contact_* / address_detail が無い環境なら、外して再試行（落とさない）
      if (res.error && isMissingColumnError(res.error)) {
        console.warn("missing columns. retry without optional fields:", res.error.message);

        const fallbackUpdate: any = { ...baseUpdate };
        delete fallbackUpdate.address_detail;

        res = await supabase.from("teams").update(fallbackUpdate).eq("id", teamId);
      }

      if (res.error) {
        console.error(res.error);
        setToast({ type: "error", text: `保存に失敗: ${res.error.message}` });
        setSaving(false);
        return;
      }

      setToast({ type: "success", text: "✅ 更新しました" });
      setSaving(false);
      router.push("/teams");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "保存に失敗しました" });
      setSaving(false);
    }
  };

  if (loading) return <main style={{ padding: 24 }}>読み込み中…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {toast ? <div style={{ marginBottom: 12, fontWeight: 800 }}>{toast.text}</div> : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>チーム編集</h1>

        {/* ✅ 上部ボタン整理：この画面は「一覧へ」だけでOK */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/teams" className="sh-btn">
            一覧へ
          </Link>
        </div>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span>チーム名（必須）</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} disabled={saving} />
          </label>

          <AreaPickerKanto
            disabled={saving}
            prefecture={prefecture}
            setPrefecture={setPrefecture}
            city={city}
            setCity={setCity}
            town={town}
            setTown={setTown}
            title="エリア（関東）"
            townOptional={true}
          />

          {/* ✅ NEW: 住所詳細（丁目・番地・号） */}
          <label style={label}>
            <span>住所（丁目・番地・号）（任意）</span>
            <input
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              style={input}
              disabled={saving}
              placeholder="例：1-2-3（丁目・番地・号）"
              inputMode="text"
              autoComplete="street-address"
            />
            <span style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
              ※ 地図リンクの精度を上げるための入力欄です（未入力でもOK）。
            </span>
          </label>

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
            <input
              type="checkbox"
              checked={hasGround}
              onChange={(e) => setHasGround(e.target.checked)}
              disabled={saving}
            />
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
                    onChange={(e) =>
                      setRosterByGradeText({ ...rosterByGradeText, [g]: e.target.value.replace(/[^\d]/g, "") })
                    }
                    style={input}
                    disabled={saving}
                  />
                </label>
              ))}
            </div>
          </div>

          <div style={{ ...card, background: "#fafafa" }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>連絡先（任意）</div>
            <div style={{ display: "grid", gap: 10 }}>
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

            <div style={{ marginTop: 8, fontSize: 12, color: "#666", lineHeight: 1.6 }}>
              ※ DBに contact_email / contact_phone / contact_line_id が無い環境でも更新できるようにしています（自動フォールバック）。
            </div>
          </div>

          <label style={label}>
            <span>メモ（任意）</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...input, minHeight: 90 }}
              disabled={saving}
            />
          </label>

          <button className="sh-btn" onClick={save} type="button" disabled={!canSave}>
            {saving ? "保存中..." : "更新"}
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