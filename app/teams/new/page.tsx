// app/teams/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/app/lib/supabase";
import { GradeKey } from "@/app/lib/types";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import {
  StrengthRankPicker,
  StrengthRank,
  strengthRankToLegacyLevel,
} from "@/app/components/StrengthRankPicker";

const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];

type Toast = { type: "success" | "error" | "info"; text: string };

function makeDefaultRoster11(): Record<GradeKey, string> {
  return { G1: "11", G2: "11", G3: "11", G4: "11", G5: "11", G6: "11" };
}

// contact_* / address_detail / strength_rank が無い環境でも落ちないようにする
function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("contact_") || msg.includes("address_detail") || msg.includes("strength_rank")))
  );
}

export default function TeamNewPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // fields
  const [name, setName] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [strengthRank, setStrengthRank] = useState<StrengthRank>("A");
  const [hasGround, setHasGround] = useState(false);
  const [bikeParking, setBikeParking] = useState("不明");
  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");

  const [prefecture, setPrefecture] = useState("東京都");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");

  const [addressDetail, setAddressDetail] = useState("");

  const [rosterByGradeText, setRosterByGradeText] = useState<Record<GradeKey, string>>(
    makeDefaultRoster11()
  );
  const [note, setNote] = useState("");

  // 連絡先（任意）
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLineId, setContactLineId] = useState("");

  const canSave = useMemo(() => {
    return !!name.trim() && !!prefecture && !!city && categories.length > 0 && !saving;
  }, [name, prefecture, city, categories, saving]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const resetForm = () => {
    setName("");
    setCategories([]);
    setStrengthRank("A");
    setHasGround(false);
    setBikeParking("不明");
    setUniformMain("");
    setUniformSub("");
    setPrefecture("東京都");
    setCity("");
    setTown("");
    setAddressDetail("");
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

    try {
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
      const addrDetail = addressDetail.trim();
      const primaryCategory = categories[0];

      const basePayload: any = {
        owner_id: auth.user.id,
        name: name.trim(),
        categories,
        category: primaryCategory,
        level: strengthRankToLegacyLevel(strengthRank),
        strength_rank: strengthRank,
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
        address_detail: addrDetail || null,
      };

      const withContact: any = {
        ...basePayload,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_line_id: contactLineId.trim() || null,
      };

      let res = await supabase.from("teams").insert(withContact).select("id").single();

      if (res.error && isMissingColumnError(res.error)) {
        console.warn("missing columns. retry without optional fields:", res.error.message);

        const fallbackPayload: any = {
          ...basePayload,
        };

        delete fallbackPayload.address_detail;
        delete fallbackPayload.strength_rank;

        res = await supabase.from("teams").insert(fallbackPayload).select("id").single();
      }

      if (res.error) {
        console.error(res.error);
        setToast({ type: "error", text: res.error.message });
        setSaving(false);
        return;
      }

      setToast({ type: "success", text: "✅ 登録しました" });
      const newId = (res.data as any)?.id;

      router.push(`/teams?created=${newId}`);

      resetForm();
      setSaving(false);
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "保存に失敗しました" });
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {toast ? <div style={{ marginBottom: 12, fontWeight: 800 }}>{toast.text}</div> : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>チーム登録</h1>
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
            allowAll={false}
          />

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

          <StrengthRankPicker
            value={strengthRank}
            onChange={setStrengthRank}
            disabled={saving}
            title="強さ（ランク選択）"
          />

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
            <select
              value={bikeParking}
              onChange={(e) => setBikeParking(e.target.value)}
              style={input}
              disabled={saving}
            >
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
                      setRosterByGradeText({
                        ...rosterByGradeText,
                        [g]: e.target.value.replace(/[^\d]/g, ""),
                      })
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
              ※ DBに contact_email / contact_phone / contact_line_id が無い環境でも保存できるようにしています（自動フォールバック）。
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