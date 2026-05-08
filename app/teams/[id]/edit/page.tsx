"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

import { supabase } from "@/app/lib/supabase";

import { CATEGORY_OPTIONS, categoryLabels } from "@/app/lib/categories";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import {
  StrengthRank,
  strengthRankToLegacyLevel,
  legacyLevelToStrengthRank,
} from "@/app/components/StrengthRankPicker";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { STRENGTH_GUIDES } from "@/app/lib/strengthGuides";

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
        msg.includes("member_count") ||
        msg.includes("uniform_gk") ||
        msg.includes("categories") ||
        msg.includes("category_profiles")))
  );
}

function buildProfilesFromCategories(
  categories: string[],
  prevProfiles: CategoryProfile[]
): CategoryProfile[] {
  return categories.map((category) => {
    const hit = prevProfiles.find((p) => p.category === category);
    if (hit) return hit;

    return {
      category,
      strength_rank: "A",
      member_count: "",
    };
  });
}

function sumMemberCount(profiles: CategoryProfile[]) {
  return profiles.reduce((sum, p) => {
    const n = Number(p.member_count || 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export default function TeamEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);

  const [ownerId, setOwnerId] = useState<string>("");

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

  const primaryCategory = useMemo(() => categories[0] ?? "", [categories]);

  const totalMemberCount = useMemo(() => {
    return sumMemberCount(categoryProfiles);
  }, [categoryProfiles]);

  const primaryStrengthRank = useMemo<StrengthRank>(() => {
    const first = categoryProfiles.find((p) => p.category === primaryCategory);
    return first?.strength_rank ?? "A";
  }, [categoryProfiles, primaryCategory]);

  const canSave = useMemo(() => {
    return (
      !!teamId &&
      !!name.trim() &&
      !!prefecture &&
      !!city &&
      categories.length > 0 &&
      categoryProfiles.length > 0 &&
      categoryProfiles.every(
        (p) => !!p.category && !!p.strength_rank && p.member_count !== ""
      ) &&
      !saving &&
      !deleting
    );
  }, [
    teamId,
    name,
    prefecture,
    city,
    categories,
    categoryProfiles,
    saving,
    deleting,
  ]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setCategoryProfiles((prev) => buildProfilesFromCategories(categories, prev));
  }, [categories]);

  useEffect(() => {
    if (!teamId) return;

    (async () => {
      setLoading(true);

      try {
        const { data: auth } = await supabase.auth.getUser();

        if (!auth?.user) {
          router.replace("/login");
          return;
        }

        let res = await supabase
          .from("teams")
          .select(
            "id,owner_id,name,category,categories,category_profiles,level,strength_rank,has_ground,uniform_main,uniform_sub,uniform_gk,prefecture,city,town,area,address_detail,note,contact_email,contact_phone,contact_line_id,member_count,roster_by_grade"
          )
          .eq("id", teamId)
          .single();

        if (res.error && isMissingColumnError(res.error)) {
          res = await supabase
            .from("teams")
            .select(
              "id,owner_id,name,category,level,has_ground,uniform_main,uniform_sub,prefecture,city,town,area,note,contact_email,contact_phone,contact_line_id,member_count,roster_by_grade"
            )
            .eq("id", teamId)
            .single();
        }

        if (res.error || !res.data) {
          console.error(res.error);
          setToast({
            type: "error",
            text: "チーム情報の読み込みに失敗しました",
          });
          setLoading(false);
          return;
        }

        const data: any = res.data;

        if (data.owner_id !== auth.user.id) {
          setToast({ type: "error", text: "このチームは編集できません" });
          setLoading(false);
          return;
        }

        setOwnerId(data.owner_id ?? "");
        setName(data.name ?? "");

        const loadedCategories: string[] =
          Array.isArray(data.categories) && data.categories.length > 0
            ? data.categories
            : data.category
            ? [data.category]
            : [];

        setCategories(loadedCategories);

        if (
          Array.isArray(data.category_profiles) &&
          data.category_profiles.length > 0
        ) {
          setCategoryProfiles(
            data.category_profiles.map((p: any) => ({
              category: p.category ?? "",
              strength_rank:
                (p.strength_rank as StrengthRank) ??
                legacyLevelToStrengthRank(data.level ?? 5),
              member_count: String(p.member_count ?? ""),
            }))
          );
        } else {
          const roster = data.roster_by_grade ?? {};
          const fallbackMemberCount = data.member_count ?? roster.TOTAL ?? null;

          setCategoryProfiles(
            loadedCategories.map((cat: string, index: number) => ({
              category: cat,
              strength_rank: legacyLevelToStrengthRank(data.level ?? 5),
              member_count:
                index === 0 && fallbackMemberCount != null
                  ? String(fallbackMemberCount)
                  : "",
            }))
          );
        }

        setHasGround(!!data.has_ground);

        setUniformMain(data.uniform_main ?? "");
        setUniformSub(data.uniform_sub ?? "");
        setUniformGk(data.uniform_gk ?? "");

        setPrefecture(data.prefecture ?? "東京都");
        setCity(data.city ?? "");
        setTown(data.town ?? "");

        setAddressDetail(data.address_detail ?? "");
        setNote(data.note ?? "");

        setContactEmail(data.contact_email ?? "");
        setContactPhone(data.contact_phone ?? "");
        setContactLineId(data.contact_line_id ?? "");

        setLoading(false);
      } catch (e) {
        console.error(e);
        setToast({
          type: "error",
          text: "チーム情報の読み込みに失敗しました",
        });
        setLoading(false);
      }
    })();
  }, [teamId, router]);

  const updateProfile = (
    category: string,
    patch: Partial<Omit<CategoryProfile, "category">>
  ) => {
    setCategoryProfiles((prev) =>
      prev.map((p) => (p.category === category ? { ...p, ...patch } : p))
    );
  };

  async function existsRow(table: string, column: string, value: string) {
    const res = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, value);

    if (res.error) throw res.error;
    return (res.count ?? 0) > 0;
  }

  async function canDeleteTeamSafely(targetTeamId: string) {
    const blockers: string[] = [];

    const checks = [
      {
        label: "募集枠",
        run: () => existsRow("match_slots", "host_team_id", targetTeamId),
      },
      {
        label: "試合申込",
        run: () => existsRow("match_requests", "requester_team_id", targetTeamId),
      },
      {
        label: "送った招待",
        run: () => existsRow("match_offers", "from_team_id", targetTeamId),
      },
      {
        label: "届いた招待",
        run: () => existsRow("match_offers", "to_team_id", targetTeamId),
      },
      {
        label: "チャット参加情報",
        run: () => existsRow("chat_members", "team_id", targetTeamId),
      },
      {
        label: "チャット送信履歴",
        run: () => existsRow("chat_messages", "sender_team_id", targetTeamId),
      },
    ];

    for (const check of checks) {
      try {
        const hit = await check.run();
        if (hit) blockers.push(check.label);
      } catch (e: any) {
        console.error(`delete-check failed: ${check.label}`, e);
        throw new Error(
          `削除前チェックに失敗しました（${check.label}）: ${e?.message ?? "unknown error"}`
        );
      }
    }

    return {
      ok: blockers.length === 0,
      blockers,
    };
  }

  const deleteTeam = async () => {
    if (!teamId) return;

    const { data: auth } = await supabase.auth.getUser();
    const meId = auth?.user?.id ?? "";

    if (!meId) {
      setToast({ type: "error", text: "ログインが必要です" });
      return;
    }

    if (ownerId && ownerId !== meId) {
      setToast({ type: "error", text: "自分のチームのみ削除できます" });
      return;
    }

    const ok = window.confirm(
      `「${name || "このチーム"}」を削除しますか？\n\n` +
        "安全のため、募集・申込・招待・チャット履歴などの関連データがあるチームは削除できません。"
    );
    if (!ok) return;

    setDeleting(true);
    setToast({ type: "info", text: "削除チェック中…" });

    try {
      const result = await canDeleteTeamSafely(teamId);

      if (!result.ok) {
        setToast({
          type: "error",
          text:
            "このチームはまだ削除できません。\n" +
            `関連データがあります: ${result.blockers.join(" / ")}`,
        });
        setDeleting(false);
        return;
      }

      setToast({ type: "info", text: "削除中…" });

      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId)
        .eq("owner_id", meId);

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `チーム削除失敗: ${error.message}` });
        setDeleting(false);
        return;
      }

      setToast({ type: "success", text: "✅ チームを削除しました" });
      router.push("/mypage");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setToast({
        type: "error",
        text: e?.message ?? "チーム削除に失敗しました",
      });
      setDeleting(false);
    }
  };

  const save = async () => {
    if (!canSave || !teamId) return;

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    try {
      const areaText = `${prefecture} ${city}${town ? "・" + town : ""}`;

      const normalizedProfiles = categories.map((category) => {
        const hit = categoryProfiles.find((p) => p.category === category);
        return {
          category,
          strength_rank: (hit?.strength_rank ?? "A") as StrengthRank,
          member_count: Math.max(0, Number(hit?.member_count || 0)),
        };
      });

      const totalMembers = normalizedProfiles.reduce(
        (sum, p) => sum + (Number(p.member_count) || 0),
        0
      );

      const firstProfile = normalizedProfiles[0];

      const basePayload: any = {
        name: name.trim(),
        category: primaryCategory || null,
        categories,
        category_profiles: normalizedProfiles,
        level: strengthRankToLegacyLevel(firstProfile?.strength_rank ?? "A"),
        strength_rank: firstProfile?.strength_rank ?? "A",
        has_ground: hasGround,
        uniform_main: uniformMain.trim() || "不明",
        uniform_sub: uniformSub.trim() || "不明",
        uniform_gk: uniformGk.trim() || "不明",
        member_count: totalMembers,
        roster_by_grade: { TOTAL: totalMembers },
        note: note || "",
        prefecture,
        city,
        town: town || null,
        area: areaText,
        address_detail: addressDetail.trim() || null,
      };

      const withContact: any = {
        ...basePayload,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_line_id: contactLineId.trim() || null,
      };

      let res = await supabase.from("teams").update(withContact).eq("id", teamId);

      if (res.error && isMissingColumnError(res.error)) {
        console.warn(
          "missing columns. retry without optional/multi-category fields:",
          res.error.message
        );

        const fallbackPayload: any = {
          name: name.trim(),
          category: primaryCategory || null,
          level: strengthRankToLegacyLevel(primaryStrengthRank),
          has_ground: hasGround,
          uniform_main: uniformMain.trim() || "不明",
          uniform_sub: uniformSub.trim() || "不明",
          note: note || "",
          prefecture,
          city,
          town: town || null,
          area: areaText,
        };

        res = await supabase.from("teams").update(fallbackPayload).eq("id", teamId);
      }

      if (res.error) {
        console.error(res.error);
        setToast({ type: "error", text: res.error.message });
        setSaving(false);
        return;
      }

      setToast({ type: "success", text: "✅ 更新しました" });
      setSaving(false);
      router.push("/mypage");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "保存に失敗しました" });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="sh-page-wrap" style={{ padding: 24 }}>
        読み込み中…
      </main>
    );
  }

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
        <div style={heroHeader}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>
              チーム編集
            </h1>
            <p style={heroText}>登録済みのチーム情報を更新できます。</p>
          </div>

          <div style={heroAction}>
            <Link href="/mypage" className="sh-btn">
              一覧へ
            </Link>
          </div>
        </div>
      </section>

      <section className="sh-section" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={infoNotice}>
            <div style={noticeTitle}>編集について</div>
            <div style={helperText}>
              ※ 1アカウントで複数チームを登録できます。<br />
              ※ 1チーム内で複数カテゴリを管理できます。<br />
              ※ カテゴリごとに強さと人数を設定できます。
            </div>
          </div>

          <label style={label}>
            <span style={labelTitle}>チーム名（必須）</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sh-input"
              disabled={saving || deleting}
              placeholder="例：三宿FC"
            />
          </label>

          <AreaPickerKanto
            disabled={saving || deleting}
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
              disabled={saving || deleting}
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
              title="カテゴリ（必須・複数選択可）"
              options={CATEGORY_OPTIONS}
              values={categories}
              onChange={setCategories}
              columns={3}
              disabled={saving || deleting}
              useChipUI={true}
            />
            <div style={{ marginTop: 8, ...helperText }}>
              選択中：
              {categories.length > 0
                ? ` ${categoryLabels(categories).join(" / ")}`
                : " 未選択"}
            </div>
          </div>

          {categories.length > 0 ? (
            <div style={subSection}>
              <div style={blockTitle}>カテゴリごとの設定</div>

              <div style={{ display: "grid", gap: 12 }}>
                {categories.map((category) => {
                  const profile = categoryProfiles.find((p) => p.category === category);

                  return (
                    <div key={category} style={profileCard}>
                      <div style={profileTitle}>{category}</div>

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
                            className="sh-select"
                            value={profile?.strength_rank ?? "A"}
                            disabled={saving || deleting}
                            onChange={(e) =>
                              updateProfile(category, {
                                strength_rank: e.target.value as StrengthRank,
                              })
                            }
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
                            type="number"
                            min={0}
                            inputMode="numeric"
                            className="sh-input"
                            value={profile?.member_count ?? ""}
                            disabled={saving || deleting}
                            placeholder="例：15"
                            onChange={(e) =>
                              updateProfile(category, {
                                member_count: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 8, ...helperText }}>
                合計人数：{totalMemberCount}人
              </div>
            </div>
          ) : null}

          <label style={{ ...checkLabel, opacity: saving || deleting ? 0.7 : 1 }}>
            <input
              type="checkbox"
              checked={hasGround}
              onChange={(e) => setHasGround(e.target.checked)}
              disabled={saving || deleting}
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
                disabled={saving || deleting}
                placeholder="例：青"
              />
            </label>

            <label style={label}>
              <span style={labelTitle}>ユニフォーム（サブ）</span>
              <input
                value={uniformSub}
                onChange={(e) => setUniformSub(e.target.value)}
                className="sh-input"
                disabled={saving || deleting}
                placeholder="例：白"
              />
            </label>

            <label style={label}>
              <span style={labelTitle}>ユニフォーム（GK）</span>
              <input
                value={uniformGk}
                onChange={(e) => setUniformGk(e.target.value)}
                className="sh-input"
                disabled={saving || deleting}
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
                  disabled={saving || deleting}
                  placeholder="example@mail.com"
                />
              </label>

              <label style={label}>
                <span style={labelTitle}>電話番号</span>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="sh-input"
                  disabled={saving || deleting}
                  placeholder="09012345678"
                />
              </label>

              <label style={label}>
                <span style={labelTitle}>LINE ID</span>
                <input
                  value={contactLineId}
                  onChange={(e) => setContactLineId(e.target.value)}
                  className="sh-input"
                  disabled={saving || deleting}
                  placeholder="line_id"
                />
              </label>
            </div>

            <div style={{ marginTop: 8, ...helperText }}>
              ※ 連絡先はこのチームごとに編集できます。<br />
              ※ DBに contact_email / contact_phone / contact_line_id が無い環境でも保存できるようにしています。<br />
              ※ DBに category_profiles / categories が無い環境では代表カテゴリのみ更新します。
            </div>
          </div>

          <label style={label}>
            <span style={labelTitle}>メモ（任意）</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="sh-textarea"
              style={{ minHeight: 100 }}
              disabled={saving || deleting}
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
              {saving ? "保存中..." : "更新"}
            </button>

            <button
              type="button"
              className="sh-btn"
              onClick={deleteTeam}
              disabled={saving || deleting}
              style={deleteBtn}
            >
              {deleting ? "削除中…" : "このチームを削除"}
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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const deleteBtn: React.CSSProperties = {
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff",
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

const heroHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
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
  border: "2px solid #6b8f71",
  background: "#fff",
  color: "#145c2a",
  fontWeight: 900,
  cursor: "pointer",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 1000,
  padding: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "85vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 20,
  padding: 18,
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

const heroAction: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginLeft: "auto",
};