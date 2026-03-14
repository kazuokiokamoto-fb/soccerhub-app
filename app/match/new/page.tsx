// app/match/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { AreaSelect } from "../components/AreaSelect";
import type { DbTeam, DbVenue } from "../types";

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

export default function MatchCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialDate = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);

  const [hostTeamId, setHostTeamId] = useState("");
  const [slotDate, setSlotDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("15:00");
  const [slotArea, setSlotArea] = useState("");
  const [slotCategory, setSlotCategory] = useState("U-12");
  const [venueId, setVenueId] = useState("");
  const [wantedLevelMin, setWantedLevelMin] = useState("");
  const [wantedLevelMax, setWantedLevelMax] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id || "";

        if (!uid) {
          alert("ログインが必要です");
          router.replace("/login");
          return;
        }

        const { data: teamRows } = await supabase
          .from("teams")
          .select(
            "id,owner_id,name,area,category,categories,prefecture,city,town,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,member_count,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at"
          )
          .eq("owner_id", uid)
          .order("updated_at", { ascending: false });

        const myTeamRows = (teamRows ?? []) as DbTeam[];
        setMyTeams(myTeamRows);

        const { data: venueRows } = await supabase
          .from("venues")
          .select("id,name,area,address,has_parking,has_bike_parking,note")
          .order("name", { ascending: true });

        setVenues((venueRows ?? []) as DbVenue[]);

        const firstTeam = myTeamRows[0] ?? null;
        if (firstTeam) {
          setHostTeamId(firstTeam.id);
          setSlotArea(firstTeam.area ?? "");
          setSlotCategory(firstTeam.category ?? "U-12");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const selectedHostTeam = useMemo(() => {
    return myTeams.find((t) => t.id === hostTeamId) ?? null;
  }, [myTeams, hostTeamId]);

  useEffect(() => {
    if (!selectedHostTeam) return;
    setSlotArea(selectedHostTeam.area ?? "");
    setSlotCategory(selectedHostTeam.category ?? "U-12");
  }, [selectedHostTeam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createSlot = async () => {
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
    if (
      wantedLevelMin &&
      wantedLevelMax &&
      Number(wantedLevelMin) > Number(wantedLevelMax)
    ) {
      alert("希望相手の強さは、下限が上限を超えないようにしてください");
      return;
    }

    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) {
      alert("ログインが必要です");
      return;
    }

    const hostTeam = myTeams.find((t) => t.id === hostTeamId);
    if (!hostTeam) {
      alert("ホストチームが見つかりません");
      return;
    }

    const builtArea = buildAreaText(hostTeam, slotArea);

    setSaving(true);
    try {
      const payload = {
        owner_id: uid,
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
        return;
      }

      router.push(`/match?created=1&date=${encodeURIComponent(slotDate)}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: 16, maxWidth: 760, margin: "0 auto" }}>
      <AppHero
        icon="📝"
        title="募集枠を作る"
        desc="日付・時間・カテゴリ・希望相手の強さを設定して募集を作成します。"
      />

      <AppTabNav />

      <section style={card}>
        {loading ? (
          <div style={{ color: "#666" }}>読み込み中…</div>
        ) : myTeams.length === 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: "#991b1b", fontWeight: 700 }}>
              先にチーム登録が必要です。
            </div>
            <div>
              <Link href="/teams/new" className="sh-btn sh-btn--primary">
                チーム登録へ
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={label}>
              <span>日付</span>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="sh-input"
                disabled={saving}
              />
            </label>

            <label style={label}>
              <span>ホストチーム</span>
              <select
                value={hostTeamId}
                onChange={(e) => setHostTeamId(e.target.value)}
                className="sh-select"
                disabled={saving}
              >
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
                  className="sh-input"
                  disabled={saving}
                />
              </label>

              <label style={label}>
                <span>終了</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="sh-input"
                  disabled={saving}
                />
              </label>
            </div>

            <div style={cardLite}>
              <AreaSelect
                label="エリア（23区→町名）"
                value={slotArea}
                onChange={setSlotArea}
                disabled={saving}
              />
              <p style={{ margin: "8px 0 0", color: "#777", fontSize: 12 }}>
                例：「世田谷区 三宿」のような形式で保存されます。
              </p>
            </div>

            <label style={label}>
              <span>カテゴリ</span>
              <select
                value={slotCategory}
                onChange={(e) => setSlotCategory(e.target.value)}
                className="sh-select"
                disabled={saving}
              >
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
                  className="sh-select"
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
                  className="sh-select"
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

            <label style={label}>
              <span>グラウンド（任意）</span>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="sh-select"
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
              <button
                className="sh-btn sh-btn--primary"
                type="button"
                onClick={createSlot}
                disabled={saving}
              >
                {saving ? "作成中…" : "作成"}
              </button>

              <Link href="/match" className="sh-btn">
                キャンセル
              </Link>
            </div>

            <p style={{ margin: 0, color: "#777", fontSize: 12 }}>
              ※ 募集時に、希望する相手の強さレンジも保存できます。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 14,
  background: "#fff",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const cardLite: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fafafa",
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