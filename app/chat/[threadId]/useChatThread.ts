"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { supabase } from "@/app/lib/supabase";
import { categoryLabel } from "@/app/lib/categories";
import { getUnreadChatCount, syncAppBadge } from "@/app/lib/badge";
import {
  type Msg,
  type TeamMini,
  type ChatMemberRow,
  type ChatQueryParams,
  nowIso,
  getBackLink,
  resolveMyTeamId,
  isOptimisticMessageId,
  isReadByOther,
  isDeletedForEveryone,
  isDeletedOnlyForSender,
  shouldHideForMe,
  normalizeDateCandidate,
  normalizeTimeCandidate,
  extractScheduleCandidatesFromMessages,
} from "./chat-thread.utils";

export type ScheduleModalValues = {
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  note: string;
};

type AttendanceStatus = "attend" | "maybe" | "absent";

function attendanceLabel(status?: AttendanceStatus | null) {
  if (status === "attend") return "参加";
  if (status === "maybe") return "未定";
  if (status === "absent") return "不参加";
  return "";
}

export function useChatThread(params: {
  threadId: string;
  query?: ChatQueryParams & {
    teamId?: string | null;
  };
  from?: string | null;
  slotId?: string | null;
  date?: string | null;
  teamId?: string | null;
}) {
  const threadId = params.threadId;

  const from = params.query?.from ?? params.from ?? null;
  const slotId = params.query?.slotId ?? params.slotId ?? null;
  const date = params.query?.date ?? params.date ?? null;
  const teamId = params.query?.teamId ?? params.teamId ?? null;
  const isTeamChat = from === "team-message" || !!teamId;

  const backLink = useMemo(
    () => getBackLink({ from, slotId, date }),
    [from, slotId, date]
  );

  const carriedQueryString = useMemo(() => {
    const qs = new URLSearchParams();

    if (from) qs.set("from", from);
    if (slotId) qs.set("slotId", slotId);
    if (date) qs.set("date", date);
    if (teamId) qs.set("teamId", teamId);

    return qs.toString();
  }, [from, slotId, date, teamId]);

  const loginRedirectPath = useMemo(() => {
    const qs = carriedQueryString ? `?${carriedQueryString}` : "";
    return `/chat/${threadId}${qs}`;
  }, [threadId, carriedQueryString]);

  const [authLoading, setAuthLoading] = useState(true);
  const [meId, setMeId] = useState("");

  const [myTeamId, setMyTeamId] = useState("");
  const [myOwnedTeams, setMyOwnedTeams] = useState<TeamMini[]>([]);
  const [memberRowsState, setMemberRowsState] = useState<ChatMemberRow[]>([]);
  const [otherTeamId, setOtherTeamId] = useState("");
  const [otherUserId, setOtherUserId] = useState("");
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState("");

  const [otherTeamName, setOtherTeamName] = useState("相手チーム");
  const [otherTeamCategory, setOtherTeamCategory] = useState("");

  const [myAttendance, setMyAttendance] = useState<AttendanceStatus | null>(
    null
  );
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");

  const [actionSheetMessageId, setActionSheetMessageId] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  const showAttendanceButtons = !!slotId && !!teamId;

  const visibleMessages = useMemo(() => {
    return messages.filter((m) => !shouldHideForMe(m, meId));
  }, [messages, meId]);

  const scheduleDefaults = useMemo(() => {
    const extracted = extractScheduleCandidatesFromMessages(messages, meId);

    return {
      date: extracted.date ?? "",
      startTime: extracted.startTime ? extracted.startTime.slice(0, 5) : "",
      endTime: extracted.endTime ? extracted.endTime.slice(0, 5) : "",
      venueName: extracted.venueName ?? "",
      note: "",
      sourceMessageId: extracted.sourceMessageId,
      sourceText: extracted.sourceText,
      extracted,
    };
  }, [messages, meId]);

  const canSend = useMemo(() => {
    return (
      !!meId &&
      !!threadId &&
      isMember &&
      text.trim().length > 0 &&
      !sending
    );
  }, [meId, threadId, isMember, text, sending]);

  const canCreateProposal = useMemo(() => {
    return (
      !isTeamChat &&
      !!meId &&
      !!threadId &&
      !!myTeamId &&
      isMember &&
      !creatingProposal
    );
  }, [isTeamChat, meId, threadId, myTeamId, isMember, creatingProposal]);

  function scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
        return;
      }

      if (chatBodyRef.current) {
        chatBodyRef.current.scrollTo({
          top: chatBodyRef.current.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    });
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function canOpenActionSheet(m: Msg) {
    if (m.sender_id !== meId) return false;
    if (isOptimisticMessageId(m.id)) return false;
    if (isDeletedForEveryone(m) || isDeletedOnlyForSender(m)) return false;
    if (deletingMessageId) return false;
    return true;
  }

  function startLongPress(messageId: string) {
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setActionSheetMessageId(messageId);
      longPressTimerRef.current = null;
    }, 450);
  }

  async function refreshChatBadge() {
    if (!meId) return;

    try {
      const total = await getUnreadChatCount(meId);
      await syncAppBadge(total);
    } catch (e) {
      console.error("refreshChatBadge error:", e);
    }

    window.dispatchEvent(new Event("badge-updated"));
  }

  async function markRead() {
    if (!threadId || !meId) return;

    try {
      const readAt = nowIso();

      const { error } = await supabase
        .from("chat_members")
        .update({ last_read_at: readAt })
        .eq("thread_id", threadId)
        .eq("user_id", meId);

      if (error) {
        console.error("markRead update error:", error);
        return;
      }

      await refreshChatBadge();
    } catch (e) {
      console.error("markRead failed:", e);
    }
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
    } catch (e) {
      console.error("Notification permission error:", e);
    }
  }

  function notifyIncomingMessage(body?: string | null) {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (document.visibilityState === "visible") return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification(otherTeamName || "新着メッセージ", {
        body: body?.trim() || "メッセージが届きました",
      });
    } catch (e) {
      console.error("Notification create error:", e);
    }
  }

  async function loadMyAttendance(currentMeId: string) {
    if (!currentMeId || !slotId || !teamId) {
      setMyAttendance(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("match_attendances")
        .select("status")
        .eq("slot_id", slotId)
        .eq("team_id", teamId)
        .eq("user_id", currentMeId)
        .maybeSingle();

      if (error) throw error;

      const status = String((data as any)?.status ?? "");

      if (status === "attend" || status === "maybe" || status === "absent") {
        setMyAttendance(status);
      } else {
        setMyAttendance(null);
      }
    } catch (e) {
      console.error("loadMyAttendance error:", e);
      setMyAttendance(null);
    }
  }

  async function updateAttendance(status: AttendanceStatus) {
    if (!meId || !slotId || !teamId) {
      alert("出欠を登録できません");
      return;
    }

    setSavingAttendance(true);

    try {
      const { error } = await supabase.from("match_attendances").upsert(
        {
          slot_id: slotId,
          team_id: teamId,
          user_id: meId,
          status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "slot_id,team_id,user_id",
        }
      );

      if (error) throw error;

      setMyAttendance(status);
      await sendAttendanceMessage(status);
    } catch (e: any) {
      console.error(e);
      alert(`出欠の保存に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSavingAttendance(false);
    }
  }

  async function loadThreadMeta(currentMeId: string) {
    if (!currentMeId || !threadId) return;

    const [
      { data: memberRows, error: memberErr },
      { data: ownedTeamsRows, error: ownedTeamsErr },
    ] = await Promise.all([
      supabase
        .from("chat_members")
        .select("thread_id,user_id,team_id,last_read_at")
        .eq("thread_id", threadId),
      supabase
        .from("teams")
        .select("id,name,category")
        .eq("owner_id", currentMeId),
    ]);

    if (memberErr) console.error(memberErr);
    if (ownedTeamsErr) console.error(ownedTeamsErr);

    const typedMemberRows = ((memberRows ?? []) as ChatMemberRow[]).filter(
      Boolean
    );
    const ownedTeams = ((ownedTeamsRows ?? []) as TeamMini[]).filter(Boolean);

    setMemberRowsState(typedMemberRows);
    setMyOwnedTeams(ownedTeams);

    const teamIds = typedMemberRows
      .map((r) => r.team_id as string)
      .filter(Boolean);

    const uniqueTeamIds = Array.from(new Set(teamIds));

    const otherMemberRow =
      typedMemberRows.find((r) => r.user_id && r.user_id !== currentMeId) ??
      null;

    setOtherUserId(otherMemberRow?.user_id ?? "");
    setOtherLastReadAt(otherMemberRow?.last_read_at ?? null);

    if (isTeamChat) {
      const targetTeamId = teamId || uniqueTeamIds[0] || "";

      setMyTeamId(targetTeamId);
      setOtherTeamId(targetTeamId);

      if (targetTeamId) {
        const { data: teamRow, error: teamErr } = await supabase
          .from("teams")
          .select("id,name,category")
          .eq("id", targetTeamId)
          .maybeSingle();

        if (teamErr) console.error(teamErr);

        if (teamRow) {
          const team = teamRow as TeamMini;
          setOtherTeamName(team.name ?? "チーム内チャット");
          setOtherTeamCategory(
            categoryLabel(team.category) || team.category || "チーム内チャット"
          );
        } else {
          setOtherTeamName("チーム内チャット");
          setOtherTeamCategory("");
        }
      } else {
        setOtherTeamName("チーム内チャット");
        setOtherTeamCategory("");
      }

      return;
    }

    const resolvedMyTeamId = resolveMyTeamId({
      meId: currentMeId,
      memberRows: typedMemberRows,
      ownedTeams,
    });

    setMyTeamId(resolvedMyTeamId);

    const ownedTeamIds = new Set(ownedTeams.map((t) => t.id).filter(Boolean));

    const resolvedOtherTeamId =
      teamIds.find((id) => !ownedTeamIds.has(id)) ??
      teamIds.find((id) => id !== resolvedMyTeamId) ??
      "";

    setOtherTeamId(resolvedOtherTeamId);

    if (resolvedOtherTeamId) {
      const { data: teamRow, error: teamErr } = await supabase
        .from("teams")
        .select("id,name,category")
        .eq("id", resolvedOtherTeamId)
        .maybeSingle();

      if (teamErr) console.error(teamErr);

      if (teamRow) {
        const team = teamRow as TeamMini;
        setOtherTeamName(team.name ?? "相手チーム");
        setOtherTeamCategory(
          categoryLabel(team.category) || team.category || ""
        );
      } else {
        setOtherTeamName("相手チーム");
        setOtherTeamCategory("");
      }
    } else {
      setOtherTeamName("相手チーム");
      setOtherTeamCategory("");
    }
  }

  function resolveSendTeamId() {
    if (isTeamChat && teamId) return teamId;

    return (
      myTeamId ||
      resolveMyTeamId({
        meId,
        memberRows: memberRowsState,
        ownedTeams: myOwnedTeams,
      })
    );
  }

  async function insertMessage(body: string) {
    if (!body.trim()) return;
    if (!meId) return;
    if (!threadId) return;
    if (!isMember) return;

    const resolvedSendTeamId = resolveSendTeamId();

    if (!resolvedSendTeamId) {
      setSendError(
        "送信元チームが取得できません。チーム登録または chat_members の team_id を確認してください。"
      );
      return;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        sender_id: meId,
        sender_team_id: resolvedSendTeamId,
        body,
      })
      .select(
        "id,thread_id,sender_id,sender_team_id,body,created_at,updated_at,deleted_at,deleted_by_sender,deleted_for_everyone"
      )
      .single();

    if (error) throw error;

    setMyTeamId(resolvedSendTeamId);

    setMessages((prev) => {
      const real = data as Msg;

      if (prev.some((m) => m.id === real.id)) {
        return prev;
      }

      return [...prev, real].sort((a, b) =>
        a.created_at > b.created_at ? 1 : -1
      );
    });

    scrollToBottom(true);

    await markRead();
    await refreshChatBadge();
  }

  async function sendAttendanceMessage(status: AttendanceStatus) {
    const label = attendanceLabel(status);
    if (!label) return;

    const body = [
      "━━━━━━━━━━━━",
      "🗓 出欠回答",
      "━━━━━━━━━━━━",
      `回答：${label}`,
    ].join("\n");

    await insertMessage(body);
  }

  async function send() {
    setSendError("");

    const body = text.trim();
    if (!body) return;
    if (!meId) return alert("ログインが必要です");
    if (!threadId) return alert("threadId がありません");
    if (!isMember) return alert("このスレッドに参加していません");
    if (sending) return;

    const resolvedSendTeamId = resolveSendTeamId();

    if (!resolvedSendTeamId) {
      setSendError(
        "送信元チームが取得できません。チーム登録または chat_members の team_id を確認してください。"
      );
      return;
    }

    setSending(true);
    setText("");

    const optimisticId = `optimistic-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

    const optimistic: Msg = {
      id: optimisticId,
      thread_id: threadId,
      sender_id: meId,
      sender_team_id: resolvedSendTeamId,
      body,
      created_at: nowIso(),
      deleted_at: null,
      deleted_by_sender: false,
      deleted_for_everyone: false,
    };

    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom(true);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        sender_id: meId,
        sender_team_id: resolvedSendTeamId,
        body,
      })
      .select(
        "id,thread_id,sender_id,sender_team_id,body,created_at,updated_at,deleted_at,deleted_by_sender,deleted_for_everyone"
      )
      .single();

    if (error) {
      console.error(error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(body);
      setSendError(error.message || "送信に失敗しました");
      setSending(false);
      return;
    }

    setMyTeamId(resolvedSendTeamId);

    setMessages((prev) => {
      const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
      const real = data as Msg;

      if (withoutOptimistic.some((m) => m.id === real.id)) {
        return withoutOptimistic;
      }

      return [...withoutOptimistic, real].sort((a, b) =>
        a.created_at > b.created_at ? 1 : -1
      );
    });

    scrollToBottom(true);

    if (otherUserId) {
      const pushBody = body.length > 40 ? `${body.slice(0, 40)}…` : body;
      const pushUrl = `/chat/${threadId}${
        carriedQueryString ? `?${carriedQueryString}` : ""
      }`;

      try {
        const pushRes = await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: otherUserId,
            title: "新着チャット",
            body: pushBody,
            url: pushUrl,
          }),
        });

        if (!pushRes.ok) {
          const pushJson = await pushRes.json().catch(() => null);
          console.error("push send error:", pushJson ?? pushRes.statusText);
        }
      } catch (e) {
        console.error("push send fetch error:", e);
      }
    }

    await markRead();
    await refreshChatBadge();
    setSending(false);
  }

  async function deleteForMe(messageId: string) {
    if (!messageId || isOptimisticMessageId(messageId)) return;

    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    if (target.sender_id !== meId) return;
    if (isDeletedForEveryone(target) || isDeletedOnlyForSender(target)) return;

    setDeletingMessageId(messageId);

    try {
      const updatedAt = nowIso();

      const { error } = await supabase
        .from("chat_messages")
        .update({
          deleted_by_sender: true,
          updated_at: updatedAt,
        })
        .eq("id", messageId)
        .eq("sender_id", meId);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deleted_by_sender: true, updated_at: updatedAt }
            : m
        )
      );

      setActionSheetMessageId("");
      await refreshChatBadge();
    } catch (e: any) {
      console.error("deleteForMe error:", e);
      alert(`削除に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setDeletingMessageId("");
    }
  }

  async function deleteForEveryone(messageId: string) {
    if (!messageId || isOptimisticMessageId(messageId)) return;

    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    if (target.sender_id !== meId) return;
    if (isDeletedForEveryone(target)) return;

    setDeletingMessageId(messageId);

    try {
      const deletedAt = nowIso();

      const { error } = await supabase
        .from("chat_messages")
        .update({
          body: "",
          deleted_at: deletedAt,
          deleted_by_sender: true,
          deleted_for_everyone: true,
          updated_at: deletedAt,
        })
        .eq("id", messageId)
        .eq("sender_id", meId);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                body: "",
                deleted_at: deletedAt,
                deleted_by_sender: true,
                deleted_for_everyone: true,
                updated_at: deletedAt,
              }
            : m
        )
      );

      setActionSheetMessageId("");
      await refreshChatBadge();
    } catch (e: any) {
      console.error("deleteForEveryone error:", e);
      alert(`送信取消に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setDeletingMessageId("");
    }
  }

  async function createScheduleProposal(values: ScheduleModalValues) {
    if (!meId) return alert("ログインが必要です");
    if (!threadId) return alert("threadId がありません");
    if (!isMember) return alert("このスレッドに参加していません");

    const resolvedMyTeamId = resolveSendTeamId();

    if (!resolvedMyTeamId) {
      alert("自分のチーム情報が取得できません");
      return;
    }

    const normalizedDate = values.date.trim()
      ? normalizeDateCandidate(values.date.trim())
      : null;
    const normalizedStart = values.startTime.trim()
      ? normalizeTimeCandidate(values.startTime.trim())
      : null;
    const normalizedEnd = values.endTime.trim()
      ? normalizeTimeCandidate(values.endTime.trim())
      : null;

    if (values.date.trim() && !normalizedDate) {
      alert("日付形式が不正です。例: 2026-04-26");
      return;
    }

    if (values.startTime.trim() && !normalizedStart) {
      alert("開始時間形式が不正です。例: 13:00");
      return;
    }

    if (values.endTime.trim() && !normalizedEnd) {
      alert("終了時間形式が不正です。例: 15:00");
      return;
    }

    setCreatingProposal(true);

    try {
      const payload = {
        created_by_user_id: meId,
        created_by_team_id: resolvedMyTeamId,
        opponent_team_id: otherTeamId || null,
        external_opponent_name: otherTeamId ? null : otherTeamName || null,
        thread_id: threadId,
        source_message_id: scheduleDefaults.sourceMessageId || null,
        status: otherTeamId ? "pending_approval" : "draft",
        approval_requested_to_team_id: otherTeamId || null,
        date: normalizedDate,
        start_time: normalizedStart,
        end_time: normalizedEnd,
        venue_name: values.venueName.trim() || null,
        category: otherTeamCategory || null,
        note: values.note.trim() || null,
        extracted_payload: {
          sourceText: scheduleDefaults.sourceText,
          extractedDate: scheduleDefaults.extracted.date,
          extractedStartTime: scheduleDefaults.extracted.startTime,
          extractedEndTime: scheduleDefaults.extracted.endTime,
          extractedVenueName: scheduleDefaults.extracted.venueName,
        },
      };

      const { data, error } = await supabase
        .from("schedule_proposals")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      setScheduleModalOpen(false);

      if (data?.id) {
        window.location.href = `/match/schedule-proposals/${data.id}`;
        return;
      }

      alert("予定案を作成しました。");
    } catch (e: any) {
      console.error("createScheduleProposal error:", e);
      alert(`予定作成に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setCreatingProposal(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSend) void send();
    }
  }

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setMeId(session?.user?.id ?? "");
      } catch (e) {
        console.error("getSession error:", e);
        if (!mounted) return;
        setMeId("");
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setMeId(session?.user?.id ?? "");
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!meId) return;
    void refreshChatBadge();
  }, [meId]);

  useEffect(() => {
    if (!meId) return;
    void loadMyAttendance(meId);
  }, [meId, slotId, teamId]);

  useEffect(() => {
    if (authLoading) return;

    if (!meId || !threadId) {
      setLoading(false);
      setIsMember(false);
      setMessages([]);
      setMemberRowsState([]);
      return;
    }

    (async () => {
      setLoading(true);
      setIsMember(false);
      setMyTeamId("");
      setMyOwnedTeams([]);
      setMemberRowsState([]);
      setOtherTeamId("");
      setOtherUserId("");
      setOtherLastReadAt(null);
      setSendError("");
      setOtherTeamName(isTeamChat ? "チーム内チャット" : "相手チーム");
      setOtherTeamCategory("");

      const { data: mem, error: memErr } = await supabase
        .from("chat_members")
        .select("thread_id")
        .eq("thread_id", threadId)
        .eq("user_id", meId)
        .maybeSingle();

      if (memErr) console.error(memErr);

      if (!mem) {
        setMessages([]);
        setLoading(false);
        setIsMember(false);
        return;
      }

      setIsMember(true);

      await loadThreadMeta(meId);

      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          "id,thread_id,sender_id,sender_team_id,body,created_at,updated_at,deleted_at,deleted_by_sender,deleted_for_everyone"
        )
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setMessages([]);
        setLoading(false);
        return;
      }

      setMessages(((data ?? []) as Msg[]).filter(Boolean));
      setLoading(false);
      scrollToBottom(false);

      await markRead();
    })();
  }, [authLoading, meId, threadId, isTeamChat]);

  useEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [loading]);

  useEffect(() => {
    if (authLoading || !meId || !threadId || !isMember) return;

    const messageChannel = supabase
      .channel(`chat-messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Msg;

            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) {
                return prev.filter(
                  (m) => !String(m.id).startsWith("optimistic-")
                );
              }

              const withoutOptimistic = prev.filter(
                (m) =>
                  !(
                    m.sender_id === row.sender_id &&
                    m.body === row.body &&
                    String(m.id).startsWith("optimistic-")
                  )
              );

              return [...withoutOptimistic, row].sort((a, b) =>
                a.created_at > b.created_at ? 1 : -1
              );
            });

            scrollToBottom(true);

            if (row.sender_id && row.sender_id !== meId) {
              notifyIncomingMessage(row.body);
              await markRead();
            } else {
              await refreshChatBadge();
            }
          }

          if (payload.eventType === "UPDATE") {
            const row = payload.new as Msg;
            setMessages((prev) =>
              prev.map((m) => (m.id === row.id ? { ...m, ...row } : m))
            );
            await refreshChatBadge();
          }
        }
      )
      .subscribe();

    const memberChannel = supabase
      .channel(`chat-members:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_members",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const row = payload.new as ChatMemberRow;

          if (row.user_id && row.user_id !== meId) {
            setOtherLastReadAt(row.last_read_at ?? null);
          } else if (row.user_id === meId) {
            await refreshChatBadge();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [authLoading, meId, threadId, isMember, otherTeamName]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

  return {
    authLoading,
    meId,
    loading,
    isMember,

    from,
    slotId,
    date,
    teamId,
    isTeamChat,

    backLink,
    carriedQueryString,
    loginRedirectPath,

    myTeamId,
    otherTeamId,
    otherUserId,
    otherLastReadAt,
    otherTeamName,
    otherTeamCategory,

    messages,
    visibleMessages,
    text,
    setText,
    sending,
    sendError,

    notificationPermission,

    actionSheetMessageId,
    setActionSheetMessageId,
    deletingMessageId,

    scheduleModalOpen,
    setScheduleModalOpen,
    scheduleDefaults,
    creatingProposal,

    showAttendanceButtons,
    myAttendance,
    myAttendanceLabel: attendanceLabel(myAttendance),
    savingAttendance,
    updateAttendance,

    canSend,
    canCreateProposal,
    canOpenActionSheet,
    startLongPress,
    clearLongPressTimer,

    isReadByOther,

    bottomRef,
    chatBodyRef,
    scrollToBottom,

    send,
    onKeyDown,
    deleteForMe,
    deleteForEveryone,
    requestNotificationPermission,
    createScheduleProposal,
  };
}