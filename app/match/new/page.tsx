"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";
import AppHero from "@/app/components/AppHero";
import PageBackNav from "@/app/components/PageBackNav";
import { CATEGORY_OPTIONS, categoryLabel } from "@/app/lib/categories";

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

function levelLabelFromValue(v: string) {
  if (v === "9") return "SS";
  if (v === "7") return "S";
  if (v === "5") return "A";
  if (v === "3") return "B";
  if (v === "1") return "C";
  return "指定なし";
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

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const date = searchParams.get("date") ?? "";
    const hostTeamIdParam = searchParams.get("hostTeamId") ?? "";
    const areaParam = searchParams.get("area") ?? "";
    const categoryParam = searchParams.get("category") ?? "";
    const categoriesParam = searchParams.get("categories") ?? "";

    if (date) setSlotDate(date);
    if (hostTeamIdParam) setHostTeamId(hostTeamIdParam);
    if (areaParam) setSlotArea(areaParam);

    const incomingCategories = [
      ...categoriesParam
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      ...(categoryParam ? [categoryParam] : []),
    ];

    if (incomingCategories.length > 0) {
      setSlotCategories(Array.from(new Set(incomingCategories)));
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

    if (!slotArea && selectedHostTeam.area) {
      setSlotArea(selectedHostTeam.area);
    }

    if (slotCategories.length === 0) {
      const defaults = getDefaultCategories(selectedHostTeam);
      if (defaults.length > 0) {
        setSlotCategories(defaults);
      }
    }

    if (!newVenueArea) {
      const areaText =
        selectedHostTeam.area ||
        `${selectedHostTeam.prefecture ?? ""} ${selectedHostTeam.city ?? ""}${
          selectedHostTeam.town ? "・" + selectedHostTeam.town : ""
        }`.trim();
      if (areaText) setNewVenueArea(areaText);
    }
  }, [selectedHostTeam, slotArea, slotCategories.length, newVenueArea]);

  async function load() {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id ?? "";
      setMeId(uid);

      const [{ data: teamRows }, { data: venueRows }] = await Promise.all([
        supabase
          .from("teams")
          .select("id,owner_id,name,area,category,categories,prefecture,city,town")
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

      if (!hostTeamId && teams[0]?.id) {
        setHostTeamId(teams[0].id);
      }

      if (!slotArea && teams[0]?.area) {
        setSlotArea(teams[0].area ?? "");
      }

      if (slotCategories.length === 0) {
        const defaults = getDefaultCategories(teams[0]);
        if (defaults.length > 0) {
          setSlotCategories(defaults);
        }
      }
    } catch (e) {
      console.error(e);
      alert("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
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

    if (!name) return null;

    const { data, error } = await supabase
      .from("venues")
      .insert({
        name,
        area: area || null,
      })
      .select("id")
      .single();

    if (error) throw error;
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

  function openStrengthHelp() {
    alert(
      [
        "希望相手の強さについて",
        "",
        "下限：この強さ以上の相手を募集",
        "上限：この強さ以下の相手を募集",
        "",
        "例）",
        "下限 B / 上限 S",
        "→ B・A・S の相手を募集",
      ].join("\n")
    );
  }

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
        alert(`募集枠の作成に失敗しました: ${error.message}`);
        setSaving(false);
        return;
      }

      router.push(`/match?date=${slotDate}`);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "募集枠の作成に失敗しました");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
        読み込み中…
      </main>
    );
  }

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <AppTabNav />
      <PageBackNav current="募集枠を作る" />

      <AppHero
        icon="🗓️"
        title="募集枠を作る"
        desc="日付・時間・カテゴリ・希望相手の強さを設定して募集を作成します。"
      />

      <section style={card}>
        <div style={{ display: "grid", gap: 14 }}>
          <label style={label}>
            <span style={labelTitle}>日付</span>
            <input
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
              style={input}
              disabled={saving}
            />
          </label>

          <label style={label}>
            <span style={labelTitle}>ホストチーム</span>
            <select
              value={hostTeamId}
              onChange={(e) => setHostTeamId(e.target.value)}
              style={input}
              disabled={saving}
            >
              {myTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name ?? "チーム未設定"}
                </option>
              ))}
            </select>
          </label>

          <div style={responsiveTwoCols}>
            <label style={label}>
              <span style={labelTitle}>開始</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={input}
                disabled={saving}
              />
            </label>

            <label style={label}>
              <span style={labelTitle}>終了</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={input}
                disabled={saving}
              />
            </label>
          </div>

          <label style={label}>
            <span style={labelTitle}>エリア</span>
            <input
              value={slotArea}
              onChange={(e) => setSlotArea(e.target.value)}
              style={input}
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
                選択中: {slotCategories.map((v) => categoryLabel(v)).join(" / ")}
              </div>
            ) : (
              <div style={helperText}>
                カテゴリを1つ以上選択してください。
              </div>
            )}
          </div>

          <div style={responsiveTwoCols}>
            <label style={label}>
              <span style={labelTitleRow}>
                <button
                  type="button"
                  onClick={openStrengthHelp}
                  style={helpButton}
                  aria-label="希望相手の強さの説明"
                  title="希望相手の強さの説明"
                >
                  ?
                </button>
                <span style={labelTitleText}>希望相手の強さ（下限）</span>
              </span>

              <select
                value={wantedLevelMin}
                onChange={(e) => setWantedLevelMin(e.target.value)}
                style={input}
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
              <span style={labelTitleRow}>
                <span style={labelTitleText}>希望相手の強さ（上限）</span>
              </span>

              <select
                value={wantedLevelMax}
                onChange={(e) => setWantedLevelMax(e.target.value)}
                style={input}
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

          <div style={hintBox}>
            希望相手の強さ：下限 <b>{levelLabelFromValue(wantedLevelMin)}</b> /
            上限 <b>{levelLabelFromValue(wantedLevelMax)}</b>
          </div>

          <div style={sectionBox}>
            <div style={sectionTitle}>グラウンド</div>

            <div style={toggleRow}>
              <button
                type="button"
                onClick={() => setVenueMode("existing")}
                disabled={saving}
                style={{
                  ...modeButton,
                  ...(venueMode === "existing" ? modeButtonActive : null),
                }}
              >
                既存から選ぶ
              </button>

              <button
                type="button"
                onClick={() => setVenueMode("new")}
                disabled={saving}
                style={{
                  ...modeButton,
                  ...(venueMode === "new" ? modeButtonActive : null),
                }}
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
                  style={input}
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
              <div style={{ display: "grid", gap: 12 }}>
                <label style={label}>
                  <span style={labelTitle}>新規グラウンド名</span>
                  <input
                    value={newVenueName}
                    onChange={(e) => setNewVenueName(e.target.value)}
                    style={input}
                    placeholder="例：世田谷公園 サッカー場"
                    disabled={saving}
                  />
                </label>

                <label style={label}>
                  <span style={labelTitle}>新規グラウンドのエリア</span>
                  <input
                    value={newVenueArea}
                    onChange={(e) => setNewVenueArea(e.target.value)}
                    style={input}
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
            <Link href="/match" className="sh-btn">
              キャンセル
            </Link>

            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={createSlot}
              disabled={!canSave}
            >
              {saving ? "作成中…" : "募集枠を作成"}
            </button>
          </div>

          {selectedHostTeam ? (
            <div style={helperText}>
              ホストチーム: {selectedHostTeam.name ?? "未設定"}
              <br />
              エリア初期値: {selectedHostTeam.area ?? "未設定"}
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
  );
}

export default function MatchCreatePage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
          読み込み中…
        </main>
      }
    >
      <MatchCreatePageInner />
    </Suspense>
  );
}

const card: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #e5ece7",
  borderRadius: 20,
  background: "#fff",
  padding: 18,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
  fontSize: 16,
  lineHeight: 1.4,
};

const labelTitleRow: React.CSSProperties = {
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const labelTitleText: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
  fontSize: 16,
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

const helpButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid #b7dec0",
  background: "#eef9f1",
  color: "#1f7a37",
  fontWeight: 900,
  fontSize: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  minHeight: 52,
  fontSize: 16,
  boxSizing: "border-box",
  width: "100%",
};

const responsiveTwoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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

const hintBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  color: "#374151",
  fontSize: 14,
};

const sectionBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #edf1ee",
  background: "#fafcfb",
  display: "grid",
  gap: 10,
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
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#145c2a",
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

const modeButton: React.CSSProperties = {
  minHeight: 52,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#145c2a",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const modeButtonActive: React.CSSProperties = {
  background: "#145c2a",
  color: "#fff",
  border: "1px solid #145c2a",
};