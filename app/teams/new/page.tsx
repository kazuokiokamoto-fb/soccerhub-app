"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/app/lib/supabase";

import { CATEGORY_OPTIONS, categoryLabels } from "@/app/lib/categories";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import {
  StrengthRank,
  strengthRankToLegacyLevel,
} from "@/app/components/StrengthRankPicker";
import { STRENGTH_GUIDES } from "@/app/lib/strengthGuides";
import AppHero from "@/app/components/AppHero";

type Toast = { type: "success" | "error" | "info"; text: string };

type CategoryProfile = {
  category: string;
  strength_rank: StrengthRank;
  member_count: string;
};

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
        msg.includes("uniform_gk") ||
        msg.includes("categories") ||
        msg.includes("category_profiles") ||
        msg.includes("member_count")))
  );
}

function buildInitialProfiles(categories: string[]): CategoryProfile[] {
  return categories.map((category) => ({
    category,
    strength_rank: "A" as StrengthRank,
    member_count: "",
  }));
}

function syncProfilesWithCategories(
  prev: CategoryProfile[],
  categories: string[]
): CategoryProfile[] {
  const map = new Map(prev.map((p) => [p.category, p]));
  return categories.map((category) => {
    const found = map.get(category);
    if (found) return found;
    return {
      category,
      strength_rank: "A" as StrengthRank,
      member_count: "",
    };
  });
}

function rankLabel(rank: StrengthRank) {
  switch (rank) {
    case "SS":
      return "SS";
    case "S":
      return "S";
    case "A":
      return "A";
    case "B":
      return "B";
    case "C":
      return "C";
    default:
      return rank;
  }
}

export default function TeamNewPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  
  const [name, setName] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [categoryProfiles, setCategoryProfiles] = useState<CategoryProfile[]>([]);

  const [hasGround, setHasGround] = useState(false);

  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");
  const [uniformGk, setUniformGk] = useState("");

  const [prefecture, setPrefecture] = useState("東京都");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");
  const [addressDetail, setAddressDetail] = useState("");

  const [note, setNote] = useState("");

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLineId, setContactLineId] = useState("");

  useEffect(() => {
    setCategoryProfiles((prev) => syncProfilesWithCategories(prev, categories));
  }, [categories]);

  const primaryProfile = useMemo(() => {
    return categoryProfiles[0] ?? null;
  }, [categoryProfiles]);

  const primaryCategory = useMemo(() => {
    return primaryProfile?.category ?? categories[0] ?? "";
  }, [primaryProfile, categories]);

  const totalMemberCount = useMemo(() => {
    return categoryProfiles.reduce((sum, p) => {
      const n = Number(p.member_count || 0);
      return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
    }, 0);
  }, [categoryProfiles]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!prefecture) return false;
    if (!city) return false;
    if (!town) return false;
    if (categories.length === 0) return false;
    if (loadingDefaults || saving) return false;

    const allFilled = categoryProfiles.length > 0 &&
      categoryProfiles.every((p) => {
        const count = p.member_count.trim();
        return !!p.category && !!p.strength_rank && count !== "";
      });

    return allFilled;
  }, [
    name,
    prefecture,
    city,
    town,
    categories,
    categoryProfiles,
    loadingDefaults,
    saving,
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
    setCategories([]);
    setCategoryProfiles([]);
    setHasGround(false);
    setPrefecture("東京都");
    setCity("");
    setTown("");
    setAddressDetail("");
    setNote("");
  };

  const updateProfile = (
    category: string,
    patch: Partial<CategoryProfile>
  ) => {
    setCategoryProfiles((prev) =>
      prev.map((p) => (p.category === category ? { ...p, ...patch } : p))
    );
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

      const normalizedProfiles = categoryProfiles.map((p) => ({
        category: p.category,
        strength_rank: p.strength_rank,
        member_count: Math.max(0, Number(p.member_count || 0) || 0),
      }));

      const primary = normalizedProfiles[0] ?? null;

      const basePayload: any = {
        owner_id: auth.user.id,
        name: name.trim(),

        category: primary?.category ?? null,
        categories: normalizedProfiles.map((p) => p.category),
        category_profiles: normalizedProfiles,

        level: primary
          ? strengthRankToLegacyLevel(primary.strength_rank)
          : strengthRankToLegacyLevel("A"),
        strength_rank: primary?.strength_rank ?? "A",
        member_count: totalMemberCount,
        roster_by_grade: { TOTAL: totalMemberCount },

        has_ground: hasGround,

        uniform_main: uniformMain.trim() || "不明",
        uniform_sub: uniformSub.trim() || "不明",
        uniform_gk: uniformGk.trim() || "不明",

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
          "missing columns. retry without optional/new fields:",
          res.error.message
        );

        const fallbackPayload: any = {
          owner_id: auth.user.id,
          name: name.trim(),

          category: primary?.category ?? null,
          categories: normalizedProfiles.map((p) => p.category),

          level: primary
            ? strengthRankToLegacyLevel(primary.strength_rank)
            : strengthRankToLegacyLevel("A"),

          has_ground: hasGround,

          uniform_main: uniformMain.trim() || "不明",
          uniform_sub: uniformSub.trim() || "不明",

          roster_by_grade: { TOTAL: totalMemberCount },

          note: note || "",
          prefecture,
          city,
          town: town || null,
          area: areaText,
        };

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

      router.push("/mypage");
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

      <AppHero
        icon="👥"
        title="チーム登録"
        desc="チーム情報を登録して、練習試合マッチングを始めましょう。"
      />

      <div style={backButtonWrap}>
        <Link href="/mypage" className="sh-btn">
          マイページ
        </Link>
      </div>

      <section className="sh-section" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={infoNotice}>
            <div style={noticeTitle}>登録について</div>
            <div style={helperText}>
              ※ 1アカウントで複数チームを登録できます。<br />
              ※ 1チーム内で複数カテゴリを登録できます。<br />
              ※ 各カテゴリごとに「強さ」「人数」を設定できます。<br />
              ※ 先頭カテゴリは互換用の代表カテゴリとして保存します。
            </div>
          </div>

          <label style={label}>
            <span style={labelTitle}>チーム名（必須）</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sh-input"
              disabled={saving}
              placeholder="例：三宿FC"
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
            townOptional={false}
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
            <div style={blockTitle}>カテゴリ（必須・複数選択可）</div>

            <div style={chipWrap}>
              {CATEGORY_OPTIONS.map((opt) => {
                const active = categories.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCategories((prev) =>
                        prev.includes(opt.value)
                          ? prev.filter((v) => v !== opt.value)
                          : [...prev, opt.value]
                      );
                    }}
                    disabled={saving}
                    style={{
                      ...chip,
                      ...(active ? chipActive : null),
                      ...(saving ? chipDisabled : null),
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 8, ...helperText }}>
              選択中：
              {categories.length > 0
                ? ` ${categoryLabels(categories).join(" / ")}`
                : " 未選択"}
            </div>
          </div>

          {categories.length > 0 ? (
            <div style={subSection}>
              <div style={blockTitle}>カテゴリごとの強さ・人数</div>

              <div style={{ display: "grid", gap: 12 }}>
                {categoryProfiles.map((profile) => (
                  <div key={profile.category} style={profileCard}>
                    <div style={profileTitle}>
                      {categoryLabels([profile.category])[0] ?? profile.category}
                    </div>

                    <div style={twoCols}>
                      <label style={label}>
                        <span style={strengthLabelRow}>
                          <span>強さ</span>
                          <button
                            type="button"
                            onClick={() => setShowStrengthHelp(true)}
                            style={strengthHelpButton}
                          >
                            ?
                          </button>
                        </span>
                        <select
                          value={profile.strength_rank}
                          onChange={(e) =>
                            updateProfile(profile.category, {
                              strength_rank: e.target.value as StrengthRank,
                            })
                          }
                          className="sh-select"
                          disabled={saving}
                        >
                          <option value="SS">SS</option>
                          <option value="S">S</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </label>

                      <label style={label}>
                        <span style={labelTitle}>人数</span>
                        <input
                          value={profile.member_count}
                          onChange={(e) =>
                            updateProfile(profile.category, {
                              member_count: e.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                          className="sh-input"
                          disabled={saving}
                          placeholder="例：18"
                          inputMode="numeric"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 8, ...helperText }}>
                合計人数：{totalMemberCount}人
              </div>
            </div>
          ) : null}

          <label style={{ ...checkLabel, opacity: saving ? 0.7 : 1 }}>
            <input
              type="checkbox"
              checked={hasGround}
              onChange={(e) => setHasGround(e.target.checked)}
              disabled={saving}
            />
            自チームでグラウンド提供できる
          </label>

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
              ※ DBに uniform_gk が無い環境でも保存できるように自動フォールバックしています。<br />
              ※ DBに category_profiles / categories が無い環境では旧形式に自動フォールバックします。
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
                A. はい、登録できます。必要に応じてチームを分けて登録してください。
              </div>
            </div>

            <div style={faqItem}>
              <div style={faqQ}>Q. 1チームで複数カテゴリを持てますか？</div>
              <div style={faqA}>
                A. はい。複数カテゴリを登録できます。さらに各カテゴリごとに
                強さと人数を設定できます。
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

            <Link href="/mypage" className="sh-btn sh-btn--ghost">
              キャンセル
            </Link>
          </div>
        </div>
      </section>
          {showStrengthHelp ? (
        <div style={modalOverlay} onClick={() => setShowStrengthHelp(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={modalTitle}>強さの説明</div>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setShowStrengthHelp(false)}
              >
                閉じる
              </button>
            </div>

            <div style={guideList}>
              {STRENGTH_GUIDES.map((guide) => (
                <div key={guide.rank} style={guideCard}>
                  <div style={guideHeader}>
                    <span style={guideRank}>{guide.rank}</span>
                    <strong>{guide.short}</strong>
                  </div>
                  <div style={guideTitle}>{guide.title}</div>
                  <ul style={guideBullets}>
                    {guide.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <div style={guideNote}>{guide.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

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

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
};

const profileCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #dfe7e2",
  background: "#fff",
};

const profileTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
  marginBottom: 10,
};

const chipWrap: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const chip: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#23412c",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const chipActive: React.CSSProperties = {
  background: "#145c2a",
  color: "#fff",
  border: "1px solid #145c2a",
};

const chipDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
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

const strengthLabelRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 800,
  color: "#2d3b31",
};

const strengthHelpButton: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  border: "2px solid #dc2626",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 900,
  cursor: "pointer",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 1000,
  padding: 16,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "none",
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  margin: "24px auto",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const modalTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

const guideList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const guideCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  padding: 14,
  background: "#fafcfb",
};

const guideHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 16,
  color: "#16391f",
};

const guideRank: React.CSSProperties = {
  minWidth: 44,
  padding: "6px 10px",
  borderRadius: 999,
  background: "#246b34",
  color: "#fff",
  fontWeight: 900,
  textAlign: "center",
};

const guideTitle: React.CSSProperties = {
  marginTop: 12,
  fontWeight: 900,
  color: "#1f2937",
};

const guideBullets: React.CSSProperties = {
  margin: "10px 0",
  paddingLeft: 20,
  lineHeight: 1.8,
};

const guideNote: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  background: "#fff7dd",
  border: "1px solid #f3d37a",
  fontWeight: 800,
  color: "#5b4700",
};

const backButtonWrap: React.CSSProperties = {
  marginTop: 14,
  marginBottom: 10,
  display: "flex",
  justifyContent: "flex-start",
};