"use client";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";
import PushPermissionButton from "@/app/components/PushPermissionButton";

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
  category_meta?: Record<
    string,
    { strength_rank?: string | null; member_count?: number | null }
  > | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  uniform_gk?: string | null;
  note?: string | null;
};

type MatchSlotRow = {
  id: string;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  is_closed: boolean | null;
  created_at?: string | null;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id?: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment?: string | null;
  created_at?: string | null;
};

type MatchOfferRow = {
  id: string;
  slot_id: string | null;
  from_user_id?: string | null;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message?: string | null;
  created_at?: string | null;
};

type ChatMemberRow = {
  thread_id: string;
  last_read_at: string | null;
};

type ChatMessageRow = {
  id: string;
  thread_id: string;
  body: string | null;
  created_at: string;
};

type NextMatchCard = {
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  slot_id: string;
};

type Toast = {
  type: "success" | "error" | "info";
  text: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

function isMissingColumnError(err: unknown) {
  const msg = String((err as { message?: string } | null)?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("uniform_gk") ||
        msg.includes("category_meta") ||
        msg.includes("categories")))
  );
}

function rankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function areaText(team?: TeamRow | null) {
  if (!team) return "未設定";
  const area = String(team.area ?? "").trim();
  if (area) return area;

  const text = `${team.prefecture ?? ""} ${team.city ?? ""}${
    team.town ? "・" + team.town : ""
  }`.trim();

  return text || "未設定";
}

function categoryText(team?: TeamRow | null) {
  if (!team) return "未設定";

  if (Array.isArray(team.categories) && team.categories.length > 0) {
    const labels = categoryLabels(team.categories);
    return labels.length > 0 ? labels.join(" / ") : team.categories.join(" / ");
  }

  return categoryLabel(team.category) || team.category || "未設定";
}

function categoryMetaEntries(team?: TeamRow | null) {
  if (!team?.category_meta || typeof team.category_meta !== "object") return [];
  return Object.entries(team.category_meta).filter(([key]) => !!key);
}

function fmtDate(ymd?: string | null) {
  if (!ymd) return "";
  return ymd;
}

function fmtTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function toDateTimeMs(date?: string | null, time?: string | null) {
  if (!date || !time) return 0;
  return new Date(`${date}T${time}`).getTime();
}

function toProfileRow(value: unknown): ProfileRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const user_id = asString(r.user_id);
  if (!user_id) return null;

  return {
    user_id,
    name: asNullableString(r.name),
    phone: asNullableString(r.phone),
    line_id: asNullableString(r.line_id),
    notify_email: asBooleanOrNull(r.notify_email),
    notify_line: asBooleanOrNull(r.notify_line),
  };
}

function toTeamRow(value: unknown): TeamRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const name = asString(r.name);
  if (!id || !name) return null;

  const rawMeta = asRecord(r.category_meta);
  let category_meta: TeamRow["category_meta"] = null;

  if (rawMeta) {
    const mapped: Record<
      string,
      { strength_rank?: string | null; member_count?: number | null }
    > = {};

    for (const [key, val] of Object.entries(rawMeta)) {
      const meta = asRecord(val);
      mapped[key] = {
        strength_rank: meta ? asNullableString(meta.strength_rank) : null,
        member_count: meta ? asNumberOrNull(meta.member_count) : null,
      };
    }

    category_meta = mapped;
  }

  return {
    id,
    owner_id: asNullableString(r.owner_id),
    name,
    category: asNullableString(r.category),
    categories: asStringArrayOrNull(r.categories),
    level: asNumberOrNull(r.level),
    strength_rank: asNullableString(r.strength_rank),
    area: asNullableString(r.area),
    prefecture: asNullableString(r.prefecture),
    city: asNullableString(r.city),
    town: asNullableString(r.town),
    has_ground: asBooleanOrNull(r.has_ground),
    category_meta,
    uniform_main: asNullableString(r.uniform_main),
    uniform_sub: asNullableString(r.uniform_sub),
    uniform_gk: asNullableString(r.uniform_gk),
    note: asNullableString(r.note),
  };
}

function toMatchSlotRow(value: unknown): MatchSlotRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const host_team_id = asString(r.host_team_id);
  const date = asString(r.date);
  const start_time = asString(r.start_time);
  const end_time = asString(r.end_time);

  if (!id || !host_team_id || !date || !start_time || !end_time) return null;

  return {
    id,
    host_team_id,
    date,
    start_time,
    end_time,
    area: asNullableString(r.area),
    area_text: asNullableString(r.area_text),
    category: asNullableString(r.category),
    is_closed: asBooleanOrNull(r.is_closed),
    created_at: asNullableString(r.created_at),
  };
}

function toMatchRequestRow(value: unknown): MatchRequestRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const slot_id = asString(r.slot_id);
  const requester_team_id = asString(r.requester_team_id);
  const status = asString(r.status) as MatchRequestRow["status"];

  if (!id || !slot_id || !requester_team_id || !status) return null;

  return {
    id,
    slot_id,
    requester_team_id,
    requester_user_id: asNullableString(r.requester_user_id),
    status,
    comment: asNullableString(r.comment),
    created_at: asNullableString(r.created_at),
  };
}

function toMatchOfferRow(value: unknown): MatchOfferRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const from_team_id = asString(r.from_team_id);
  const to_team_id = asString(r.to_team_id);
  const status = asString(r.status) as MatchOfferRow["status"];

  if (!id || !from_team_id || !to_team_id || !status) return null;

  return {
    id,
    slot_id: asNullableString(r.slot_id),
    from_user_id: asNullableString(r.from_user_id),
    from_team_id,
    to_team_id,
    status,
    message: asNullableString(r.message),
    created_at: asNullableString(r.created_at),
  };
}

function toChatMemberRow(value: unknown): ChatMemberRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const thread_id = asString(r.thread_id);
  if (!thread_id) return null;

  return {
    thread_id,
    last_read_at: asNullableString(r.last_read_at),
  };
}

function toChatMessageRow(value: unknown): ChatMessageRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const thread_id = asString(r.thread_id);
  const created_at = asString(r.created_at);

  if (!id || !thread_id || !created_at) return null;

  return {
    id,
    thread_id,
    body: asNullableString(r.body),
    created_at,
  };
}

function toArray<T>(value: unknown, mapper: (v: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

export default function MyPage() {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState("");
  const [loadError, setLoadError] = useState("");

  const [openCount, setOpenCount] = useState(0);
  const [receivedOfferCount, setReceivedOfferCount] = useState(0);
  const [sentOfferCount, setSentOfferCount] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [nextMatch, setNextMatch] = useState<NextMatchCard | null>(null);

  const loadRunningRef = useRef(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const me = useMemo(
    () =>
      user
        ? {
            id: user.id,
            email: user.email ?? null,
          }
        : null,
    [user]
  );

  const mainTeam = useMemo(() => teams[0] ?? null, [teams]);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (loadRunningRef.current) return;

    loadRunningRef.current = true;

    if (!user) {
      setProfile(null);
      setTeams([]);
      setOpenCount(0);
      setReceivedOfferCount(0);
      setSentOfferCount(0);
      setUnreadTotal(0);
      setNextMatch(null);
      setLoadError("");
      setLoading(false);
      loadRunningRef.current = false;
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const userId = user.id;

      const profilePromise = supabase
        .from("profiles")
        .select("user_id,name,phone,line_id,notify_email,notify_line")
        .eq("user_id", userId)
        .maybeSingle();

      const primaryTeamsPromise = supabase
        .from("teams")
        .select(
          "id,owner_id,name,category,categories,level,strength_rank,area,prefecture,city,town,has_ground,category_meta,uniform_main,uniform_sub,uniform_gk,note"
        )
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

      const [{ data: profileRaw, error: profileErr }, primaryTeamsRes] =
        await Promise.all([profilePromise, primaryTeamsPromise]);

      if (profileErr) {
        console.error("[mypage] profile error:", profileErr);
      }
      setProfile(toProfileRow(profileRaw));

      let loadedTeams: TeamRow[] = [];

      if (primaryTeamsRes.error && isMissingColumnError(primaryTeamsRes.error)) {
        const fallbackTeamsRes = await supabase
          .from("teams")
          .select(
            "id,owner_id,name,category,categories,level,strength_rank,area,prefecture,city,town,has_ground,uniform_main,uniform_sub,note"
          )
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false });

        if (fallbackTeamsRes.error) {
          throw fallbackTeamsRes.error;
        }

        loadedTeams = toArray(fallbackTeamsRes.data, toTeamRow);
      } else if (primaryTeamsRes.error) {
        throw primaryTeamsRes.error;
      } else {
        loadedTeams = toArray(primaryTeamsRes.data, toTeamRow);
      }

      setTeams(loadedTeams);

      const myTeamIds = loadedTeams.map((t) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        setOpenCount(0);
        setReceivedOfferCount(0);
        setSentOfferCount(0);
        setUnreadTotal(0);
        setNextMatch(null);
        setLoading(false);
        loadRunningRef.current = false;
        return;
      }

      const { data: mySlotsRaw, error: slotErr } = await supabase
        .from("match_slots")
        .select(
          "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed,created_at"
        )
        .in("host_team_id", myTeamIds);

      if (slotErr) {
        console.error("[mypage] match_slots error:", slotErr);
      }

      const mySlotRows = toArray(mySlotsRaw, toMatchSlotRow);
      const mySlotIds = mySlotRows.map((s) => s.id).filter(Boolean);

      setOpenCount(mySlotRows.filter((s) => !s.is_closed).length);

      const outgoingReqPromise = supabase
        .from("match_requests")
        .select(
          "id,slot_id,requester_team_id,requester_user_id,status,comment,created_at"
        )
        .in("requester_team_id", myTeamIds);

      const incomingReqPromise =
        mySlotIds.length > 0
          ? supabase
              .from("match_requests")
              .select(
                "id,slot_id,requester_team_id,requester_user_id,status,comment,created_at"
              )
              .in("slot_id", mySlotIds)
          : Promise.resolve({ data: [], error: null });

      const sentOffersPromise = supabase
        .from("match_offers")
        .select(
          "id,slot_id,from_user_id,from_team_id,to_team_id,status,message,created_at"
        )
        .in("from_team_id", myTeamIds);

      const receivedOffersPromise = supabase
        .from("match_offers")
        .select(
          "id,slot_id,from_user_id,from_team_id,to_team_id,status,message,created_at"
        )
        .in("to_team_id", myTeamIds);

      const chatMembersPromise = supabase
        .from("chat_members")
        .select("thread_id,last_read_at")
        .eq("user_id", userId);

      const [
        { data: outgoingRequestsRaw, error: outgoingReqErr },
        { data: incomingRequestsRaw, error: incomingReqErr },
        { data: sentOffersRaw, error: sentOffersErr },
        { data: receivedOffersRaw, error: receivedOffersErr },
        { data: memberRowsRaw, error: memberErr },
      ] = await Promise.all([
        outgoingReqPromise,
        incomingReqPromise,
        sentOffersPromise,
        receivedOffersPromise,
        chatMembersPromise,
      ]);

      if (outgoingReqErr) console.error("[mypage] outgoingReq error:", outgoingReqErr);
      if (incomingReqErr) console.error("[mypage] incomingReq error:", incomingReqErr);
      if (sentOffersErr) console.error("[mypage] sentOffers error:", sentOffersErr);
      if (receivedOffersErr) {
        console.error("[mypage] receivedOffers error:", receivedOffersErr);
      }
      if (memberErr) console.error("[mypage] chat_members error:", memberErr);

      const outgoingRequestRows = toArray(outgoingRequestsRaw, toMatchRequestRow);
      const incomingRequestRows = toArray(incomingRequestsRaw, toMatchRequestRow);
      const sentOfferRows = toArray(sentOffersRaw, toMatchOfferRow);
      const receivedOfferRows = toArray(receivedOffersRaw, toMatchOfferRow);

      const pendingReceivedOffers =
        receivedOfferRows.filter((o) => o.status === "pending").length +
        incomingRequestRows.filter(
          (r) =>
            r.status === "pending" && !myTeamIds.includes(r.requester_team_id)
        ).length;

      const pendingSentOffers =
        sentOfferRows.filter((o) => o.status === "pending").length +
        outgoingRequestRows.filter((r) => r.status === "pending").length;

      setReceivedOfferCount(pendingReceivedOffers);
      setSentOfferCount(pendingSentOffers);

      const myMemberRows = toArray(memberRowsRaw, toChatMemberRow);
      const threadIds = myMemberRows.map((r) => r.thread_id).filter(Boolean);

      if (threadIds.length > 0) {
        const { data: msgRowsRaw, error: msgErr } = await supabase
          .from("chat_messages")
          .select("id,thread_id,body,created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
          .limit(1500);

        if (msgErr) {
          console.error("[mypage] chat_messages error:", msgErr);
          setUnreadTotal(0);
        } else {
          const messages = toArray(msgRowsRaw, toChatMessageRow);
          const latestByThread = new Map<string, ChatMessageRow>();

          for (const m of messages) {
            if (!latestByThread.has(m.thread_id)) {
              latestByThread.set(m.thread_id, m);
            }
          }

          let unread = 0;
          for (const member of myMemberRows) {
            const last = latestByThread.get(member.thread_id);
            if (!last?.created_at) continue;

            if (!member.last_read_at) {
              unread += 1;
              continue;
            }

            if (
              new Date(last.created_at).getTime() >
              new Date(member.last_read_at).getTime()
            ) {
              unread += 1;
            }
          }

          setUnreadTotal(unread);
        }
      } else {
        setUnreadTotal(0);
      }

      const acceptedOutgoingRequestSlotIds = outgoingRequestRows
        .filter((r) => r.status === "accepted")
        .map((r) => r.slot_id);

      const acceptedIncomingRequestSlotIds = incomingRequestRows
        .filter((r) => r.status === "accepted")
        .map((r) => r.slot_id);

      const acceptedReceivedOfferSlotIds = receivedOfferRows
        .filter((o) => o.status === "accepted" && o.slot_id)
        .map((o) => o.slot_id as string);

      const acceptedSentOfferSlotIds = sentOfferRows
        .filter((o) => o.status === "accepted" && o.slot_id)
        .map((o) => o.slot_id as string);

      const mergedAcceptedSlotIds = Array.from(
        new Set(
          [
            ...acceptedOutgoingRequestSlotIds,
            ...acceptedIncomingRequestSlotIds,
            ...acceptedReceivedOfferSlotIds,
            ...acceptedSentOfferSlotIds,
          ].filter(Boolean)
        )
      );

      if (mergedAcceptedSlotIds.length > 0) {
        const { data: acceptedSlotsRaw, error: acceptedSlotsErr } = await supabase
          .from("match_slots")
          .select(
            "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed,created_at"
          )
          .in("id", mergedAcceptedSlotIds)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true });

        if (acceptedSlotsErr) {
          console.error("[mypage] acceptedSlots error:", acceptedSlotsErr);
          setNextMatch(null);
        } else {
          const acceptedSlots = toArray(acceptedSlotsRaw, toMatchSlotRow);
          const now = Date.now();

          const futureSlots = acceptedSlots
            .filter((s) => toDateTimeMs(s.date, s.start_time) >= now)
            .sort((a, b) => {
              const aMs = toDateTimeMs(a.date, a.start_time);
              const bMs = toDateTimeMs(b.date, b.start_time);
              return aMs - bMs;
            });

          if (futureSlots.length > 0) {
            const s = futureSlots[0];
            setNextMatch({
              date: s.date,
              start_time: s.start_time,
              end_time: s.end_time,
              area: s.area,
              area_text: s.area_text,
              category: s.category,
              slot_id: s.id,
            });
          } else {
            setNextMatch(null);
          }
        }
      } else {
        setNextMatch(null);
      }
    } catch (e: any) {
      console.error("[mypage] load error:", e);
      setLoadError(e?.message ?? "マイページの取得に失敗しました");
      setToast({
        type: "error",
        text: e?.message ?? "マイページの取得に失敗しました",
      });
    } finally {
      setLoading(false);
      loadRunningRef.current = false;
    }
  }, [authLoading, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!user?.id) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, load]);

  useEffect(() => {
    if (!user?.id) return;

    const triggerReload = () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      reloadTimerRef.current = setTimeout(() => {
        void load();
      }, 500);
    };

    const channel = supabase
      .channel(`mypage-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        triggerReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_slots" },
        triggerReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_requests" },
        triggerReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_offers" },
        triggerReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members" },
        triggerReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        triggerReload
      )
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  async function existsRow(table: string, column: string, teamId: string) {
    const res = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, teamId);

    if (res.error) {
      throw res.error;
    }
    return (res.count ?? 0) > 0;
  }

  async function canDeleteTeamSafely(teamId: string) {
    const blockers: string[] = [];

    const checks = [
      {
        label: "募集枠",
        run: () => existsRow("match_slots", "host_team_id", teamId),
      },
      {
        label: "試合申込",
        run: () => existsRow("match_requests", "requester_team_id", teamId),
      },
      {
        label: "送った招待",
        run: () => existsRow("match_offers", "from_team_id", teamId),
      },
      {
        label: "届いた招待",
        run: () => existsRow("match_offers", "to_team_id", teamId),
      },
      {
        label: "チャット参加情報",
        run: () => existsRow("chat_members", "team_id", teamId),
      },
      {
        label: "チャット送信履歴",
        run: () => existsRow("chat_messages", "sender_team_id", teamId),
      },
    ];

    for (const check of checks) {
      try {
        const hit = await check.run();
        if (hit) blockers.push(check.label);
      } catch (e: any) {
        console.error(`delete-check failed: ${check.label}`, e);
        throw new Error(
          `削除前チェックに失敗しました（${check.label}）: ${
            e?.message ?? "unknown error"
          }`
        );
      }
    }

    return {
      ok: blockers.length === 0,
      blockers,
    };
  }

  async function deleteTeam(team: TeamRow) {
    if (!me?.id) {
      setToast({ type: "error", text: "ログインが必要です" });
      return;
    }

    if (team.owner_id !== me.id) {
      setToast({ type: "error", text: "自分のチームのみ削除できます" });
      return;
    }

    const ok = window.confirm(
      `「${team.name}」を削除しますか？\n\n` +
        "安全のため、募集・申込・招待・チャット履歴などの関連データがあるチームは削除できません。"
    );
    if (!ok) return;

    setDeletingTeamId(team.id);
    setToast({ type: "info", text: "削除チェック中…" });

    try {
      const result = await canDeleteTeamSafely(team.id);

      if (!result.ok) {
        setToast({
          type: "error",
          text:
            "このチームはまだ削除できません。\n" +
            `関連データがあります: ${result.blockers.join(" / ")}`,
        });
        setDeletingTeamId("");
        return;
      }

      setToast({ type: "info", text: "削除中…" });

      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", team.id)
        .eq("owner_id", me.id);

      if (error) {
        console.error(error);
        setToast({
          type: "error",
          text: `チーム削除失敗: ${error.message}`,
        });
        setDeletingTeamId("");
        return;
      }

      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      setToast({
        type: "success",
        text: `✅ 「${team.name}」を削除しました`,
      });

      await load();
    } catch (e: any) {
      console.error(e);
      setToast({
        type: "error",
        text: e?.message ?? "チーム削除に失敗しました",
      });
    } finally {
      setDeletingTeamId("");
    }
  }

  if (authLoading || loading) {
    return (
      <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
        <AppTabNav />
        <AppHero
          icon="⚙️"
          title="マイページ"
          desc="アカウント情報、試合状況、チーム情報、グラウンド情報を確認・編集できます。"
        />
        <div style={{ padding: 20 }}>Loading...</div>
      </main>
    );
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

      <AppTabNav />

      <AppHero
        icon="⚙️"
        title="マイページ"
        desc="アカウント情報、試合状況、チーム情報、グラウンド情報を確認・編集できます。"
      />

      {!me ? (
        <div style={{ marginTop: 16, color: "#991b1b" }}>
          ログインが必要です。
        </div>
      ) : loadError ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: "#991b1b", marginBottom: 12 }}>{loadError}</div>
          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={() => void load()}
          >
            再読み込み
          </button>
        </div>
      ) : null}

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>現在の状況</h2>
          <Link href="/chat" className="sh-btn">
            チャットを見る
          </Link>
        </div>

        <div style={dashboardGrid}>
          <div style={dashboardCard}>
            <div style={dashboardTitle}>⚽ あなたの試合状況</div>

            <div style={statusList}>
              <DashboardLinkRow
                href="/match/status/open"
                label="募集中の試合"
                value={openCount}
                helper={
                  openCount === 0
                    ? "まだ募集していません"
                    : "現在公開中の募集です"
                }
              />
              <DashboardLinkRow
                href="/match/status/offers-received"
                label="届いたオファー"
                value={receivedOfferCount}
                helper={
                  receivedOfferCount === 0
                    ? "新しいオファーはありません"
                    : "確認待ちのオファーがあります"
                }
              />
              <DashboardLinkRow
                href="/match/status/offers"
                label="送ったオファー"
                value={sentOfferCount}
                helper={
                  sentOfferCount === 0
                    ? "まだオファーを送っていません"
                    : "返答待ちのオファーがあります"
                }
              />
            </div>
          </div>

          <div style={dashboardCard}>
            <div style={dashboardTitle}>💬 チャット</div>

            <div style={statusList}>
              <DashboardLinkRow
                href="/chat"
                label="未読メッセージ"
                value={unreadTotal}
                helper={
                  unreadTotal === 0
                    ? "新しいメッセージはありません"
                    : "未読があります"
                }
              />
            </div>
          </div>

          <div style={dashboardCard}>
            <div style={dashboardTitle}>📅 次の試合</div>

            {nextMatch ? (
              <>
                <div style={successBadge}>✅ 試合成立</div>
                <Link href="/match/next" style={nextMatchLink}>
                  <div style={nextMatchDate}>
                    {fmtDate(nextMatch.date)} {fmtTime(nextMatch.start_time)}
                  </div>
                  <div style={nextMatchMeta}>
                    {nextMatch.area_text ?? nextMatch.area ?? "エリア未設定"}
                  </div>
                  <div style={nextMatchMeta}>
                    {categoryLabel(nextMatch.category) ||
                      nextMatch.category ||
                      "カテゴリ未設定"}
                  </div>
                </Link>
              </>
            ) : (
              <div style={emptyActionBox}>
                <div style={mutedText}>まだ試合は成立していません</div>
                <div style={emptyActionRow}>
                  <Link href="/" className="sh-btn">
                    ホームで探す
                  </Link>
                  <Link href="/match/new" className="sh-btn sh-btn--primary">
                    募集する
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>アカウント</h2>
          <Link href="/mypage/account" className="sh-btn sh-btn--primary">
            アカウント編集
          </Link>
        </div>

        <div style={infoGrid}>
          <div style={infoRow}>
            <b>メール</b>
            <span>{me?.email ?? "未設定"}</span>
          </div>

          <div style={infoRow}>
            <b>代表者氏名</b>
            <span>{profile?.name ?? "未設定"}</span>
          </div>

          <div style={infoRow}>
            <b>電話番号</b>
            <span>{profile?.phone ?? "未設定"}</span>
          </div>

          <div style={infoRow}>
            <b>LINE ID</b>
            <span>{profile?.line_id ?? "未設定"}</span>
          </div>

          <div style={infoRow}>
            <b>通知</b>
            <span>アプリ内通知を使用</span>
          </div>
        </div>
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>通知</h2>
        </div>

        <div style={{ display: "grid", gap: 10, color: "#555", lineHeight: 1.8 }}>
          <div>
            チャットやオファーの通知を受け取るには、通知を許可してください。
          </div>

          <PushPermissionButton />
        </div>
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>チーム</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/teams/new" className="sh-btn">
              ＋チーム登録
            </Link>

            {mainTeam ? (
              <Link
                href={`/teams/${mainTeam.id}/edit`}
                className="sh-btn sh-btn--primary"
              >
                チーム編集
              </Link>
            ) : null}
          </div>
        </div>

        {teams.length === 0 ? (
          <div style={{ color: "#666" }}>まだチーム登録がありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {teams.map((team) => {
              const isDeleting = deletingTeamId === team.id;

              return (
                <div key={team.id} style={card}>
                  <div style={cardHead}>
                    <div style={cardTitleArea}>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>
                        {team.name}
                      </div>
                      <div style={subText}>{categoryText(team)}</div>
                    </div>

                    <div style={cardActions}>
                      <Link href={`/teams/${team.id}`} className="sh-btn">
                        詳細
                      </Link>
                      <Link
                        href={`/teams/${team.id}/edit`}
                        className="sh-btn sh-btn--primary"
                      >
                        編集
                      </Link>
                      <button
                        type="button"
                        className="sh-btn"
                        onClick={() => deleteTeam(team)}
                        disabled={isDeleting}
                        style={deleteBtn}
                      >
                        {isDeleting ? "削除中…" : "削除"}
                      </button>
                    </div>
                  </div>

                  <div style={{ color: "#555", marginTop: 10, lineHeight: 1.8 }}>
                    エリア : {areaText(team)}
                    <br />
                    カテゴリ : {categoryText(team)}
                    <br />
                    グラウンド提供 : {team.has_ground ? "あり" : "なし"}
                    <br />
                    ユニフォーム : {team.uniform_main ?? "不明"} /{" "}
                    {team.uniform_sub ?? "不明"} / GK:{" "}
                    {team.uniform_gk ?? "不明"}
                  </div>

                  {categoryMetaEntries(team).length > 0 ? (
                    <div style={metaBox}>
                      <div style={noteTitle}>カテゴリ別設定</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {categoryMetaEntries(team).map(([cat, meta]) => (
                          <div key={cat} style={metaRow}>
                            <div style={{ fontWeight: 800 }}>
                              {categoryLabel(cat) || cat}
                            </div>
                            <div style={{ color: "#555", lineHeight: 1.7 }}>
                              強さ : {meta?.strength_rank || "未設定"}
                              <br />
                              所属人数 : {meta?.member_count ?? "未設定"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={metaBox}>
                      <div style={noteTitle}>カテゴリ別設定</div>
                      <div style={{ color: "#555", lineHeight: 1.7 }}>
                        強さ : {team.strength_rank || rankLabel(team.level)}
                        <br />
                        所属人数 : 未設定
                      </div>
                    </div>
                  )}

                  {team.note?.trim() ? (
                    <div style={noteBox}>
                      <div style={noteTitle}>メモ</div>
                      <div style={noteBody}>{team.note}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>グラウンド</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/venues/new" className="sh-btn">
              ＋グラウンド登録
            </Link>
            <Link href="/venues" className="sh-btn sh-btn--primary">
              グラウンド管理
            </Link>
          </div>
        </div>

        <div style={{ color: "#555", lineHeight: 1.8 }}>
          登録済みグラウンドを管理できます。
          <br />
          今後、募集枠作成時に登録済みグラウンドから選択しやすくなります。
        </div>
      </section>
    </main>
  );
}

function DashboardLinkRow(props: {
  href: string;
  label: string;
  value: number;
  helper?: string;
}) {
  const { href, label, value, helper } = props;

  return (
    <Link href={href} style={dashboardLinkRow}>
      <div style={{ minWidth: 0 }}>
        <div style={dashboardLinkLabel}>{label}</div>
        {helper ? <div style={dashboardLinkHelper}>{helper}</div> : null}
      </div>
      <span style={dashboardLinkValue}>{value}</span>
    </Link>
  );
}

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

const dashboardGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const dashboardCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 10,
};

const dashboardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

const statusList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const dashboardLinkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  textDecoration: "none",
  color: "#111",
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "12px 14px",
};

const dashboardLinkLabel: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const dashboardLinkHelper: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.6,
};

const dashboardLinkValue: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#145c2a",
  whiteSpace: "nowrap",
};

const successBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  marginBottom: 6,
};

const nextMatchLink: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "#111",
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "12px 14px",
};

const nextMatchDate: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#145c2a",
};

const nextMatchMeta: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#666",
  lineHeight: 1.6,
};

const emptyActionBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "12px 14px",
};

const emptyActionRow: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const mutedText: React.CSSProperties = {
  fontSize: 13,
  color: "#666",
  lineHeight: 1.7,
};

const card: React.CSSProperties = {
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 12,
  marginTop: 10,
  background: "#fafafa",
};

const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "nowrap",
};

const cardTitleArea: React.CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
};

const cardActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "flex-start",
  marginLeft: "auto",
  flex: "0 0 auto",
};

const subText: React.CSSProperties = {
  marginTop: 4,
  color: "#66756d",
  fontSize: 13,
  lineHeight: 1.6,
};

const metaBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const metaRow: React.CSSProperties = {
  padding: 8,
  borderRadius: 8,
  background: "#fafafa",
  border: "1px solid #f0f0f0",
};

const noteBox: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const noteTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const noteBody: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
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

const deleteBtn: React.CSSProperties = {
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff",
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