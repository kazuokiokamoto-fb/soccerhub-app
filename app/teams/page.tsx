// app/teams/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { supabase } from "../lib/supabase";
import { Team } from "../lib/types";

type DbTeam = {
  id: string;
  owner_id: string;
  name: string;
  area: string;
  area_kana: string | null;
  category: string;
  level: number;
  has_ground: boolean;
  bike_parking: string;
  bike_parking_capacity?: string | null;
  uniform_main: string;
  uniform_sub: string;
  member_count?: number | null;
  roster_by_grade: Record<string, number> | null;
  desired_dates: string[] | null;
  note: string | null;
  updated_at: string;
};

type TeamRow = Team & {
  bikeParkingCapacity?: string | null;
  memberCount?: number | null;
};

function toTeam(row: DbTeam): TeamRow {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    category: row.category,
    level: row.level,
    hasGround: !!row.has_ground,
    bikeParking: row.bike_parking ?? "不明",
    bikeParkingCapacity: row.bike_parking_capacity ?? null,
    uniformMain: row.uniform_main ?? "不明",
    uniformSub: row.uniform_sub ?? "不明",
    memberCount: row.member_count ?? null,
    rosterByGrade: (row.roster_by_grade ??
      { G1: 0, G2: 0, G3: 0, G4: 0, G5: 0, G6: 0 }) as any,
    desiredDates: row.desired_dates ?? [],
    note: row.note ?? "",
    updatedAt: row.updated_at,
  };
}

type Toast = { type: "success" | "error" | "info"; text: string };

function formatAvailability(desiredDates?: string[]) {
  const arr = Array.isArray(desiredDates) ? desiredDates.filter(Boolean) : [];
  if (arr.length === 0) return "未登録";

  const pretty = arr.map((s) => {
    const t = String(s).trim();
    if (!t) return "";
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return `${parts[0]}（時間帯問わず）`;
    const day = parts[0];
    const slot = parts.slice(1).join(" ");
    return `${day}（${slot}）`;
  });

  return pretty.filter(Boolean).join(" / ") || "未登録";
}

function levelLabel(level: number) {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function formatBikeParking(
  bikeParking?: string | null,
  bikeParkingCapacity?: string | null
) {
  if (bikeParking === "あり") {
    if (bikeParkingCapacity && bikeParkingCapacity !== "不明") {
      return `あり（${bikeParkingCapacity}）`;
    }
    if (bikeParkingCapacity === "不明") {
      return "あり（台数不明）";
    }
    return "あり";
  }

  if (bikeParking === "なし") return "なし";
  return bikeParking || "不明";
}

function getMemberCount(team: TeamRow) {
  if (typeof team.memberCount === "number") return team.memberCount;

  const roster = (team.rosterByGrade ?? {}) as Record<string, number>;
  const total = Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
  return total;
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24, color: "#777" }}>読み込み中...</p>}>
      <TeamsPageInner />
    </Suspense>
  );
}

function TeamsPageInner() {
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created") || "";

  const [meId, setMeId] = useState<string>("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id ?? ""));
  }, []);

  useEffect(() => {
    if (!createdId) return;
    setToast({ type: "success", text: "✅ チームを登録しました（一覧に反映）" });
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [createdId]);

  const loadUnreadChats = async (uid: string) => {
    try {
      const { data: myTeamsRows, error: teamErr } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", uid);

      if (teamErr) {
        console.error(teamErr);
        setUnreadChatCount(0);
        return;
      }

      const myTeamIds = new Set<string>(
        (myTeamsRows ?? []).map((r: any) => r.id).filter(Boolean)
      );

      const { data: myMemberRows, error: cmErr } = await supabase
        .from("chat_members")
        .select("thread_id, last_read_at, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (cmErr) {
        console.error(cmErr);
        setUnreadChatCount(0);
        return;
      }

      const threadIds = Array.from(
        new Set((myMemberRows ?? []).map((r: any) => r.thread_id).filter(Boolean))
      );

      if (threadIds.length === 0) {
        setUnreadChatCount(0);
        return;
      }

      const myLastReadMap = new Map<string, string | null>();
      for (const r of myMemberRows ?? []) {
        if (!r.thread_id) continue;
        if (!myLastReadMap.has(r.thread_id)) {
          myLastReadMap.set(r.thread_id, (r as any).last_read_at ?? null);
        }
      }

      const { data: membersRows, error: membersErr } = await supabase
        .from("chat_members")
        .select("thread_id, team_id")
        .in("thread_id", threadIds);

      if (membersErr) {
        console.error(membersErr);
        setUnreadChatCount(0);
        return;
      }

      const memberTeamsByThread = new Map<string, string[]>();
      for (const r of membersRows ?? []) {
        const tid = (r as any).thread_id as string;
        const teamId = (r as any).team_id as string;
        if (!tid || !teamId) continue;
        if (!memberTeamsByThread.has(tid)) memberTeamsByThread.set(tid, []);
        memberTeamsByThread.get(tid)!.push(teamId);
      }

      const limit = Math.min(2000, Math.max(400, threadIds.length * 50));
      const { data: msgRows, error: msgErr } = await supabase
        .from("chat_messages")
        .select("thread_id, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (msgErr) {
        console.error(msgErr);
        setUnreadChatCount(0);
        return;
      }

      const lastMsgByThread = new Map<string, { created_at: string }>();
      for (const m of (msgRows ?? []) as any[]) {
        const tid = m.thread_id as string;
        if (!tid) continue;
        if (!lastMsgByThread.has(tid)) {
          lastMsgByThread.set(tid, { created_at: m.created_at });
        }
      }

      let unread = 0;

      for (const tid of threadIds) {
        const memberTeamIds = memberTeamsByThread.get(tid) ?? [];
        const hasOtherTeam = memberTeamIds.some((id) => !myTeamIds.has(id));
        if (!hasOtherTeam) continue;

        const last = lastMsgByThread.get(tid);
        const myLastReadAt = myLastReadMap.get(tid) ?? null;

        if (!last?.created_at) continue;

        let isUnread = false;
        if (!myLastReadAt) isUnread = true;
        else isUnread = new Date(last.created_at).getTime() > new Date(myLastReadAt).getTime();

        if (isUnread) unread += 1;
      }

      setUnreadChatCount(unread);
    } catch (e) {
      console.error(e);
      setUnreadChatCount(0);
    }
  };

  const load = async () => {
    setLoading(true);

    if (!meId) {
      setTeams([]);
      setUnreadChatCount(0);
      setLoading(false);
      return;
    }

    let rowsData: any[] | null = null;
    let rowsError: any = null;

    const firstRes = await supabase
      .from("teams")
      .select(
        "id,owner_id,name,area,area_kana,category,level,has_ground,bike_parking,bike_parking_capacity,uniform_main,uniform_sub,member_count,roster_by_grade,desired_dates,note,updated_at"
      )
      .eq("owner_id", meId)
      .order("area_kana", { ascending: true })
      .order("name", { ascending: true });

    if (!firstRes.error) {
      rowsData = firstRes.data as any[];
    } else {
      const fallbackRes = await supabase
        .from("teams")
        .select(
          "id,owner_id,name,area,area_kana,category,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at"
        )
        .eq("owner_id", meId)
        .order("area_kana", { ascending: true })
        .order("name", { ascending: true });

      rowsData = (fallbackRes.data ?? []) as any[];
      rowsError = fallbackRes.error;
    }

    if (rowsError) {
      console.error(rowsError);
      setToast({ type: "error", text: `読み込みに失敗しました: ${rowsError.message}` });
      setTeams([]);
      setLoading(false);
      return;
    }

    const rows = (rowsData ?? []) as DbTeam[];
    setTeams(rows.map((row) => toTeam(row)));

    await loadUnreadChats(meId);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const remove = async (id: string) => {
    const ok = confirm("削除しますか？（自分のチームのみ削除できます）");
    if (!ok) return;

    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) {
      console.error(error);
      setToast({
        type: "error",
        text: `削除に失敗しました: ${error.message}\n（RLSの権限設定が原因のことが多いです）`,
      });
      return;
    }
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setToast({ type: "success", text: "🗑 削除しました" });
  };

  const createdTeam = useMemo(() => teams.find((t) => t.id === createdId), [teams, createdId]);

  return (
    <main style={wrap}>
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
          <button type="button" onClick={() => setToast(null)} style={toastClose} aria-label="閉じる">
            ×
          </button>
        </div>
      ) : null}

      <section style={heroBox}>
        <h1 style={heroTitle}>⚙️ マイページ</h1>
        <p style={heroDesc}>
          自分が登録したチームの編集・削除、チャット確認ができます。
        </p>
      </section>

      <div style={topActionRow}>
        <Link
          href="/teams/new"
          className="sh-btn sh-btn--primary"
        >
          ＋チーム登録へ
        </Link>

        <Link href="/chat" className="sh-btn" style={chatLinkBtn}>
          <span>💬 チャット</span>
          {unreadChatCount > 0 ? (
            <span style={unreadBadge}>未読 {unreadChatCount}件</span>
          ) : (
            <span style={readBadge}>未読なし</span>
          )}
        </Link>
      </div>

      {!meId ? <div style={{ marginTop: 16, color: "#991b1b" }}>ログインが必要です。</div> : null}

      {createdId && createdTeam ? (
        <div style={{ ...miniInfo, marginTop: 12 }}>
          ✨ さっき登録したチーム： <b>{createdTeam.name}</b>（ハイライト中）
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {meId && teams.length === 0 ? (
            <p style={{ color: "#777" }}>まだチームがありません。登録してみてください。</p>
          ) : (
            teams.map((t) => {
              const isCreated = createdId && t.id === createdId;
              const rank = levelLabel(t.level);
              const memberCount = getMemberCount(t);
              const bikeParkingText = formatBikeParking(t.bikeParking, t.bikeParkingCapacity);

              return (
                <div
                  key={t.id}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    border: isCreated ? "2px solid #86efac" : "1px solid #e5e7eb",
                    background: isCreated ? "#f0fdf4" : "#ffffff",
                    boxShadow: isCreated
                      ? "0 0 0 4px rgba(34,197,94,0.10)"
                      : "0 4px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, fontSize: 20, color: "#16391f" }}>
                          {t.name} {isCreated ? "✅" : ""}
                        </div>

                        <span style={rankBadge}>{rank}</span>
                        <span style={categoryBadge}>{t.category}</span>
                      </div>

                      <div style={{ color: "#666", marginTop: 8, lineHeight: 1.8 }}>
                        📍 {t.area}
                        <br />
                        💪 強さ {rank} / 🏟 グラウンド {t.hasGround ? "あり" : "なし"} / 🚲 {bikeParkingText}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link className="sh-btn" href={`/teams/${t.id}/edit`}>
                        編集
                      </Link>
                      <button className="sh-btn sh-btn--danger" onClick={() => remove(t.id)} type="button">
                        削除
                      </button>
                    </div>
                  </div>

                  <div style={infoGrid}>
                    <div style={infoBox}>
                      <div style={infoLabel}>ユニフォーム</div>
                      <div style={infoValue}>
                        {t.uniformMain}（メイン） / {t.uniformSub}（サブ）
                      </div>
                    </div>

                    <div style={infoBox}>
                      <div style={infoLabel}>チーム所属人数</div>
                      <div style={infoValue}>{memberCount}人</div>
                    </div>

                    <div style={infoBox}>
                      <div style={infoLabel}>希望枠</div>
                      <div style={infoValue}>{formatAvailability(t.desiredDates)}</div>
                    </div>

                    {t.note ? (
                      <div style={infoBoxWide}>
                        <div style={infoLabel}>メモ</div>
                        <div style={infoValue}>{t.note}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

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
  color: "#ffffff",
};

const heroDesc: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  lineHeight: 1.7,
  color: "rgba(255,255,255,0.92)",
};

const topActionRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const chatLinkBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};

const unreadBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 12,
  fontWeight: 800,
};

const readBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 800,
};

const miniInfo: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #d6eadb",
  borderRadius: 12,
  background: "#fff",
  color: "#295233",
};

const rankBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 36,
  height: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#f5c542",
  color: "#3a2b00",
  fontWeight: 900,
  fontSize: 12,
};

const categoryBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#eef7f0",
  color: "#1f5d30",
  fontWeight: 800,
  fontSize: 12,
  border: "1px solid #d6eadb",
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const infoBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

const infoBoxWide: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

const infoLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const infoValue: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
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