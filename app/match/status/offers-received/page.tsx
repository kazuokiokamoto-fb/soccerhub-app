"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";
import AppHero from "@/app/components/AppHero";
import PageBackNav from "@/app/components/PageBackNav";
import { categoryLabel } from "@/app/lib/categories";

type Team = {
  id: string;
  name: string | null;
  category: string | null;
};

type Offer = {
  id: string;
  slot_id: string | null;
  from_user_id?: string | null;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
};

type MatchRequest = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment: string | null;
  created_at: string;
};

type SlotMini = {
  id: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  host_team_id?: string | null;
  is_closed?: boolean | null;
};

type ReceivedItem =
  | {
      kind: "offer";
      id: string;
      created_at: string;
      status: "pending" | "accepted" | "rejected" | "cancelled";
      from_team_id: string;
      to_team_id: string;
      slot_id: string | null;
      message: string | null;
    }
  | {
      kind: "request";
      id: string;
      created_at: string;
      status: "pending" | "accepted" | "rejected" | "cancelled";
      from_team_id: string;
      to_team_id: string;
      slot_id: string;
      message: string | null;
    };

export default function OfferReceivedPage() {
  const router = useRouter();

  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);

  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [teamMap, setTeamMap] = useState<Map<string, Team>>(new Map());
  const [slotMap, setSlotMap] = useState<Map<string, SlotMini>>(new Map());

  const [openId, setOpenId] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [chatOpeningId, setChatOpeningId] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  const loadPage = useCallback(async () => {
    if (!meId) return;

    setLoading(true);

    const { data: teams, error: teamsErr } = await supabase
      .from("teams")
      .select("id,name,category")
      .eq("owner_id", meId);

    if (teamsErr) {
      console.error(teamsErr);
      setMyTeams([]);
      setItems([]);
      setTeamMap(new Map());
      setSlotMap(new Map());
      setLoading(false);
      return;
    }

    const myTeamRows = (teams ?? []) as Team[];
    setMyTeams(myTeamRows);

    const myTeamIds = myTeamRows.map((t) => t.id).filter(Boolean);

    if (myTeamIds.length === 0) {
      setItems([]);
      setTeamMap(new Map());
      setSlotMap(new Map());
      setLoading(false);
      return;
    }

    const { data: mySlots, error: mySlotsErr } = await supabase
      .from("match_slots")
      .select(
        "id,date,start_time,end_time,area,area_text,category,host_team_id,is_closed"
      )
      .in("host_team_id", myTeamIds);

    if (mySlotsErr) {
      console.error(mySlotsErr);
    }

    const mySlotRows = (mySlots ?? []) as SlotMini[];
    const mySlotIds = mySlotRows.map((s) => s.id).filter(Boolean);

    const { data: offerRows, error: offersErr } = await supabase
      .from("match_offers")
      .select(
        "id,slot_id,from_user_id,from_team_id,to_team_id,status,message,created_at"
      )
      .in("to_team_id", myTeamIds)
      .order("created_at", { ascending: false });

    if (offersErr) {
      console.error(offersErr);
    }

    let requestRows: MatchRequest[] = [];
    if (mySlotIds.length > 0) {
      const { data: requests, error: requestsErr } = await supabase
        .from("match_requests")
        .select(
          "id,slot_id,requester_team_id,requester_user_id,status,comment,created_at"
        )
        .in("slot_id", mySlotIds)
        .order("created_at", { ascending: false });

      if (requestsErr) {
        console.error(requestsErr);
      } else {
        requestRows = (requests ?? []) as MatchRequest[];
      }
    }

    const offerItems: ReceivedItem[] = ((offerRows ?? []) as Offer[]).map((o) => ({
      kind: "offer",
      id: o.id,
      created_at: o.created_at,
      status: o.status,
      from_team_id: o.from_team_id,
      to_team_id: o.to_team_id,
      slot_id: o.slot_id,
      message: o.message,
    }));

    const requestItems: ReceivedItem[] = requestRows.map((r) => {
      const slot = mySlotRows.find((s) => s.id === r.slot_id);
      return {
        kind: "request",
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        from_team_id: r.requester_team_id,
        to_team_id: slot?.host_team_id ?? "",
        slot_id: r.slot_id,
        message: r.comment,
      };
    });

    const merged = [...offerItems, ...requestItems].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setItems(merged);

    const relatedTeamIds = Array.from(
      new Set(
        merged.flatMap((x) => [x.from_team_id, x.to_team_id]).filter(Boolean)
      )
    );

    if (relatedTeamIds.length > 0) {
      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select("id,name,category")
        .in("id", relatedTeamIds);

      if (teamErr) {
        console.error(teamErr);
        setTeamMap(new Map());
      } else {
        const map = new Map<string, Team>();
        ((teamRows ?? []) as Team[]).forEach((t) => map.set(t.id, t));
        setTeamMap(map);
      }
    } else {
      setTeamMap(new Map());
    }

    const slotIds = Array.from(
      new Set(merged.map((x) => x.slot_id).filter(Boolean) as string[])
    );

    if (slotIds.length > 0) {
      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select(
          "id,date,start_time,end_time,area,area_text,category,host_team_id,is_closed"
        )
        .in("id", slotIds);

      if (slotErr) {
        console.error(slotErr);
        setSlotMap(new Map());
      } else {
        const map = new Map<string, SlotMini>();
        ((slotRows ?? []) as SlotMini[]).forEach((s) => map.set(s.id, s));
        setSlotMap(map);
      }
    } else {
      setSlotMap(new Map());
    }

    setLoading(false);
  }, [meId]);

  useEffect(() => {
    if (!meId) return;
    loadPage();
  }, [meId, loadPage]);

  useEffect(() => {
    if (!meId) return;

    const channel = supabase
      .channel(`offers-received:${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_offers" },
        () => {
          loadPage();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_requests" },
        () => {
          loadPage();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_slots" },
        () => {
          loadPage();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => {
          loadPage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, loadPage]);

  const counts = useMemo(() => {
    return {
      pending: items.filter((o) => o.status === "pending").length,
      accepted: items.filter((o) => o.status === "accepted").length,
      rejected: items.filter((o) => o.status === "rejected").length,
      cancelled: items.filter((o) => o.status === "cancelled").length,
    };
  }, [items]);

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

  async function openChat(item: ReceivedItem) {
    const rowId = `${item.kind}:${item.id}`;
    setChatOpeningId(rowId);

    try {
      const threadId = await getOrCreateDmThread(
        item.to_team_id,
        item.from_team_id
      );
      router.push(`/chat/${threadId}`);
    } catch (e: any) {
      console.error(e);
      alert(`チャットを開けません: ${e?.message ?? "unknown error"}`);
    } finally {
      setChatOpeningId("");
    }
  }

  const updateStatus = async (
    item: ReceivedItem,
    nextStatus: "accepted" | "rejected"
  ) => {
    const confirmText =
      nextStatus === "accepted"
        ? "このオファーを承認しますか？"
        : "このオファーを見送りますか？";

    if (!window.confirm(confirmText)) return;

    const rowId = `${item.kind}:${item.id}`;
    setUpdatingId(rowId);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        alert("ログインが必要です");
        setUpdatingId("");
        return;
      }

      const slot = item.slot_id ? slotMap.get(item.slot_id) : null;
      const fromTeam = teamMap.get(item.from_team_id);
      const toTeam = teamMap.get(item.to_team_id);

      if (item.kind === "offer") {
        const { error } = await supabase
          .from("match_offers")
          .update({ status: nextStatus })
          .eq("id", item.id);

        if (error) {
          console.error(error);
          alert(
            nextStatus === "accepted"
              ? `承認に失敗しました: ${error.message}`
              : `見送りに失敗しました: ${error.message}`
          );
          setUpdatingId("");
          return;
        }

        if (nextStatus === "accepted" && item.slot_id) {
          await supabase
            .from("match_slots")
            .update({ is_closed: true })
            .eq("id", item.slot_id);
        }

        if (nextStatus === "accepted") {
          const threadId = await getOrCreateDmThread(
            item.to_team_id,
            item.from_team_id
          );

          const body = [
            "【試合オファー 承認】",
            slot
              ? `${slot.date || "日付未設定"} ${
                  slot.start_time ? String(slot.start_time).slice(0, 5) : ""
                }${
                  slot.end_time ? `-${String(slot.end_time).slice(0, 5)}` : ""
                }`
              : "",
            slot
              ? `カテゴリ: ${categoryLabel(slot.category) || slot.category || "未設定"}`
              : "",
            slot ? `エリア: ${slot.area_text ?? slot.area ?? "未設定"}` : "",
            `募集チーム: ${toTeam?.name ?? "自チーム"}`,
            `相手チーム: ${fromTeam?.name ?? "相手チーム"}`,
            "オファーを承認しました。詳細はこのチャットで調整してください。",
          ]
            .filter(Boolean)
            .join("\n");

          await insertChatMessage({
            threadId,
            senderId: uid,
            senderTeamId: item.to_team_id,
            body,
          });

          router.push(`/chat/${threadId}`);
          return;
        }
      } else {
        const { error } = await supabase
          .from("match_requests")
          .update({ status: nextStatus })
          .eq("id", item.id);

        if (error) {
          console.error(error);
          alert(
            nextStatus === "accepted"
              ? `承認に失敗しました: ${error.message}`
              : `見送りに失敗しました: ${error.message}`
          );
          setUpdatingId("");
          return;
        }

        if (nextStatus === "accepted" && item.slot_id) {
          await supabase
            .from("match_slots")
            .update({ is_closed: true })
            .eq("id", item.slot_id);
        }

        if (nextStatus === "accepted") {
          const threadId = await getOrCreateDmThread(
            item.to_team_id,
            item.from_team_id
          );

          const body = [
            "【試合申込 承認】",
            slot
              ? `${slot.date || "日付未設定"} ${
                  slot.start_time ? String(slot.start_time).slice(0, 5) : ""
                }${
                  slot.end_time ? `-${String(slot.end_time).slice(0, 5)}` : ""
                }`
              : "",
            slot
              ? `カテゴリ: ${categoryLabel(slot.category) || slot.category || "未設定"}`
              : "",
            slot ? `エリア: ${slot.area_text ?? slot.area ?? "未設定"}` : "",
            `申込チーム: ${fromTeam?.name ?? "相手チーム"}`,
            `募集チーム: ${toTeam?.name ?? "自チーム"}`,
            "申込みを承認しました。詳細はこのチャットで調整してください。",
          ]
            .filter(Boolean)
            .join("\n");

          await insertChatMessage({
            threadId,
            senderId: uid,
            senderTeamId: item.to_team_id,
            body,
          });

          router.push(`/chat/${threadId}`);
          return;
        }
      }

      setItems((prev) =>
        prev.map((x) =>
          x.kind === item.kind && x.id === item.id
            ? { ...x, status: nextStatus }
            : x
        )
      );

      await loadPage();
      setUpdatingId("");
    } catch (e: any) {
      console.error(e);
      alert(
        nextStatus === "accepted"
          ? `承認に失敗しました: ${e?.message ?? "unknown error"}`
          : `見送りに失敗しました: ${e?.message ?? "unknown error"}`
      );
      setUpdatingId("");
    }
  };

  return (
    <main style={wrap}>
      <AppTabNav />
      <PageBackNav current="届いたオファー" />

      <AppHero
        icon="📥"
        title="届いたオファー"
        desc="相手から届いた招待と、自分の募集に対する申込み一覧です。"
      />

      <div style={summary}>
        <Stat label="未対応" value={counts.pending} />
        <Stat label="承認" value={counts.accepted} />
        <Stat label="見送り" value={counts.rejected} />
        <Stat label="取消" value={counts.cancelled} />
      </div>

      {loading ? <div style={infoText}>読み込み中…</div> : null}

      {!loading && myTeams.length === 0 ? (
        <div style={empty}>自分のチームがまだ登録されていません</div>
      ) : null}

      {!loading && myTeams.length > 0 && items.length === 0 ? (
        <div style={empty}>届いたオファーはまだありません</div>
      ) : null}

      <div style={list}>
        {items.map((item) => {
          const fromTeam = teamMap.get(item.from_team_id);
          const toTeam = teamMap.get(item.to_team_id);
          const slot = item.slot_id ? slotMap.get(item.slot_id) : null;
          const rowId = `${item.kind}:${item.id}`;
          const expanded = openId === rowId;
          const isPending = item.status === "pending";
          const busy = updatingId === rowId;
          const chatBusy = chatOpeningId === rowId;

          return (
            <div key={rowId} style={card}>
              <div style={titleRow}>
                <div>
                  <div style={teamName}>{fromTeam?.name ?? "相手チーム"}</div>
                  <div style={subText}>
                    {item.kind === "offer" ? "招待" : "申込み"}
                    {" / "}
                    宛先：{toTeam?.name ?? "自チーム"}
                    {fromTeam?.category
                      ? ` / ${categoryLabel(fromTeam.category) || fromTeam.category}`
                      : ""}
                  </div>
                </div>

                <span style={badge(item.status)}>{label(item.status)}</span>
              </div>

              <div style={meta}>受信日時：{fmt(item.created_at)}</div>

              {slot ? (
                <div style={slotBox}>
                  <div style={slotTitle}>関連募集</div>
                  <div style={slotText}>
                    {slot.date || "日付未設定"}{" "}
                    {slot.start_time ? String(slot.start_time).slice(0, 5) : ""}
                    {slot.end_time
                      ? ` - ${String(slot.end_time).slice(0, 5)}`
                      : ""}
                  </div>
                  <div style={slotSub}>
                    {slot.area_text ?? slot.area ?? "エリア未設定"}
                    {" / "}
                    {slot.category ?? "カテゴリ未設定"}
                  </div>
                </div>
              ) : null}

              <div style={btnRow}>
                <button
                  className="sh-btn"
                  type="button"
                  onClick={() => setOpenId(expanded ? "" : rowId)}
                >
                  {expanded ? "閉じる" : "詳細"}
                </button>

                <Link
                  href={`/teams/${item.from_team_id}?threadId=${
                    encodeURIComponent(`${item.to_team_id}:${item.from_team_id}`)
                  }`}
                  className="sh-btn"
                >
                  チーム詳細
                </Link>

                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={() => openChat(item)}
                  disabled={chatBusy}
                >
                  {chatBusy ? "移動中…" : "チャット"}
                </button>

                {isPending ? (
                  <>
                    <button
                      className="sh-btn sh-btn--primary"
                      type="button"
                      onClick={() => updateStatus(item, "accepted")}
                      disabled={busy}
                    >
                      {busy ? "更新中…" : "承認"}
                    </button>

                    <button
                      className="sh-btn"
                      type="button"
                      onClick={() => updateStatus(item, "rejected")}
                      disabled={busy}
                    >
                      {busy ? "更新中…" : "見送り"}
                    </button>
                  </>
                ) : null}
              </div>

              {expanded ? (
                <div style={detail}>
                  <div style={detailBlock}>
                    <div style={detailLabel}>種別</div>
                    <div style={detailValue}>
                      {item.kind === "offer" ? "招待" : "申込み"}
                    </div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>送信チーム</div>
                    <div style={detailValue}>
                      {fromTeam?.name ?? "相手チーム"}
                      {fromTeam?.category
                        ? `（${categoryLabel(fromTeam.category) || fromTeam.category}）`
                        : ""}
                    </div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>受信チーム</div>
                    <div style={detailValue}>
                      {toTeam?.name ?? "自チーム"}
                      {toTeam?.category
                        ? `（${categoryLabel(toTeam.category) || toTeam.category}）`
                        : ""}
                    </div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>
                      {item.kind === "offer" ? "メッセージ" : "コメント"}
                    </div>
                    <div style={detailValue}>{item.message || "なし"}</div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>受信日時</div>
                    <div style={detailValue}>{fmt(item.created_at)}</div>
                  </div>

                  {slot ? (
                    <div style={detailBlock}>
                      <div style={detailLabel}>関連募集</div>
                      <div style={detailValue}>
                        {slot.date || "日付未設定"}{" "}
                        {slot.start_time
                          ? String(slot.start_time).slice(0, 5)
                          : ""}
                        {slot.end_time
                          ? ` - ${String(slot.end_time).slice(0, 5)}`
                          : ""}
                        <br />
                        {slot.area_text ?? slot.area ?? "エリア未設定"}
                        {" / "}
                        {slot.category ?? "カテゴリ未設定"}
                      </div>
                    </div>
                  ) : item.slot_id ? (
                    <div style={detailBlock}>
                      <div style={detailLabel}>関連募集ID</div>
                      <div style={detailValue}>{item.slot_id}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function label(s: string) {
  switch (s) {
    case "pending":
      return "未対応";
    case "accepted":
      return "承認";
    case "rejected":
      return "見送り";
    case "cancelled":
      return "取消";
    default:
      return s;
  }
}

function badge(s: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  if (s === "pending")
    return { ...base, background: "#fef3c7", color: "#92400e" };
  if (s === "accepted")
    return { ...base, background: "#dcfce7", color: "#166534" };
  if (s === "rejected")
    return { ...base, background: "#fee2e2", color: "#991b1b" };
  return { ...base, background: "#eee", color: "#444" };
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString("ja-JP");
  } catch {
    return dt;
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statBox}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const summary: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
  marginTop: 12,
};

const statBox: React.CSSProperties = {
  background: "#fff",
  padding: 10,
  borderRadius: 12,
  border: "1px solid #e5ece7",
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#5b6d61",
  fontWeight: 800,
};

const statValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#145c2a",
  marginTop: 4,
};

const infoText: React.CSSProperties = {
  marginTop: 16,
  color: "#666",
};

const list: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const titleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const teamName: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

const subText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#666",
  lineHeight: 1.6,
};

const meta: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginTop: 8,
};

const slotBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  border: "1px solid #edf1ee",
  background: "#fafcfb",
};

const slotTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
};

const slotText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 14,
  fontWeight: 800,
  color: "#16391f",
  lineHeight: 1.6,
};

const slotSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#666",
  lineHeight: 1.6,
};

const btnRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const detail: React.CSSProperties = {
  marginTop: 12,
  background: "#fafafa",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #edf1ee",
  display: "grid",
  gap: 12,
};

const detailBlock: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const detailLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
};

const detailValue: React.CSSProperties = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

const empty: React.CSSProperties = {
  marginTop: 20,
  textAlign: "center",
  color: "#888",
  padding: 20,
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
};