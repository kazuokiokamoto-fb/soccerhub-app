"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";
import AppHero from "@/app/components/AppHero";
import PageBackNav from "@/app/components/PageBackNav";
import { CATEGORY_OPTIONS, categoryLabel } from "@/app/lib/categories";
import { MatchHelpModals } from "@/app/match/components/MatchHelpModals";
import { STRENGTH_GUIDES } from "@/app/match/constants/strengthGuides";

type DbTeam = {
  id: string;
  owner_id: string | null;
  name: string | null;
  area: string | null;
  category: string | null;
  categories?: string[] | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
};

type DbVenue = {
  id: string;
  name: string | null;
  area: string | null;
};

function getTodayYmd() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultCategories(team?: DbTeam | null) {
  if (!team) return [] as string[];
  if (Array.isArray(team.categories) && team.categories.length > 0) {
    return team.categories.filter(Boolean);
  }
  if (team.category) return [team.category];
  return [];
}

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") && msg.includes("categories"))
  );
}

function buildAreaText(
  team?: {
    area?: string | null;
    prefecture?: string | null;
    city?: string | null;
    town?: string | null;
  } | null,
  fallback?: string
) {
  const fromTeam =
    (team?.area ?? "").trim() ||
    `${team?.prefecture ?? ""} ${team?.city ?? ""}${
      team?.town ? "・" + team.town : ""
    }`.trim();

  return fromTeam || (fallback ?? "").trim() || null;
}

function MatchCreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQueryDate = searchParams.get("date") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [meId, setMeId] = useState("");
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);

  const [slotDate, setSlotDate] = useState(initialQueryDate || getTodayYmd());
  const [hostTeamId, setHostTeamId] = useState("");
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("15:00");
  const [slotArea, setSlotArea] = useState("");
  const [slotCategories, setSlotCategories] = useState<string[]>([]);

  const [venueMode, setVenueMode] = useState<"existing" | "new">("existing");
  const [venueId, setVenueId] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueArea, setNewVenueArea] = useState("");

  const [wantedLevelMin, setWantedLevelMin] = useState("");
  const [wantedLevelMax, setWantedLevelMax] = useState("");
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const date = searchParams.get("date") ?? "";
    const hostTeamIdParam = searchParams.get("hostTeamId") ?? "";

    if (date) {
      setSlotDate(date);
    }

    if (hostTeamIdParam) {
      setHostTeamId(hostTeamIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!hostTeamId && myTeams[0]?.id) {
      setHostTeamId(myTeams[0].id);
    }
  }, [myTeams, hostTeamId]);

  const selectedHostTeam = useMemo(() => {
    return myTeams.find((t) => t.id === hostTeamId) ?? null;
  }, [myTeams, hostTeamId]);

  useEffect(() => {
    if (!selectedHostTeam) return;

    const nextArea = buildAreaText(selectedHostTeam, "") ?? "";

    setSlotArea(nextArea);
    setSlotCategories(getDefaultCategories(selectedHostTeam));
    setNewVenueArea(nextArea);

    if (venueMode === "existing") {
      setVenueId("");
    }
  }, [hostTeamId, selectedHostTeam, venueMode]);

  async function load() {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id ?? "";
      setMeId(uid);

      const [{ data: teamRows }, { data: venueRows }] = await Promise.all([
        supabase
          .from("teams")
          .select(
            "id,owner_id,name,area,category,categories,prefecture,city,town"
          )
          .eq("owner_id", uid)
          .order("updated_at", { ascending: false }),
        supabase
          .from("venues")
          .select("id,name,area")
          .order("name", { ascending: true }),
      ]);

      const teams = (teamRows ?? []) as DbTeam[];
      setMyTeams(teams);
      setVenues((venueRows ?? []) as DbVenue[]);

      setSlotDate((prev) => prev || initialQueryDate || getTodayYmd());

      if (teams[0]?.id && !hostTeamId) {
        setHostTeamId(teams[0].id);
      }
    } catch (e) {
      console.error(e);
      alert("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(value: string) {
    setSlotCategories((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      return [...prev, value];
    });
  }

  async function ensureVenueId(): Promise<string | null> {
    if (venueMode === "existing") {
      return venueId || null;
    }

    const name = newVenueName.trim();
    const area =
      newVenueArea.trim() ||
      slotArea.trim() ||
      buildAreaText(selectedHostTeam, slotArea) ||
      "";

    if (!name) {
      return null;
    }

    const { data, error } = await supabase
      .from("venues")
      .insert({
        name,
        area: area || null,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return (data as any)?.id ?? null;
  }

  const canSave = useMemo(() => {
    const categoryOk = slotCategories.length > 0;
    const venueOk =
      venueMode === "existing" ? true : newVenueName.trim().length > 0;

    return (
      !!slotDate &&
      !!hostTeamId &&
      !!startTime &&
      !!endTime &&
      categoryOk &&
      venueOk &&
      !saving &&
      !loading
    );
  }, [
    slotDate,
    hostTeamId,
    startTime,
    endTime,
    slotCategories,
    venueMode,
    newVenueName,
    saving,
    loading,
  ]);

  async function createSlot() {
    if (!slotDate) {
      alert("日付を入力してください");
      return;
    }
    if (!hostTeamId) {
      alert("ホストチームを選んでください");
      return;
    }
    if (!startTime || !endTime) {
      alert("開始時刻と終了時刻を入力してください");
      return;
    }
    if (startTime >= endTime) {
      alert("終了時刻は開始時刻より後にしてください");
      return;
    }
    if (slotCategories.length === 0) {
      alert("カテゴリを1つ以上選んでください");
      return;
    }
    if (
      wantedLevelMin &&
      wantedLevelMax &&
      Number(wantedLevelMin) > Number(wantedLevelMax)
    ) {
      alert("希望相手の強さは、下限が上限を超えないようにしてください");
      return;
    }
    if (!meId) {
      alert("ログインが必要です");
      return;
    }

    const hostTeam = myTeams.find((t) => t.id === hostTeamId);
    if (!hostTeam) {
      alert("ホストチームが見つかりません");
      return;
    }

    setSaving(true);

    try {
      const builtArea = buildAreaText(hostTeam, slotArea);
      const finalVenueId = await ensureVenueId();

      const basePayload: any = {
        owner_id: meId,
        host_team_id: hostTeamId,
        date: slotDate,
        start_time: startTime,
        end_time: endTime,
        venue_id: finalVenueId,
        area: builtArea,
        area_text: builtArea,
        area_detail: null,
        category: slotCategories[0] ?? null,
        categories: slotCategories,
        prefecture: hostTeam.prefecture ?? null,
        city: hostTeam.city ?? null,
        town: hostTeam.town ?? null,
        level_min: wantedLevelMin ? Number(wantedLevelMin) : null,
        level_max: wantedLevelMax ? Number(wantedLevelMax) : null,
        status: "open",
        is_closed: false,
      };

      let { error } = await supabase.from("match_slots").insert(basePayload);

      if (error && isMissingColumnError(error)) {
        const fallbackPayload = { ...basePayload };
        delete fallbackPayload.categories;

        const retry = await supabase.from("match_slots").insert(fallbackPayload);
        error = retry.error;
      }

      if (error) {
        console.error(error);
        alert(`募集の作成に失敗しました: ${error.message}`);
        setSaving(false);
        return;
      }

      router.push(`/match/my-schedule?date=${slotDate}`);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "募集の作成に失敗しました");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  if (loading) {
    return <main style={pageWrap}>読み込み中…</main>;
  }

  return (
    <>
      <main style={pageWrap}>
        <AppTabNav />

        <AppHero
          icon="🗓️"
          title="募集する"
          desc="日付・時間・カテゴリ・希望相手の強さを設定して募集を作成します。"
        />

        <section style={card}>
          <div style={formGrid}>
            
            <label style={label}>
              <span style={labelTitle}>ホストチーム</span>
              <select
                value={hostTeamId}
                onChange={(e) => setHostTeamId(e.target.value)}
                style={selectInput}
                disabled={saving}
              >
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? "チーム未設定"}
                  </option>
                ))}
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>日付</span>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                style={nativeInput}
                disabled={saving}
              />
            </label>

            
            <div style={stackCols}>
              <label style={label}>
                <span style={labelTitle}>開始</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={nativeInput}
                  disabled={saving}
                />
              </label>

              <label style={label}>
                <span style={labelTitle}>終了</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={nativeInput}
                  disabled={saving}
                />
              </label>
            </div>

            <label style={label}>
              <span style={labelTitle}>エリア</span>
              <input
                value={slotArea}
                onChange={(e) => setSlotArea(e.target.value)}
                style={textInput}
                placeholder="例：世田谷区 三宿"
                disabled={saving}
              />
            </label>

            <div style={sectionBox}>
              <div style={sectionTitle}>カテゴリ（複数選択可）</div>
              <div style={sectionSubText}>
                複数選択した場合は OR 条件で募集されます。
              </div>

              <div style={chipWrap}>
                {CATEGORY_OPTIONS.map((opt) => {
                  const active = slotCategories.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleCategory(opt.value)}
                      disabled={saving}
                      aria-pressed={active}
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

              {slotCategories.length > 0 ? (
                <div style={helperText}>
                  選択中:{" "}
                  {slotCategories.map((v) => categoryLabel(v)).join(" / ")}
                </div>
              ) : (
                <div style={helperText}>
                  カテゴリを1つ以上選択してください。
                </div>
              )}
            </div>

            <div style={sectionBox}>
              <div style={strengthTitleRow}>
                <div style={sectionTitle}>希望相手の強さ</div>
                <button
                  type="button"
                  onClick={() => setShowStrengthHelp(true)}
                  style={helpButton}
                  aria-label="希望相手の強さの説明"
                >
                  ?
                </button>
              </div>

              <div style={strengthGrid}>
                <label style={label}>
                  <span style={subLabelTitle}>下限</span>
                  <select
                    value={wantedLevelMin}
                    onChange={(e) => setWantedLevelMin(e.target.value)}
                    style={selectInput}
                    disabled={saving}
                  >
                    <option value="">指定なし</option>
                    <option value="9">SS</option>
                    <option value="7">S</option>
                    <option value="5">A</option>
                    <option value="3">B</option>
                    <option value="1">C</option>
                  </select>
                </label>

                <label style={label}>
                  <span style={subLabelTitle}>上限</span>
                  <select
                    value={wantedLevelMax}
                    onChange={(e) => setWantedLevelMax(e.target.value)}
                    style={selectInput}
                    disabled={saving}
                  >
                    <option value="">指定なし</option>
                    <option value="9">SS</option>
                    <option value="7">S</option>
                    <option value="5">A</option>
                    <option value="3">B</option>
                    <option value="1">C</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={sectionBox}>
              <div style={sectionTitle}>グラウンド</div>

              <div style={toggleRow}>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => setVenueMode("existing")}
                  disabled={saving}
                  style={venueMode === "existing" ? activeModeBtn : undefined}
                >
                  既存から選ぶ
                </button>

                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => setVenueMode("new")}
                  disabled={saving}
                  style={venueMode === "new" ? activeModeBtn : undefined}
                >
                  新しく登録する
                </button>
              </div>

              {venueMode === "existing" ? (
                <label style={label}>
                  <span style={labelTitle}>既存グラウンド</span>
                  <select
                    value={venueId}
                    onChange={(e) => setVenueId(e.target.value)}
                    style={selectInput}
                    disabled={saving}
                  >
                    <option value="">（未設定）</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.area ? ` / ${v.area}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div style={subGrid}>
                  <label style={label}>
                    <span style={labelTitle}>新規グラウンド名</span>
                    <input
                      value={newVenueName}
                      onChange={(e) => setNewVenueName(e.target.value)}
                      style={textInput}
                      placeholder="例：世田谷公園 サッカー場"
                      disabled={saving}
                    />
                  </label>

                  <label style={label}>
                    <span style={labelTitle}>新規グラウンドのエリア</span>
                    <input
                      value={newVenueArea}
                      onChange={(e) => setNewVenueArea(e.target.value)}
                      style={textInput}
                      placeholder="例：世田谷区 池尻"
                      disabled={saving}
                    />
                  </label>

                  <div style={helperText}>
                    作成時に venues に保存されるので、次回以降も候補に表示されます。
                  </div>
                </div>
              )}
            </div>

            <div style={actionRow}>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={createSlot}
                disabled={!canSave}
              >
                {saving ? "作成中…" : "募集する"}
              </button>

              <Link href="/" className="sh-btn">
                キャンセル
              </Link>
            </div>

            {selectedHostTeam ? (
              <div style={helperText}>
                ホストチーム: {selectedHostTeam.name ?? "未設定"}
                <br />
                エリア初期値:{" "}
                {buildAreaText(selectedHostTeam, "") || "未設定"}
                <br />
                カテゴリ初期値:{" "}
                {getDefaultCategories(selectedHostTeam)
                  .map((v) => categoryLabel(v))
                  .join(" / ") || "未設定"}
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <MatchHelpModals
        showStrengthHelp={showStrengthHelp}
        showCalendarHelp={false}
        onCloseStrengthHelp={() => setShowStrengthHelp(false)}
        onCloseCalendarHelp={() => {}}
        strengthGuides={STRENGTH_GUIDES}
      />
    </>
  );
}

export default function MatchCreatePage() {
  return (
    <Suspense fallback={<main style={pageWrap}>読み込み中…</main>}>
      <MatchCreatePageInner />
    </Suspense>
  );
}

const pageWrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gap: 14,
  width: "100%",
  minWidth: 0,
};

const card: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #e5ece7",
  borderRadius: 20,
  background: "#fff",
  padding: 18,
  boxSizing: "border-box",
  overflow: "hidden",
  width: "100%",
  minWidth: 0,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
  width: "100%",
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const subLabelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
  fontSize: 14,
};

const baseControl: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "block",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  fontSize: 16,
  lineHeight: 1.2,
  overflow: "hidden",
};

const textInput: React.CSSProperties = {
  ...baseControl,
  padding: "10px 12px",
};

const nativeInput: React.CSSProperties = {
  ...baseControl,
  padding: "10px 44px 10px 12px",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "textfield",
};

const selectInput: React.CSSProperties = {
  ...baseControl,
  padding: "10px 44px 10px 12px",
  appearance: "auto",
  WebkitAppearance: "menulist",
  MozAppearance: "menulist",
};

const stackCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  width: "100%",
  minWidth: 0,
};

const strengthGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  alignItems: "start",
  width: "100%",
  minWidth: 0,
};

const subGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.7,
};

const sectionBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #edf1ee",
  background: "#fafcfb",
  display: "grid",
  gap: 10,
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
  fontSize: 16,
};

const sectionSubText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.6,
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

const toggleRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const activeModeBtn: React.CSSProperties = {
  borderColor: "#145c2a",
  background: "#ecfdf3",
  color: "#166534",
};

const strengthTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const helpButton: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid #b7dcbf",
  background: "#f3fbf5",
  color: "#1f5d30",
  fontSize: 20,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};