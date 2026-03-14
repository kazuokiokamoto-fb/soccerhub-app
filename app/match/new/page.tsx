"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

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

function levelLabelFromValue(v: string) {
  if (v === "9") return "SS";
  if (v === "7") return "S";
  if (v === "5") return "A";
  if (v === "3") return "B";
  if (v === "1") return "C";
  return "指定なし";
}

function MatchCreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [meId, setMeId] = useState("");
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);

  const [slotDate, setSlotDate] = useState("");
  const [hostTeamId, setHostTeamId] = useState("");
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("15:00");
  const [slotArea, setSlotArea] = useState("");
  const [slotCategory, setSlotCategory] = useState("U-12");
  const [venueId, setVenueId] = useState("");
  const [wantedLevelMin, setWantedLevelMin] = useState("");
  const [wantedLevelMax, setWantedLevelMax] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const date = searchParams.get("date") ?? "";
    const hostTeamIdParam = searchParams.get("hostTeamId") ?? "";
    const areaParam = searchParams.get("area") ?? "";
    const categoryParam = searchParams.get("category") ?? "";

    if (date) setSlotDate(date);
    if (hostTeamIdParam) setHostTeamId(hostTeamIdParam);
    if (areaParam) setSlotArea(areaParam);
    if (categoryParam) setSlotCategory(categoryParam);
  }, [searchParams]);

  useEffect(() => {
    if (!hostTeamId && myTeams[0]?.id) {
      setHostTeamId(myTeams[0].id);
    }
  }, [myTeams, hostTeamId]);

  const selectedHostTeam = useMemo(() => {
    return myTeams.find((t) => t.id === hostTeamId) ?? null;
  }, [myTeams, hostTeamId]);

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

      if (!slotDate) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        setSlotDate(`${y}-${m}-${d}`);
      }

      if (!hostTeamId && teams[0]?.id) setHostTeamId(teams[0].id);
      if (!slotArea && teams[0]?.area) setSlotArea(teams[0].area ?? "");
      if (!slotCategory && teams[0]?.category) setSlotCategory(teams[0].category ?? "U-12");
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
      `${team?.prefecture ?? ""} ${team?.city ?? ""}${team?.town ? "・" + team.town : ""}`.trim();

    return fromTeam || (fallback ?? "").trim() || null;
  }

  const canSave = useMemo(() => {
    return !!slotDate && !!hostTeamId && !!startTime && !!endTime && !saving && !loading;
  }, [slotDate, hostTeamId, startTime, endTime, saving, loading]);

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
    if (wantedLevelMin && wantedLevelMax && Number(wantedLevelMin) > Number(wantedLevelMax)) {
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

      const payload = {
        owner_id: meId,
        host_team_id: hostTeamId,
        date: slotDate,
        start_time: startTime,
        end_time: endTime,
        venue_id: venueId || null,
        area: builtArea,
        area_text: builtArea,
        area_detail: null,
        category: slotCategory || hostTeam.category || "U-12",
        prefecture: hostTeam.prefecture ?? null,
        city: hostTeam.city ?? null,
        town: hostTeam.town ?? null,
        level_min: wantedLevelMin ? Number(wantedLevelMin) : null,
        level_max: wantedLevelMax ? Number(wantedLevelMax) : null,
        status: "open",
        is_closed: false,
      };

      const { error } = await supabase.from("match_slots").insert(payload);

      if (error) {
        console.error(error);
        alert(`募集作成に失敗しました: ${error.message}`);
        setSaving(false);
        return;
      }

      router.push(`/match?date=${slotDate}`);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "募集作成に失敗しました");
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>読み込み中…</main>;
  }

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <section style={heroBox}>
        <h1 style={heroTitle}>募集枠を作る</h1>
        <p style={heroDesc}>日付・時間・カテゴリ・希望相手の強さレンジを設定して募集を作成します。</p>
      </section>

      <section style={card}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span>日付</span>
            <input
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
              style={input}
              disabled={saving}
            />
          </label>

          <label style={label}>
            <span>ホストチーム</span>
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

          <div style={twoCols}>
            <label style={label}>
              <span>開始</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={input}
                disabled={saving}
              />
            </label>

            <label style={label}>
              <span>終了</span>
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
            <span>エリア</span>
            <input
              value={slotArea}
              onChange={(e) => setSlotArea(e.target.value)}
              style={input}
              placeholder="例：世田谷区 三宿"
              disabled={saving}
            />
          </label>

          <label style={label}>
            <span>カテゴリ</span>
            <select
              value={slotCategory}
              onChange={(e) => setSlotCategory(e.target.value)}
              style={input}
              disabled={saving}
            >
              <option value="U-10">U-10</option>
              <option value="U-11">U-11</option>
              <option value="U-12">U-12</option>
              <option value="U-15">U-15</option>
              <option value="社会人">社会人</option>
            </select>
          </label>

          <div style={twoCols}>
            <label style={label}>
              <span>希望相手の強さ（下限）</span>
              <select
                value={wantedLevelMin}
                onChange={(e) => setWantedLevelMin(e.target.value)}
                style={input}
                disabled={saving}
              >
                <option value="">指定なし</option>
                <option value="1">C</option>
                <option value="3">B</option>
                <option value="5">A</option>
                <option value="7">S</option>
                <option value="9">SS</option>
              </select>
            </label>

            <label style={label}>
              <span>希望相手の強さ（上限）</span>
              <select
                value={wantedLevelMax}
                onChange={(e) => setWantedLevelMax(e.target.value)}
                style={input}
                disabled={saving}
              >
                <option value="">指定なし</option>
                <option value="1">C</option>
                <option value="3">B</option>
                <option value="5">A</option>
                <option value="7">S</option>
                <option value="9">SS</option>
              </select>
            </label>
          </div>

          <div style={hintBox}>
            希望相手の強さ：下限 <b>{levelLabelFromValue(wantedLevelMin)}</b> / 上限{" "}
            <b>{levelLabelFromValue(wantedLevelMax)}</b>
          </div>

          <label style={label}>
            <span>グラウンド（任意）</span>
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
              {saving ? "作成中…" : "作成"}
            </button>
          </div>

          {selectedHostTeam ? (
            <div style={helperText}>
              ホストチーム: {selectedHostTeam.name ?? "未設定"}
              <br />
              エリア初期値: {selectedHostTeam.area ?? "未設定"}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function MatchCreatePage() {
  return (
    <Suspense fallback={<main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>読み込み中…</main>}>
      <MatchCreatePageInner />
    </Suspense>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 20,
  boxShadow: "0 10px 28px rgba(20,92,42,0.20)",
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
};

const heroDesc: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  lineHeight: 1.7,
  color: "rgba(255,255,255,0.92)",
};

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

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
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