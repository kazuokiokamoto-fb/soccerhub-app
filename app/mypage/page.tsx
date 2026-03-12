"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type ProfileRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  line_id: string | null;
  notify_email: boolean | null;
  notify_line: boolean | null;
};

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  area: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  has_ground?: boolean | null;
  bike_parking?: string | null;
  bike_parking_capacity?: string | null;
  member_count?: number | null;
  note?: string | null;
};

type SlotRow = {
  id: string;
  owner_id: string;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  category: string | null;
  area: string | null;
  is_closed: boolean;
};

type RequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment: string | null;
  created_at: string;
  updated_at?: string | null;
  slot?: SlotRow | null;
};

type Toast = { type: "success" | "error" | "info"; text: string };

function rankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function hhmm(v?: string | null) {
  return (v ?? "").slice(0, 5);
}

function jst(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function areaText(team?: TeamRow | null) {
  if (!team) return "未設定";
  const area = (team.area ?? "").trim();
  if (area) return area;
  const text = `${team.prefecture ?? ""} ${team.city ?? ""}${team.town ? "・" + team.town : ""}`.trim();
  return text || "未設定";
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "accepted":
      return "承認";
    case "rejected":
      return "却下";
    case "cancelled":
      return "キャンセル";
    case "pending":
    default:
      return "申込中";
  }
}

function statusStyle(status?: string | null): React.CSSProperties {
  if (status === "accepted") {
    return {
      background: "#ecfdf3",
      borderColor: "#bbf7d0",
      color: "#166534",
    };
  }
  if (status === "rejected") {
    return {
      background: "#fef2f2",
      borderColor: "#fecaca",
      color: "#991b1b",
    };
  }
  if (status === "cancelled") {
    return {
      background: "#f3f4f6",
      borderColor: "#e5e7eb",
      color: "#374151",
    };
  }
  return {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1e3a8a",
  };
}

export default function MyPage() {
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, TeamRow>>({});

  const [mySlots, setMySlots] = useState<SlotRow[]>([]);
  const [myRequests, setMyRequests] = useState<RequestRow[]>([]);
  const [requestsToMe, setRequestsToMe] = useState<RequestRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [toast, setToast] = useState<Toast | null>(null);

  const mainTeam = teams[0] ?? null;

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    setToast(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMe(null);
      setProfile(null);
      setTeams([]);
      setMySlots([]);
      setMyRequests([]);
      setRequestsToMe([]);
      setLoading(false);
      return;
    }

    setMe(user);

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("user_id,name,phone,line_id,notify_email,notify_line")
      .eq("user_id", user.id)
      .maybeSingle();

    setProfile((profileRow as ProfileRow | null) ?? null);

    const { data: myTeamsRows, error: teamsErr } = await supabase
      .from("teams")
      .select(
        "id,owner_id,name,category,categories,level,strength_rank,area,prefecture,city,town,has_ground,bike_parking,bike_parking_capacity,member_count,note"
      )
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (teamsErr) {
      console.error(teamsErr);
      setToast({ type: "error", text: `チーム読込失敗: ${teamsErr.message}` });
      setLoading(false);
      return;
    }

    const myTeams = ((myTeamsRows ?? []) as TeamRow[]) || [];
    setTeams(myTeams);

    const myTeamIds = myTeams.map((t) => t.id);

    const { data: slotRows, error: slotsErr } = await supabase
      .from("match_slots")
      .select("id,owner_id,host_team_id,date,start_time,end_time,category,area,is_closed")
      .eq("owner_id", user.id)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    if (slotsErr) {
      console.error(slotsErr);
      setToast({ type: "error", text: `募集読込失敗: ${slotsErr.message}` });
      setLoading(false);
      return;
    }

    const slots = (slotRows ?? []) as SlotRow[];
    setMySlots(slots);

    const slotIds = slots.map((s) => s.id);

    const { data: myReqRows, error: myReqErr } = await supabase
      .from("match_requests")
      .select("id,slot_id,requester_team_id,requester_user_id,status,comment,created_at,updated_at")
      .eq("requester_user_id", user.id)
      .order("created_at", { ascending: false });

    if (myReqErr) {
      console.error(myReqErr);
      setToast({ type: "error", text: `自分の申込読込失敗: ${myReqErr.message}` });
      setLoading(false);
      return;
    }

    const myReqBase = (myReqRows ?? []) as RequestRow[];
    const myReqSlotIds = Array.from(new Set(myReqBase.map((r) => r.slot_id).filter(Boolean)));

    let myReqSlotsMap = new Map<string, SlotRow>();
    if (myReqSlotIds.length > 0) {
      const { data: reqSlotRows, error: reqSlotErr } = await supabase
        .from("match_slots")
        .select("id,owner_id,host_team_id,date,start_time,end_time,category,area,is_closed")
        .in("id", myReqSlotIds);

      if (reqSlotErr) {
        console.error(reqSlotErr);
      } else {
        myReqSlotsMap = new Map(
          (((reqSlotRows ?? []) as SlotRow[]) || []).map((s) => [s.id, s])
        );
      }
    }

    const myReqs = myReqBase.map((r) => ({
      ...r,
      slot: myReqSlotsMap.get(r.slot_id) ?? null,
    }));
    setMyRequests(myReqs);

    let reqToMeBase: RequestRow[] = [];
    if (slotIds.length > 0) {
      const { data: reqToMeRows, error: reqToMeErr } = await supabase
        .from("match_requests")
        .select("id,slot_id,requester_team_id,requester_user_id,status,comment,created_at,updated_at")
        .in("slot_id", slotIds)
        .order("created_at", { ascending: false });

      if (reqToMeErr) {
        console.error(reqToMeErr);
        setToast({ type: "error", text: `オファー読込失敗: ${reqToMeErr.message}` });
        setLoading(false);
        return;
      }

      reqToMeBase = (reqToMeRows ?? []) as RequestRow[];
    }

    const mySlotMap = new Map(slots.map((s) => [s.id, s]));
    const reqsToMe = reqToMeBase.map((r) => ({
      ...r,
      slot: mySlotMap.get(r.slot_id) ?? null,
    }));
    setRequestsToMe(reqsToMe);

    const relatedTeamIds = Array.from(
      new Set([
        ...myTeamIds,
        ...slots.map((s) => s.host_team_id),
        ...myReqs.map((r) => r.requester_team_id),
        ...myReqs.map((r) => r.slot?.host_team_id ?? ""),
        ...reqsToMe.map((r) => r.requester_team_id),
      ].filter(Boolean))
    );

    let teamDict: Record<string, TeamRow> = {};
    if (relatedTeamIds.length > 0) {
      const { data: relatedTeamsRows } = await supabase
        .from("teams")
        .select(
          "id,owner_id,name,category,categories,level,strength_rank,area,prefecture,city,town,has_ground,bike_parking,bike_parking_capacity,member_count,note"
        )
        .in("id", relatedTeamIds);

      for (const t of ((relatedTeamsRows ?? []) as TeamRow[])) {
        teamDict[t.id] = t;
      }
    }

    setTeamMap(teamDict);
    setLoading(false);
  }

  async function getOrCreateDmThread(myTeamId: string, otherTeamId: string) {
    const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
      my_team_id: myTeamId,
      other_team_id: otherTeamId,
    });

    if (error) throw error;
    return data as string;
  }

  async function goChatWithTeam(otherTeamId: string) {
    try {
      const myTeamId = teams[0]?.id;
      if (!myTeamId) {
        alert("先にチーム登録をしてください");
        return;
      }
      if (!otherTeamId) {
        alert("相手チームが見つかりません");
        return;
      }

      const threadId = await getOrCreateDmThread(myTeamId, otherTeamId);
      window.location.href = `/chat/${threadId}`;
    } catch (e: any) {
      console.error(e);
      alert(`チャットを開けません: ${e?.message ?? "unknown error"}`);
    }
  }

  async function cancelRequest(id: string) {
    if (!confirm("申込をキャンセルしますか？")) return;

    setBusyId(id);

    const { error } = await supabase
      .from("match_requests")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast({ type: "error", text: `申込キャンセル失敗: ${error.message}` });
      setBusyId("");
      return;
    }

    setToast({ type: "success", text: "申込をキャンセルしました" });
    setBusyId("");
    await load();
  }

  async function closeSlot(id: string) {
    if (!confirm("募集を締め切りますか？")) return;

    setBusyId(id);

    const { error } = await supabase
      .from("match_slots")
      .update({ is_closed: true })
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast({ type: "error", text: `募集締切失敗: ${error.message}` });
      setBusyId("");
      return;
    }

    setToast({ type: "success", text: "募集を締め切りました" });
    setBusyId("");
    await load();
  }

  async function reopenSlot(id: string) {
    if (!confirm("募集を再開しますか？")) return;

    setBusyId(id);

    const { error } = await supabase
      .from("match_slots")
      .update({ is_closed: false })
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast({ type: "error", text: `募集再開失敗: ${error.message}` });
      setBusyId("");
      return;
    }

    setToast({ type: "success", text: "募集を再開しました" });
    setBusyId("");
    await load();
  }

  async function acceptRequest(id: string) {
    if (!confirm("この申込を承認しますか？")) return;

    setBusyId(id);

    const target = requestsToMe.find((r) => r.id === id);
    if (!target?.slot_id) {
      setToast({ type: "error", text: "対象の申込が見つかりません" });
      setBusyId("");
      return;
    }

    const { error: reqErr } = await supabase
      .from("match_requests")
      .update({ status: "accepted" })
      .eq("id", id);

    if (reqErr) {
      console.error(reqErr);
      setToast({ type: "error", text: `承認失敗: ${reqErr.message}` });
      setBusyId("");
      return;
    }

    await supabase
      .from("match_slots")
      .update({ is_closed: true })
      .eq("id", target.slot_id);

    setToast({ type: "success", text: "申込を承認しました" });
    setBusyId("");
    await load();
  }

  async function rejectRequest(id: string) {
    if (!confirm("この申込を却下しますか？")) return;

    setBusyId(id);

    const { error } = await supabase
      .from("match_requests")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast({ type: "error", text: `却下失敗: ${error.message}` });
      setBusyId("");
      return;
    }

    setToast({ type: "success", text: "申込を却下しました" });
    setBusyId("");
    await load();
  }

  const myRequestCards = useMemo(() => {
    return myRequests.map((r) => {
      const hostTeamId = r.slot?.host_team_id ?? "";
      const hostTeam = hostTeamId ? teamMap[hostTeamId] : null;
      return { ...r, hostTeam };
    });
  }, [myRequests, teamMap]);

  const requestsToMeCards = useMemo(() => {
    return requestsToMe.map((r) => {
      const requesterTeam = teamMap[r.requester_team_id] ?? null;
      return { ...r, requesterTeam };
    });
  }, [requestsToMe, teamMap]);

  if (loading) {
    return <main style={{ padding: 20 }}>Loading...</main>;
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
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
          アカウント情報、チーム情報、自分の募集、申込、届いたオファーを確認できます。
        </p>
      </section>

      {!me ? (
        <div style={{ marginTop: 16, color: "#991b1b" }}>ログインが必要です。</div>
      ) : null}

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>アカウント</h2>
        </div>

        <div style={infoGrid}>
          <div style={infoRow}><b>メール</b><span>{me?.email ?? "未設定"}</span></div>
          <div style={infoRow}><b>代表者氏名</b><span>{profile?.name ?? "未設定"}</span></div>
          <div style={infoRow}><b>電話番号</b><span>{profile?.phone ?? "未設定"}</span></div>
          <div style={infoRow}><b>LINE ID</b><span>{profile?.line_id ?? "未設定"}</span></div>
          <div style={infoRow}>
            <b>通知設定</b>
            <span>
              メール: {profile?.notify_email ? "ON" : "OFF"} / LINE: {profile?.notify_line ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>チーム</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/teams/new" className="sh-btn">＋チーム登録</Link>
            {mainTeam ? (
              <Link href={`/teams/${mainTeam.id}/edit`} className="sh-btn sh-btn--primary">
                チーム編集
              </Link>
            ) : null}
          </div>
        </div>

        {teams.length === 0 ? (
          <div style={{ color: "#666" }}>まだチーム登録がありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {teams.map((team) => (
              <div key={team.id} style={card}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{team.name}</div>
                <div style={{ color: "#555", marginTop: 8, lineHeight: 1.8 }}>
                  カテゴリ : {team.category || "未設定"}
                  <br />
                  強さ : {team.strength_rank || rankLabel(team.level)}
                  <br />
                  エリア : {areaText(team)}
                  <br />
                  グラウンド : {team.has_ground ? "あり" : "なし"} / 駐輪場 : {team.bike_parking ?? "不明"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>自分の募集</h2>
          <Link href="/match" className="sh-btn">募集ページへ</Link>
        </div>

        {mySlots.length === 0 ? (
          <div style={{ color: "#666" }}>まだ募集がありません。</div>
        ) : (
          mySlots.map((s) => (
            <div key={s.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <b>
                    {s.date} {hhmm(s.start_time)}-{hhmm(s.end_time)}
                  </b>
                  <div style={{ color: "#555", marginTop: 6 }}>
                    {s.area || "エリア未設定"} / {s.category || "カテゴリ未設定"}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    状態 :{" "}
                    <span style={badgeBase}>
                      {s.is_closed ? "締切" : "募集中"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {s.is_closed ? (
                    <button
                      className="sh-btn"
                      onClick={() => reopenSlot(s.id)}
                      disabled={busyId === s.id}
                      type="button"
                    >
                      募集再開
                    </button>
                  ) : (
                    <button
                      className="sh-btn"
                      onClick={() => closeSlot(s.id)}
                      disabled={busyId === s.id}
                      type="button"
                    >
                      募集締切
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>自分の試合申込</h2>
        </div>

        {myRequestCards.length === 0 ? (
          <div style={{ color: "#666" }}>まだ試合申込がありません。</div>
        ) : (
          myRequestCards.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <b>{r.hostTeam?.name ?? "相手チーム未設定"}</b>
                    <span style={{ ...badgeBase, ...statusStyle(r.status) }}>{statusLabel(r.status)}</span>
                  </div>

                  <div style={{ color: "#555", marginTop: 8, lineHeight: 1.8 }}>
                    日時 : {r.slot ? `${r.slot.date} ${hhmm(r.slot.start_time)}-${hhmm(r.slot.end_time)}` : "未取得"}
                    <br />
                    募集地 : {r.slot?.area ?? "未設定"}
                    <br />
                    作成日時 : {jst(r.created_at)}
                  </div>

                  {r.comment ? (
                    <div style={commentBox}>
                      <div style={commentTitle}>申込コメント</div>
                      <div style={commentBody}>{r.comment}</div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {r.hostTeam ? (
                    <button className="sh-btn" type="button" onClick={() => goChatWithTeam(r.hostTeam!.id)}>
                      チャット
                    </button>
                  ) : null}

                  {r.status === "pending" ? (
                    <button
                      className="sh-btn sh-btn--danger"
                      onClick={() => cancelRequest(r.id)}
                      disabled={busyId === r.id}
                      type="button"
                    >
                      申込キャンセル
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>自分の募集への申込</h2>
        </div>

        {requestsToMeCards.length === 0 ? (
          <div style={{ color: "#666" }}>まだオファーはありません。</div>
        ) : (
          requestsToMeCards.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <b>{r.requesterTeam?.name ?? "申込チーム未設定"}</b>
                    <span style={{ ...badgeBase, ...statusStyle(r.status) }}>{statusLabel(r.status)}</span>
                  </div>

                  <div style={{ color: "#555", marginTop: 8, lineHeight: 1.8 }}>
                    対象募集 : {r.slot ? `${r.slot.date} ${hhmm(r.slot.start_time)}-${hhmm(r.slot.end_time)}` : "未取得"}
                    <br />
                    募集地 : {r.slot?.area ?? "未設定"}
                    <br />
                    作成日時 : {jst(r.created_at)}
                  </div>

                  {r.comment ? (
                    <div style={commentBox}>
                      <div style={commentTitle}>相手コメント</div>
                      <div style={commentBody}>{r.comment}</div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {r.requesterTeam ? (
                    <button className="sh-btn" type="button" onClick={() => goChatWithTeam(r.requesterTeam!.id)}>
                      チャット
                    </button>
                  ) : null}

                  {r.status === "pending" ? (
                    <>
                      <button
                        className="sh-btn sh-btn--primary"
                        onClick={() => acceptRequest(r.id)}
                        disabled={busyId === r.id}
                        type="button"
                      >
                        承認
                      </button>
                      <button
                        className="sh-btn sh-btn--danger"
                        onClick={() => rejectRequest(r.id)}
                        disabled={busyId === r.id}
                        type="button"
                      >
                        却下
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
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
  marginBottom: 16,
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

const box: React.CSSProperties = {
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 14,
  marginBottom: 20,
  background: "#fff",
};

const sectionHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
};

const card: React.CSSProperties = {
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 12,
  marginTop: 10,
  background: "#fafafa",
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const infoRow: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#333",
};

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 800,
};

const commentBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fff",
};

const commentTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const commentBody: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
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