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

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("contact_") ||
        msg.includes("address_detail") ||
        msg.includes("strength_rank")))
  );
}

export default function TeamNewPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

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
    <main className="sh-page-wrap" style={{ padding: 24 }}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
              ? toastError
              : toastInfo),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{toast.text}</div>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={toastClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      ) : null}

      <section style={heroBox}>
        <div style={heroBadge}>⚽ サカまち</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>チーム登録</h1>
            <p style={heroText}>
              チーム情報を登録して、練習試合マッチングを始めましょう。
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/teams" className="sh-btn">
              一覧へ
            </Link>
          </div>
        </div>
      </section>

      <section className="sh-section" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <label style={label}>
            <span style={labelTitle}>チーム名（必須）</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sh-input"
              disabled={saving}
              placeholder="例：三宿FC U-12"
            />
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
            <span style={labelTitle}>住所（丁目・番地・号）（任意）</span>
            <input
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              className="sh-input"
              disabled={saving}
              placeholder="例：1-2-3（丁目・番地・号）"
              inputMode="text"
              autoComplete="street-address"
            />
            <span style={helperText}>
              ※ 地図リンクの精度を上げるための入力欄です（未入力でもOK）。
            </span>
          </label>

          <div style={subSection}>
            <CheckboxGroup
              title="カテゴリ（複数選択）"
              options={CATEGORY_OPTIONS}
              values={categories}
              onChange={setCategories}
              columns={3}
              disabled={saving}
            />
          </div>

          <div style={subSection}>
            <StrengthRankPicker
              value={strengthRank}
              onChange={setStrengthRank}
              disabled={saving}
              title="強さ（ランク選択）"
            />
          </div>

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
            <span style={labelTitle}>🚲 駐輪場（チーム側）</span>
            <select
              value={bikeParking}
              onChange={(e) => setBikeParking(e.target.value)}
              className="sh-select"
              disabled={saving}
            >
              <option value="あり">あり</option>
              <option value="なし">なし</option>
              <option value="不明">不明</option>
            </select>
          </label>

          <div style={twoCols}>
            <label style={label}>
              <span style={labelTitle}>ユニフォーム（メイン）</span>
              <input
                value={uniformMain}
                onChange={(e) => setUniformMain(e.target.value)}
                className="sh-input"
                disabled={saving}
                placeholder="例：青"
              />
            </label>

            <label style={label}>
              <span style={labelTitle}>ユニフォーム（サブ）</span>
              <input
                value={uniformSub}
                onChange={(e) => setUniformSub(e.target.value)}
                className="sh-input"
                disabled={saving}
                placeholder="例：白"
              />
            </label>
          </div>

          <div style={softCard}>
            <div style={blockTitle}>各学年の人数（ざっくり）</div>
            <div style={threeCols}>
              {gradeKeys.map((g) => (
                <label key={g} style={label}>
                  <span style={labelTitle}>{g}</span>
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
                    className="sh-input"
                    disabled={saving}
                  />
                </label>
              ))}
            </div>
          </div>

          <div style={softCard}>
            <div style={blockTitle}>連絡先（任意）</div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={label}>
                <span style={labelTitle}>メール</span>
                <input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="sh-input"
                  disabled={saving}
                  placeholder="example@mail.com"
                />
              </label>

              <label style={label}>
                <span style={labelTitle}>電話番号</span>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="sh-input"
                  disabled={saving}
                  placeholder="09012345678"
                />
              </label>

              <label style={label}>
                <span style={labelTitle}>LINE ID</span>
                <input
                  value={contactLineId}
                  onChange={(e) => setContactLineId(e.target.value)}
                  className="sh-input"
                  disabled={saving}
                  placeholder="line_id"
                />
              </label>
            </div>

            <div style={{ marginTop: 8, ...helperText }}>
              ※ DBに contact_email / contact_phone / contact_line_id が無い環境でも保存できるようにしています（自動フォールバック）。
            </div>
          </div>

          <label style={label}>
            <span style={labelTitle}>メモ（任意）</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="sh-textarea"
              style={{ minHeight: 100 }}
              disabled={saving}
              placeholder="対戦希望条件、活動方針など"
            />
          </label>

          <div style={actionRow}>
            <button
              className="sh-btn sh-btn--primary"
              onClick={save}
              type="button"
              disabled={!canSave}
            >
              {saving ? "保存中..." : "保存"}
            </button>

            <Link href="/teams" className="sh-btn sh-btn--ghost">
              キャンセル
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 20,
  boxShadow: "0 10px 28px rgba(20,92,42,0.20)",
};

const heroBadge: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.14)",
  fontSize: 12,
  fontWeight: 800,
};

const heroText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.7,
};

const subSection: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 12,
};

const softCard: React.CSSProperties = {
  padding: 14,
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.6,
};

const blockTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
  color: "#1f5d30",
};

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 14px",
  border: "1px solid #dfe7e2",
  borderRadius: 14,
  background: "#f8fbf9",
  color: "#21342a",
  fontWeight: 700,
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
};

const threeCols: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(3, 1fr)",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const toastBox: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 12,
};

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const toastError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};