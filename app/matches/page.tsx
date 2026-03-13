"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type DbTeam = {
  id: string;
  owner_id: string | null;
  name: string | null;
  area: string | null;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  bike_parking_capacity?: string | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  member_count?: number | null;
  roster_by_grade?: Record<string, number> | null;
  desired_dates?: string[] | null;
  note: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
};

type DbVenue = {
  id: string;
  name: string | null;
  area: string | null;
  address: string | null;
};

type DbSlot = {
  id: string;
  owner_id: string;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  venue_id: string | null;
  area: string | null;
  category: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  is_closed?: boolean | null;
  created_at?: string | null;
};

type DbRequest = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | string;
  comment?: string | null;
  created_at: string;
};

type Toast = {
  type: "success" | "error" | "info";
  text: string;
};

function hhmm(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function levelLabel(level: number) {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function sumRoster(roster?: Record<string, number> | null) {
  if (!roster) return 0;
  return Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function formatDesiredDates(desiredDates?: string[] | null) {
  const arr = Array.isArray(desiredDates) ? desiredDates.filter(Boolean) : [];
  if (arr.length === 0) return "未登録";
  return arr.join(" / ");
}

function buildTeamArea(team?: DbTeam | null) {
  if (!team) return "未設定";
  const direct = (team.area ?? "").trim();
  if (direct) return direct;
  const composed = `${team.prefecture ?? ""} ${team.city ?? ""}${team.town ? "・" + team.town : ""}`.trim();
  return composed || "未設定";
}

function bikeText(team?: DbTeam | null) {
  if (!team) return "不明";
  if (team.bike_parking === "あり" && team.bike_parking_capacity) {
    return `あり（${team.bike_parking_capacity}）`;
  }
  return team.bike_parking ?? "不明";
}

export default function MatchesPage() {
  const [loading, setLoading] = useState(true);
  const [submittingSlotId, setSubmittingSlotId] = useState<string>("");
  const [toast, setToast] = useState<Toast | null>(null);

  const [meId, setMeId] = useState("");
  const [allTeams, setAllTeams] = useState<DbTeam[]>([]);
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [slots, setSlots] = useState<DbSlot[]>([]);
  const [requests, setRequests] = useState<DbRequest[]>([]);

  const [expandedId, setExpandedId] = useState<string>("");
  const [requestTeamId, setRequestTeamId] = useState<string>("");
  const [requestCommentBySlot, setRequestCommentBySlot] = useState<Record<string, string>>({});

  const [keyword, setKeyword] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [strengthFilter, setStrengthFilter] = useState("");
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">("all");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!requestTeamId && myTeams[0]?.id) {
      setRequestTeamId(myTeams[0].id);
    }
  }, [myTeams, requestTeamId]);

  async function load() {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id ?? "";
      setMeId(uid);

      const [{ data: teamRows }, { data: venueRows }, { data: slotRows }] = await Promise.all([
        supabase
          .from("teams")
          .select(
            "id,owner_id,name,area,category,categories,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,uniform_main,uniform_sub,member_count,roster_by_grade,desired_dates,note,prefecture,city,town"
          ),
        supabase
          .from("venues")
          .select("id,name,area,address")
          .order("name", { ascending: true }),
        supabase
          .from("match_slots")
          .select(
            "id,owner_id,host_team_id,date,start_time,end_time,venue_id,area,category,prefecture,city,town,is_closed,created_at"
          )
          .eq("is_closed", false)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

      const allTeamRows = (teamRows ?? []) as DbTeam[];
      const myTeamRows = allTeamRows.filter((t) => t.owner_id === uid);
      const openSlots = ((slotRows ?? []) as DbSlot[]).filter((s) => !s.is_closed);

      setAllTeams(allTeamRows);
      setMyTeams(myTeamRows);
      setVenues((venueRows ?? []) as DbVenue[]);
      setSlots(openSlots);

      if (openSlots.length > 0) {
        const slotIds = openSlots.map((s) => s.id);
        const { data: reqRows } = await supabase
          .from("match_requests")
          .select("id,slot_id,requester_team_id,requester_user_id,status,comment,created_at")
          .in("slot_id", slotIds)
          .order("created_at", { ascending: false });

        setRequests((reqRows ?? []) as DbRequest[]);
      } else {
        setRequests([]);
      }
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "読み込みに失敗しました" });
    } finally {
      setLoading(false);
    }
  }

  const teamMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t]));
  }, [allTeams]);

  const venueMap = useMemo(() => {
    return new Map(venues.map((v) => [v.id, v]));
  }, [venues]);

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      const team = teamMap.get(slot.host_team_id);

      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const hay = [
          slot.area,
          slot.category,
          slot.prefecture,
          slot.city,
          slot.town,
          team?.name,
          team?.area,
          team?.category,
          ...(team?.categories ?? []),
          team?.note,
          team?.uniform_main,
          team?.uniform_sub,
          team?.bike_parking,
          team?.bike_parking_capacity,
          team?.strength_rank,
          levelLabel(Number(team?.level ?? 0)),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      if (areaFilter.trim()) {
        const q = areaFilter.trim().toLowerCase();
        const areaHay = [
          slot.area,
          slot.prefecture,
          slot.city,
          slot.town,
          team?.area,
          team?.prefecture,
          team?.city,
          team?.town,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!areaHay.includes(q)) return false;
      }

      if (categoryFilter) {
        const cats =
          Array.isArray(team?.categories) && team?.categories.length > 0
            ? team?.categories
            : team?.category
            ? [team.category]
            : slot.category
            ? [slot.category]
            : [];

        if (!cats.includes(categoryFilter)) return false;
      }

      if (strengthFilter) {
        const rank = (team?.strength_rank ?? levelLabel(Number(team?.level ?? 0))) || "";
        if (rank !== strengthFilter) return false;
      }

      if (groundFilter !== "all") {
        const val = team?.has_ground ? "あり" : "なし";
        if (val !== groundFilter) return false;
      }

      const acceptedExists = requests.some(
        (r) => r.slot_id === slot.id && r.status === "accepted"
      );
      if (acceptedExists) return false;

      return true;
    });
  }, [slots, teamMap, requests, keyword, areaFilter, categoryFilter, strengthFilter, groundFilter]);

  async function getOrCreateDmThread(myTeamId: string, otherTeamId: string) {
    const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
      my_team_id: myTeamId,
      other_team_id: otherTeamId,
    });

    if (error) throw error;
    return data as string;
  }

  async function insertChatMessage(params: {
    threadId: string;
    senderId: string;
    senderTeamId: string | null;
    body: string;
  }) {
    const { threadId, senderId, senderTeamId, body } = params;

    const { error } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      sender_id: senderId,
      sender_team_id: senderTeamId,
      body,
    });

    if (error) throw error;
  }

  async function requestMatch(slotId: string) {
    try {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return;

      if (!meId) {
        alert("ログインが必要です");
        return;
      }

      if (!requestTeamId) {
        alert("申込みチームを選んでください");
        return;
      }

      const isMine = slot.owner_id === meId;
      if (isMine) {
        alert("自分の募集には申込みできません");
        return;
      }

      const myPending = requests.find(
        (r) =>
          r.slot_id === slotId &&
          r.requester_user_id === meId &&
          r.status !== "cancelled"
      );
      if (myPending) {
        alert("すでに申込み済みです");
        return;
      }

      const acceptedExists = requests.some(
        (r) => r.slot_id === slotId && r.status === "accepted"
      );
      if (acceptedExists) {
        alert("この募集はすでに成立済みです");
        return;
      }

      const requestComment = (requestCommentBySlot[slotId] ?? "").trim();

      const confirmText = requestComment
        ? `この内容で試合申込しますか？\n\nコメント:\n${requestComment}`
        : "この内容で試合申込しますか？";

      if (!window.confirm(confirmText)) return;

      setSubmittingSlotId(slotId);

      const payload = {
        slot_id: slotId,
        requester_team_id: requestTeamId,
        requester_user_id: meId,
        status: "pending" as const,
        comment: requestComment || null,
      };

      const { error } = await supabase.from("match_requests").insert(payload);

      if (error) {
        console.error(error);
        alert(`申込みに失敗しました: ${error.message}`);
        return;
      }

      const hostTeam = teamMap.get(slot.host_team_id);
      const requesterTeam = myTeams.find((t) => t.id === requestTeamId);

      try {
        const threadId = await getOrCreateDmThread(requestTeamId, slot.host_team_id);

        const bodyLines = [
          "【試合申込】",
          `${slot.date} ${hhmm(slot.start_time)}–${hhmm(slot.end_time)}`,
          `カテゴリ: ${slot.category ?? "未設定"}`,
          `エリア: ${slot.area ?? "未設定"}`,
          `申込チーム: ${requesterTeam?.name ?? "未設定"}`,
          `募集チーム: ${hostTeam?.name ?? "未設定"}`,
          requestComment ? `コメント: ${requestComment}` : "",
        ].filter(Boolean);

        await insertChatMessage({
          threadId,
          senderId: meId,
          senderTeamId: requestTeamId,
          body: bodyLines.join("\n"),
        });
      } catch (e) {
        console.error("chat relay failed:", e);
      }

      setRequestCommentBySlot((prev) => ({
        ...prev,
        [slotId]: "",
      }));
      setExpandedId(slotId);
      setToast({ type: "success", text: "✅ 試合申込しました" });
      await load();
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "申込みに失敗しました" });
    } finally {
      setSubmittingSlotId("");
    }
  }

  function clearFilters() {
    setKeyword("");
    setAreaFilter("");
    setCategoryFilter("");
    setStrengthFilter("");
    setGroundFilter("all");
  }

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
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
        <h1 style={heroTitle}>🏟 試合募集一覧</h1>
        <p style={heroDesc}>
          Airbnbのように一覧カードで、募集中の試合をまとめて探せます。
        </p>
      </section>

      <section style={filterWrap}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={filterGrid}>
            <label style={label}>
              <span style={labelTitle}>キーワード</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="sh-input"
                placeholder="例：三宿 / 世田谷 / U-12 / SS"
                disabled={loading}
              />
            </label>

            <label style={label}>
              <span style={labelTitle}>エリア</span>
              <input
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="sh-input"
                placeholder="例：世田谷 / 三宿 / 東京"
                disabled={loading}
              />
            </label>

            <label style={label}>
              <span style={labelTitle}>カテゴリ</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="sh-select"
                disabled={loading}
              >
                <option value="">指定なし</option>
                <option value="U-10">U-10</option>
                <option value="U-11">U-11</option>
                <option value="U-12">U-12</option>
                <option value="U-15">U-15</option>
                <option value="社会人">社会人</option>
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>強さ</span>
              <select
                value={strengthFilter}
                onChange={(e) => setStrengthFilter(e.target.value)}
                className="sh-select"
                disabled={loading}
              >
                <option value="">指定なし</option>
                <option value="SS">SS</option>
                <option value="S">S</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>グラウンド提供</span>
              <select
                value={groundFilter}
                onChange={(e) => setGroundFilter(e.target.value as "all" | "あり" | "なし")}
                className="sh-select"
                disabled={loading}
              >
                <option value="all">指定なし</option>
                <option value="あり">あり</option>
                <option value="なし">なし</option>
              </select>
            </label>
          </div>

          <div style={actionRow}>
            <button type="button" className="sh-btn" onClick={clearFilters} disabled={loading}>
              条件リセット
            </button>

            <Link href="/match" className="sh-btn">
              カレンダーで見る
            </Link>

            <div style={{ color: "#666", fontSize: 12 }}>
              ヒット件数：{filteredSlots.length}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p>
      ) : filteredSlots.length === 0 ? (
        <div style={emptyBox}>
          条件に合う募集中の試合がありません。
        </div>
      ) : (
        <div style={grid}>
          {filteredSlots.map((slot) => {
            const hostTeam = teamMap.get(slot.host_team_id) || null;
            const venue = slot.venue_id ? venueMap.get(slot.venue_id) || null : null;
            const rank = hostTeam?.strength_rank || levelLabel(Number(hostTeam?.level ?? 0));
            const memberCount =
              hostTeam?.member_count != null
                ? Number(hostTeam.member_count)
                : sumRoster(hostTeam?.roster_by_grade);

            const myReq = requests.find(
              (r) =>
                r.slot_id === slot.id &&
                r.requester_user_id === meId &&
                r.status !== "cancelled"
            );

            const isMine = !!meId && slot.owner_id === meId;
            const isExpanded = expandedId === slot.id;
            const requestComment = requestCommentBySlot[slot.id] ?? "";

            return (
              <div key={slot.id} style={card}>
                <div style={cardImageArea}>
                  <div style={dateBadge}>{slot.date}</div>
                  <div style={categoryBadge}>{slot.category || "カテゴリ未設定"}</div>
                </div>

                <div style={cardBody}>
                  <div style={rowTop}>
                    <div>
                      <div style={teamName}>{hostTeam?.name ?? "チーム未設定"}</div>
                      <div style={subLine}>
                        {hhmm(slot.start_time)}–{hhmm(slot.end_time)} / {slot.area || buildTeamArea(hostTeam)}
                      </div>
                    </div>

                    <div style={rankPill}>{rank}</div>
                  </div>

                  <div style={metaList}>
                    <div>🏟 グラウンド：{hostTeam?.has_ground ? "あり" : "なし"}</div>
                    <div>🚲 駐輪場：{bikeText(hostTeam)}</div>
                    <div>👥 所属人数：{memberCount || 0}人</div>
                    <div>
                      📍 会場：
                      {venue ? `${venue.name ?? "会場未設定"}${venue.area ? ` / ${venue.area}` : ""}` : "未設定"}
                    </div>
                  </div>

                  <div style={cardActionRow}>
                    <button
                      type="button"
                      className="sh-btn"
                      onClick={() => setExpandedId(isExpanded ? "" : slot.id)}
                    >
                      {isExpanded ? "閉じる" : "詳細"}
                    </button>

                    {!isMine ? (
                      <button
                        type="button"
                        className="sh-btn sh-btn--primary"
                        onClick={() => requestMatch(slot.id)}
                        disabled={!!myReq || submittingSlotId === slot.id || myTeams.length === 0}
                      >
                        {myReq ? "申込み済み" : submittingSlotId === slot.id ? "申込中…" : "試合申込"}
                      </button>
                    ) : (
                      <span style={mineText}>あなたの募集</span>
                    )}
                  </div>

                  {isExpanded ? (
                    <div style={detailBox}>
                      <div style={detailTitle}>募集詳細</div>

                      <div style={detailGrid}>
                        <div><b>チーム名：</b>{hostTeam?.name ?? "未設定"}</div>
                        <div><b>エリア：</b>{buildTeamArea(hostTeam)}</div>
                        <div>
                          <b>カテゴリ：</b>
                          {Array.isArray(hostTeam?.categories) && hostTeam.categories.length > 0
                            ? hostTeam.categories.join(" / ")
                            : hostTeam?.category || slot.category || "未設定"}
                        </div>
                        <div><b>強さ：</b>{rank}</div>
                        <div><b>ユニフォーム：</b>{hostTeam?.uniform_main ?? "不明"} / {hostTeam?.uniform_sub ?? "不明"}</div>
                        <div><b>希望枠：</b>{formatDesiredDates(hostTeam?.desired_dates)}</div>
                        <div><b>メモ：</b>{hostTeam?.note?.trim() || "なし"}</div>
                        <div><b>会場住所：</b>{venue?.address ?? "未設定"}</div>
                      </div>

                      {!isMine ? (
                        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                          <label style={label}>
                            <span style={labelTitle}>申込みチーム</span>
                            <select
                              value={requestTeamId}
                              onChange={(e) => setRequestTeamId(e.target.value)}
                              className="sh-select"
                              disabled={myTeams.length === 0 || !!myReq}
                            >
                              {myTeams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label style={label}>
                            <span style={labelTitle}>コメント（任意）</span>
                            <textarea
                              value={requestComment}
                              onChange={(e) =>
                                setRequestCommentBySlot((prev) => ({
                                  ...prev,
                                  [slot.id]: e.target.value,
                                }))
                              }
                              className="sh-textarea"
                              style={{ minHeight: 90 }}
                              placeholder="例：6年主体です。交流重視でぜひお願いします。"
                              disabled={!!myReq}
                            />
                          </label>

                          {myReq?.comment ? (
                            <div style={appliedCommentBox}>
                              <div style={appliedCommentTitle}>申込済みコメント</div>
                              <div style={appliedCommentBody}>{myReq.comment}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 18,
  boxShadow: "0 10px 28px rgba(20,92,42,0.16)",
  marginBottom: 12,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.3,
};

const heroDesc: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.7,
};

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 16,
  padding: 12,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fff",
};

const filterGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const grid: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
};

const card: React.CSSProperties = {
  borderRadius: 22,
  overflow: "hidden",
  border: "1px solid #e5e7eb",
  background: "#fff",
  boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
};

const cardImageArea: React.CSSProperties = {
  height: 160,
  background: "linear-gradient(135deg, #dff5e4 0%, #b7e4c7 100%)",
  position: "relative",
};

const dateBadge: React.CSSProperties = {
  position: "absolute",
  top: 14,
  left: 14,
  background: "#fff",
  color: "#145c2a",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
};

const categoryBadge: React.CSSProperties = {
  position: "absolute",
  bottom: 14,
  left: 14,
  background: "rgba(20,92,42,0.90)",
  color: "#fff",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
};

const cardBody: React.CSSProperties = {
  padding: 16,
};

const rowTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const teamName: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#1a2e20",
};

const subLine: React.CSSProperties = {
  marginTop: 6,
  color: "#666",
  lineHeight: 1.6,
};

const rankPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#f5c542",
  color: "#3a2b00",
  fontWeight: 900,
  fontSize: 12,
};

const metaList: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 6,
  color: "#374151",
  fontSize: 14,
  lineHeight: 1.7,
};

const cardActionRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const mineText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#166534",
};

const detailBox: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid #edf1ee",
  display: "grid",
  gap: 12,
};

const detailTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const detailGrid: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#2d3b31",
  lineHeight: 1.7,
  fontSize: 14,
};

const appliedCommentBox: React.CSSProperties = {
  border: "1px solid #dbe7df",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#f8fbf9",
};

const appliedCommentTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const appliedCommentBody: React.CSSProperties = {
  color: "#2d3b31",
  whiteSpace: "pre-wrap",
  lineHeight: 1.7,
};

const emptyBox: React.CSSProperties = {
  marginTop: 20,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fff",
  color: "#777",
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