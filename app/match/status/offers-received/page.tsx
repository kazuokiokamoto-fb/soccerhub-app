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

type StatusFilter = "pending" | "accepted" | "rejected" | "cancelled" | null;

export default function OfferReceivedPage() {
  const router = useRouter();

  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);

  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [teamMap, setTeamMap] = useState<Map<string, Team>>(new Map());
  const [slotMap, setSlotMap] = useState<Map<string, SlotMini>>(new Map());
  const [threadMap, setThreadMap] = useState<Map<string, string>>(new Map());

  const [openId, setOpenId] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [chatOpeningId, setChatOpeningId] = useState("");

  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(null);

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
      setThreadMap(new Map());
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
      setThreadMap(new Map());
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

    const offerItems: ReceivedItem[] = ((offerRows ?? []) as Offer[]).map(
      (o) => ({
        kind: "offer",
        id: o.id,
        created_at: o.created_at,
        status: o.status,
        from_team_id: o.from_team_id,
        to_team_id: o.to_team_id,
        slot_id: o.slot_id,
        message: o.message,
      })
    );

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

    const myTeamIdSet = new Set(myTeamIds);
    const relevantPairs = Array.from(
      new Set(
        merged
          .map((x) => {
            const myTeamId = myTeamIdSet.has(x.to_team_id)
              ? x.to_team_id
              : myTeamIds[0] ?? "";
            const otherTeamId = x.from_team_id;
            return myTeamId && otherTeamId ? `${myTeamId}:${otherTeamId}` : "";
          })
          .filter(Boolean)
      )
    );

    if (relevantPairs.length > 0) {
      const allPairTeamIds = Array.from(
        new Set(relevantPairs.flatMap((pair) => pair.split(":")))
      );

      const { data: chatMembers, error: chatMembersErr } = await supabase
        .from("chat_members")
        .select("thread_id,team_id")
        .in("team_id", allPairTeamIds);

      if (chatMembersErr) {
        console.error(chatMembersErr);
        setThreadMap(new Map());
      } else {
        const rows = (chatMembers ?? []) as Array<{
          thread_id: string;
          team_id: string | null;
        }>;

        const threadTeams = new Map<string, Set<string>>();
        rows.forEach((row) => {
          if (!row.thread_id || !row.team_id) return;
          if (!threadTeams.has(row.thread_id)) {
            threadTeams.set(row.thread_id, new Set());
          }
          threadTeams.get(row.thread_id)!.add(row.team_id);
        });

        const nextThreadMap = new Map<string, string>();
        relevantPairs.forEach((pair) => {
          const [teamA, teamB] = pair.split(":");
          for (const [threadId, teamSet] of threadTeams.entries()) {
            if (teamSet.has(teamA) && teamSet.has(teamB)) {
              nextThreadMap.set(pair, threadId);
              break;
            }
          }
        });

        setThreadMap(nextThreadMap);
      }
    } else {
      setThreadMap(new Map());
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

  const filteredItems = useMemo(() => {
    if (!selectedStatus) return items;
    return items.filter((item) => item.status === selectedStatus);
  }, [items, selectedStatus]);

  async function getOrCreateDmThread(myTeamId: string, otherTeamId: string) {
    const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
      my_team_id: myTeamId,
      other_team_id: otherTeamId,
    });

    if (error) {
      console.error("rpc_get_or_create_dm_thread error:", error);
      throw error;
    }

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

  async function getUserIdByTeamId(teamId: string) {
    if (!teamId) return "";

    const { data: teamRow, error } = await supabase
      .from("teams")
      .select("owner_id")
      .eq("id", teamId)
      .maybeSingle();

    if (error) throw error;
    return (teamRow as { owner_id?: string | null } | null)?.owner_id ?? "";
  }

  async function createNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    targetUrl: string;
    relatedThreadId?: string | null;
    relatedTeamId?: string | null;
    relatedOfferId?: string | null;
    relatedRequestId?: string | null;
  }) {
    const {
      userId,
      type,
      title,
      body,
      targetUrl,
      relatedThreadId = null,
      relatedTeamId = null,
      relatedOfferId = null,
      relatedRequestId = null,
    } = params;

    if (!userId) return;

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body,
      target_url: targetUrl,
      is_read: false,
      related_thread_id: relatedThreadId,
      related_team_id: relatedTeamId,
      related_offer_id: relatedOfferId,
      related_request_id: relatedRequestId,
    });

    if (error) {
      console.error("notification insert error:", error);
    }
  }

  async function sendPush(params: {
    userId: string;
    title: string;
    body: string;
    url: string;
  }) {
    const { userId, title, body, url } = params;
    if (!userId) return;

    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          title,
          body,
          url,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        console.error("push send error:", json ?? res.statusText);
      }
    } catch (e) {
      console.error("push send fetch error:", e);
    }
  }

  async function openChat(item: ReceivedItem) {
    const rowId = `${item.kind}:${item.id}`;
    setChatOpeningId(rowId);

    try {
      if (!item.to_team_id || !item.from_team_id) {
        alert("チャットを開くためのチーム情報が不足しています");
        return;
      }

      const threadId = await getOrCreateDmThread(
        item.to_team_id,
        item.from_team_id
      );
      router.push(`/chat/${threadId}?from=received-offers`);
    } catch (e: any) {
      console.error(e);
      alert(`チャットを開けません: ${e?.message ?? "unknown error"}`);
    } finally {
      setChatOpeningId("");
    }
  }

  async function safeCloseSlot(slotId: string | null | undefined) {
    if (!slotId) return;

    try {
      const { error } = await supabase
        .from("match_slots")
        .update({ is_closed: true })
        .eq("id", slotId);

      if (error) {
        console.error("slot close error:", error);
      }
    } catch (e) {
      console.error("slot close catch:", e);
    }
  }

  async function handleAcceptedFlow(params: {
    item: ReceivedItem;
    uid: string;
    slot: SlotMini | null;
    fromTeam: Team | undefined;
    toTeam: Team | undefined;
    otherUserId: string;
  }) {
    const { item, uid, slot, fromTeam, toTeam, otherUserId } = params;

    if (!item.to_team_id || !item.from_team_id) {
      return {
        ok: false,
        reason: "team_missing",
      };
    }

    try {
      const threadId = await getOrCreateDmThread(
        item.to_team_id,
        item.from_team_id
      );

      const body =
        item.kind === "offer"
          ? [
              "━━━━━━━━━━━━",
              "✅ 試合オファー承認",
              "━━━━━━━━━━━━",
              slot
                ? `📅 ${slot.date || "日付未設定"} ${
                    slot.start_time ? String(slot.start_time).slice(0, 5) : ""
                  }${
                    slot.end_time ? `-${String(slot.end_time).slice(0, 5)}` : ""
                  }`
                : "",
              slot
                ? `🏷 ${
                    categoryLabel(slot.category) || slot.category || "未設定"
                  }`
                : "",
              slot ? `📍 ${slot.area_text ?? slot.area ?? "未設定"}` : "",
              `👥 募集チーム: ${toTeam?.name ?? "自チーム"}`,
              `👥 相手チーム: ${fromTeam?.name ?? "相手チーム"}`,
              "📩 詳細はこのチャットで調整してください。",
            ]
              .filter(Boolean)
              .join("\n")
          : [
              "━━━━━━━━━━━━",
              "✅ 試合申込み承認",
              "━━━━━━━━━━━━",
              slot
                ? `📅 ${slot.date || "日付未設定"} ${
                    slot.start_time ? String(slot.start_time).slice(0, 5) : ""
                  }${
                    slot.end_time ? `-${String(slot.end_time).slice(0, 5)}` : ""
                  }`
                : "",
              slot
                ? `🏷 ${
                    categoryLabel(slot.category) || slot.category || "未設定"
                  }`
                : "",
              slot ? `📍 ${slot.area_text ?? slot.area ?? "未設定"}` : "",
              `👥 申込チーム: ${fromTeam?.name ?? "相手チーム"}`,
              `👥 募集チーム: ${toTeam?.name ?? "自チーム"}`,
              "📩 詳細はこのチャットで調整してください。",
            ]
              .filter(Boolean)
              .join("\n");

      await insertChatMessage({
        threadId,
        senderId: uid,
        senderTeamId: item.to_team_id,
        body,
      });

      if (item.kind === "offer") {
        await createNotification({
          userId: otherUserId,
          type: "offer_accepted",
          title: "試合オファーが承認されました",
          body: `${toTeam?.name ?? "相手チーム"} があなたのオファーを承認しました`,
          targetUrl: `/chat/${threadId}?from=received-offers`,
          relatedThreadId: threadId,
          relatedTeamId: item.to_team_id,
          relatedOfferId: item.id,
        });

        await sendPush({
          userId: otherUserId,
          title: "試合オファーが承認されました",
          body: `${toTeam?.name ?? "相手チーム"} があなたのオファーを承認しました`,
          url: `/chat/${threadId}?from=received-offers`,
        });
      } else {
        await createNotification({
          userId: otherUserId,
          type: "request_accepted",
          title: "試合申込みが承認されました",
          body: `${toTeam?.name ?? "相手チーム"} があなたの申込みを承認しました`,
          targetUrl: `/chat/${threadId}?from=received-offers`,
          relatedThreadId: threadId,
          relatedTeamId: item.to_team_id,
          relatedRequestId: item.id,
        });

        await sendPush({
          userId: otherUserId,
          title: "試合申込みが承認されました",
          body: `${toTeam?.name ?? "相手チーム"} があなたの申込みを承認しました`,
          url: `/chat/${threadId}?from=received-offers`,
        });
      }

      window.dispatchEvent(new Event("notifications-updated"));

      return {
        ok: true,
        threadId,
      };
    } catch (e: any) {
      console.error("accepted flow error:", e);
      return {
        ok: false,
        reason: e?.message ?? "unknown_error",
      };
    }
  }

  async function updateOfferStatus(
    offerId: string,
    nextStatus: "accepted" | "rejected"
  ) {
    const { error } = await supabase
      .from("match_offers")
      .update({ status: nextStatus })
      .eq("id", offerId);

    if (error) throw error;
  }

  async function updateRequestStatus(
    requestId: string,
    nextStatus: "accepted" | "rejected"
  ) {
    const { error } = await supabase
      .from("match_requests")
      .update({ status: nextStatus })
      .eq("id", requestId);

    if (error) throw error;
  }

  const updateStatus = async (
    item: ReceivedItem,
    nextStatus: "accepted" | "rejected"
  ) => {
    const subject =
      item.kind === "offer" ? "このオファー" : "この申込み";

    const confirmText =
      nextStatus === "accepted"
        ? `${subject}を承認しますか？`
        : `${subject}を見送りますか？`;

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

      const slot = item.slot_id ? slotMap.get(item.slot_id) ?? null : null;
      const fromTeam = teamMap.get(item.from_team_id);
      const toTeam = teamMap.get(item.to_team_id);

      let otherUserId = "";
      try {
        otherUserId = await getUserIdByTeamId(item.from_team_id);
      } catch (e) {
        console.error("getUserIdByTeamId error:", e);
      }

      try {
        if (item.kind === "offer") {
          await updateOfferStatus(item.id, nextStatus);
        } else {
          await updateRequestStatus(item.id, nextStatus);
        }
      } catch (e: any) {
        console.error(e);
        alert(
          nextStatus === "accepted"
            ? `承認に失敗しました: ${e?.message ?? "unknown error"}`
            : `見送りに失敗しました: ${e?.message ?? "unknown error"}`
        );
        setUpdatingId("");
        return;
      }

      setItems((prev) =>
        prev.map((x) =>
          x.kind === item.kind && x.id === item.id
            ? { ...x, status: nextStatus }
            : x
        )
      );

      if (nextStatus === "accepted") {
        await safeCloseSlot(item.slot_id);

        const acceptedFlow = await handleAcceptedFlow({
          item,
          uid,
          slot,
          fromTeam,
          toTeam,
          otherUserId,
        });

        await loadPage();
        setUpdatingId("");

        if (acceptedFlow.ok && acceptedFlow.threadId) {
          router.push(`/chat/${acceptedFlow.threadId}?from=received-offers`);
          return;
        }

        alert(
          "承認は完了しました。チャットの自動作成または通知で一部失敗したため、必要に応じて一覧から「チャット」ボタンを押してください。"
        );
        return;
      }

      if (nextStatus === "rejected") {
        if (item.kind === "offer") {
          await createNotification({
            userId: otherUserId,
            type: "offer_rejected",
            title: "試合オファーは見送りになりました",
            body: `${toTeam?.name ?? "相手チーム"} があなたのオファーを見送りました`,
            targetUrl: "/match/status/offers",
            relatedTeamId: item.to_team_id,
            relatedOfferId: item.id,
          });

          await sendPush({
            userId: otherUserId,
            title: "試合オファーは見送りになりました",
            body: `${toTeam?.name ?? "相手チーム"} があなたのオファーを見送りました`,
            url: "/match/status/offers",
          });
        } else {
          await createNotification({
            userId: otherUserId,
            type: "request_rejected",
            title: "試合申込みは見送りになりました",
            body: `${toTeam?.name ?? "相手チーム"} があなたの申込みを見送りました`,
            targetUrl: "/match/status/offers",
            relatedTeamId: item.to_team_id,
            relatedRequestId: item.id,
          });

          await sendPush({
            userId: otherUserId,
            title: "試合申込みは見送りになりました",
            body: `${toTeam?.name ?? "相手チーム"} があなたの申込みを見送りました`,
            url: "/match/status/offers",
          });
        }
      }

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

  function TeamDetailLink({ item }: { item: ReceivedItem }) {
    const pairKey = `${item.to_team_id}:${item.from_team_id}`;
    const threadId = threadMap.get(pairKey);
    const href = threadId
      ? `/teams/${item.from_team_id}?threadId=${encodeURIComponent(
          threadId
        )}&from=received-offers`
      : `/teams/${item.from_team_id}?from=received-offers`;

    return (
      <Link href={href} className="sh-btn">
        チーム詳細
      </Link>
    );
  }

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
        <Stat
          label="未対応"
          value={counts.pending}
          active={selectedStatus === "pending"}
          onClick={() =>
            setSelectedStatus((prev) =>
              prev === "pending" ? null : "pending"
            )
          }
        />
        <Stat
          label="承認"
          value={counts.accepted}
          active={selectedStatus === "accepted"}
          onClick={() =>
            setSelectedStatus((prev) =>
              prev === "accepted" ? null : "accepted"
            )
          }
        />
        <Stat
          label="見送り"
          value={counts.rejected}
          active={selectedStatus === "rejected"}
          onClick={() =>
            setSelectedStatus((prev) =>
              prev === "rejected" ? null : "rejected"
            )
          }
        />
        <Stat
          label="取消"
          value={counts.cancelled}
          active={selectedStatus === "cancelled"}
          onClick={() =>
            setSelectedStatus((prev) =>
              prev === "cancelled" ? null : "cancelled"
            )
          }
        />
      </div>

      {selectedStatus ? (
        <div style={filterInfo}>
          絞り込み中：{label(selectedStatus)}
        </div>
      ) : null}

      {loading ? <div style={infoText}>読み込み中…</div> : null}

      {!loading && myTeams.length === 0 ? (
        <div style={empty}>自分のチームがまだ登録されていません</div>
      ) : null}

      {!loading && myTeams.length > 0 && filteredItems.length === 0 ? (
        <div style={empty}>該当するオファーはありません</div>
      ) : null}

      <div style={list}>
        {filteredItems.map((item) => {
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
                      ? ` / ${
                          categoryLabel(fromTeam.category) || fromTeam.category
                        }`
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
                    {categoryLabel(slot.category) || slot.category || "カテゴリ未設定"}
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

                <TeamDetailLink item={item} />

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
                        ? `（${
                            categoryLabel(fromTeam.category) ||
                            fromTeam.category
                          }）`
                        : ""}
                    </div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>受信チーム</div>
                    <div style={detailValue}>
                      {toTeam?.name ?? "自チーム"}
                      {toTeam?.category
                        ? `（${
                            categoryLabel(toTeam.category) || toTeam.category
                          }）`
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
                        {categoryLabel(slot.category) || slot.category || "カテゴリ未設定"}
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

function Stat({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...statBox,
        cursor: "pointer",
        transition: "all 0.2s ease",
        ...(active ? statBoxActive : {}),
      }}
    >
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </button>
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
  textAlign: "left",
};

const statBoxActive: React.CSSProperties = {
  border: "2px solid #2f6f3e",
  background: "#f3fbf5",
  transform: "translateY(-1px)",
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

const filterInfo: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: "#5b6d61",
  fontWeight: 700,
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