"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/app/lib/supabase";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import {
  StrengthRankPicker,
  StrengthRank,
  strengthRankToLegacyLevel,
} from "@/app/components/StrengthRankPicker";
import { CategorySinglePicker } from "@/app/components/CategorySinglePicker";
import { BikeParkingField } from "@/app/components/BikeParkingField";
import { MemberCountField } from "@/app/components/MemberCountField";

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
        msg.includes("bike_parking_capacity") ||
        msg.includes("uniform_gk")))
  );
}

function normalizeCategoryOptions(
  options: Array<string | { value: string; label: string }>
): Array<{ value: string; label: string }> {
  return options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
}

export default function TeamNewPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [name, setName] = useState("");

  const [category, setCategory] = useState("");
  const [strengthRank, setStrengthRank] = useState<StrengthRank>("A");
  const [hasGround, setHasGround] = useState(false);

  const [bikeParking, setBikeParking] = useState<"なし" | "あり">("なし");
  const [bikeParkingCapacity, setBikeParkingCapacity] = useState<string>("");

  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");
  const [uniformGk, setUniformGk] = useState("");

  const [prefecture, setPrefecture] = useState("東京都");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");
  const [addressDetail, setAddressDetail] = useState("");

  const [memberCount, setMemberCount] = useState("");
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

    return (
      !!name.trim() &&
      !!prefecture &&
      !!city &&
      !!category &&
      bikeOk &&
      !saving &&
      !loadingDefaults
    );
  }, [
    name,
    prefecture,
    city,
    category,
    bikeParking,
    bikeParkingCapacity,
    saving,
    loadingDefaults,
  ]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoadingDefaults(true);

      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setLoadingDefaults(false);
          return;
        }

        let res = await supabase
          .from("teams")
          .select(
            "contact_email,contact_phone,contact_line_id,uniform_main,uniform_sub,uniform_gk"
          )
          .eq("owner_id", auth.user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (res.error && isMissingColumnError(res.error)) {
          res = await supabase
            .from("teams")
            .select("uniform_main,uniform_sub")
            .eq("owner_id", auth.user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        }

        const row: any = res.data;

        if (row) {
          setContactEmail(row.contact_email ?? "");
          setContactPhone(row.contact_phone ?? "");
          setContactLineId(row.contact_line_id ?? "");
          setUniformMain(row.uniform_main ?? "");
          setUniformSub(row.uniform_sub ?? "");
          setUniformGk(row.uniform_gk ?? "");
        }
      } catch (e) {
        console.error("load defaults error:", e);
      } finally {
        setLoadingDefaults(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setName("");
    setCategory("");
    setStrengthRank("A");
    setHasGround(false);
    setBikeParking("なし");
    setBikeParkingCapacity("");
    setPrefecture("東京都");
    setCity("");
    setTown("");
    setAddressDetail("");
    setMemberCount("");
    setNote("");
  };

  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) console.error(authErr);

      if (!auth?.user) {
        setToast({ type: "error", text: "ログインが必要です" });
        setSaving(false);
        return;
      }

      const areaText = `${prefecture} ${city}${town ? "・" + town : ""}`;
      const addrDetail = addressDetail.trim();
      const memberCountNum =
        memberCount.trim() === "" ? 0 : Math.max(0, Number(memberCount) || 0);

      const basePayload: any = {
        owner_id: auth.user.id,
        name: name.trim(),
        categories: [category],
        category,
        level: strengthRankToLegacyLevel(strengthRank),
        strength_rank: strengthRank,
        has_ground: hasGround,
        bike_parking: bikeParking,
        bike_parking_capacity:
          bikeParking === "あり" ? bikeParkingCapacity || "不明" : null,
        uniform_main: uniformMain.trim() || "不明",
        uniform_sub: uniformSub.trim() || "不明",
        uniform_gk: uniformGk.trim() || "不明",
        roster_by_grade: { TOTAL: memberCountNum },
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

      let res = await supabase
        .from("teams")
        .insert(withContact)
        .select("id")
        .single();

      if (res.error && isMissingColumnError(res.error)) {
        console.warn(
          "missing columns. retry without optional fields:",
          res.error.message
        );

        const fallbackPayload: any = {
          ...basePayload,
        };

        delete fallbackPayload.address_detail;
        delete fallbackPayload.strength_rank;
        delete fallbackPayload.bike_parking_capacity;
        delete fallbackPayload.uniform_gk;

        res = await supabase
          .from("teams")
          .insert(fallbackPayload)
          .select("id")
          .single();
      }

      if (res.error) {
        console.error(res.error);
        setToast({ type: "error", text: res.error.message });
        setSaving(false);
        return;
      }

      setToast({ type: "success", text: "✅ 登録しました" });

      router.push(`/mypage`);
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
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>
              チーム登録
            </h1>
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
          <div style={infoNotice}>
            <div style={noticeTitle}>登録について</div>
            <div style={helperText}>
              ※ 1アカウントで複数チームを登録できます。<br />
              例：キッズ、U12、U10、女子チームなどを別々に登録可能です。<br />
              ※ 現在は1チームにつき1カテゴリで登録してください。
            </div>
          </div>

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

          <CategorySinglePicker
            title="カテゴリ（必須）"
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            disabled={saving}
          />

          <div style={subSection}>
            <StrengthRankPicker
              value={strengthRank}
              onChange={(rank) => {
                if (rank !== "") setStrengthRank(rank);
              }}
              disabled={saving}
              title="強さ（ランク選択）"
              allowEmpty={false}
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

          <BikeParkingField
            bikeParking={bikeParking}
            setBikeParking={setBikeParking}
            bikeParkingCapacity={bikeParkingCapacity}
            setBikeParkingCapacity={setBikeParkingCapacity}
            capacityOptions={BIKE_CAPACITY_OPTIONS}
            disabled={saving}
          />

          <div style={threeCols}>
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

            <label style={label}>
              <span style={labelTitle}>ユニフォーム（GK）</span>
              <input
                value={uniformGk}
                onChange={(e) => setUniformGk(e.target.value)}
                className="sh-input"
                disabled={saving}
                placeholder="例：黄"
              />
            </label>
          </div>

          <MemberCountField
            value={memberCount}
            onChange={setMemberCount}
            disabled={saving}
          />

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
              ※ 以前登録したチームの連絡先がある場合、自動で初期入力されます。<br />
              ※ DBに contact_email / contact_phone / contact_line_id が無い環境でも保存できるようにしています。<br />
              ※ DBに uniform_gk が無い環境でも保存できるように自動フォールバックしています。
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

          <div style={faqBox}>
            <div style={blockTitle}>Q&A</div>

            <div style={faqItem}>
              <div style={faqQ}>
                Q. 1つのアカウントで複数チームを登録できますか？
              </div>
              <div style={faqA}>
                A. はい、登録できます。カテゴリごとに別チームとして登録してください。
                例：キッズ、U12、U10、女子チームなど。
              </div>
            </div>

            <div style={faqItem}>
              <div style={faqQ}>Q. 1チームで複数カテゴリを持てますか？</div>
              <div style={faqA}>
                A. 現在は1チームにつき1カテゴリです。複数カテゴリがある場合は、チームを分けて登録してください。
              </div>
            </div>
          </div>

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

const infoNotice: React.CSSProperties = {
  padding: 14,
  border: "1px solid #d6eadb",
  borderRadius: 16,
  background: "#f5fbf6",
};

const noticeTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 8,
  color: "#1f5d30",
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

const faqBox: React.CSSProperties = {
  padding: 14,
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  display: "grid",
  gap: 12,
};

const faqItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const faqQ: React.CSSProperties = {
  fontWeight: 800,
  color: "#21342a",
};

const faqA: React.CSSProperties = {
  fontSize: 14,
  color: "#4a5d52",
  lineHeight: 1.7,
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

const threeCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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