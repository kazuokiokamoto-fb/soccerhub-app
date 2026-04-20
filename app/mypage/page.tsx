"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import PushPermissionButton from "@/app/components/PushPermissionButton";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import type { TeamSchedule } from "@/app/lib/types";

import type {
  ProfileRow,
  TeamRow,
  MatchSlotRow,
  MatchRequestRow,
  MatchOfferRow,
  ChatMemberRow,
  ChatMessageRow,
  NextScheduleCard,
  Toast,
} from "./mypage.types";

import {
  isMissingColumnError,
  rankLabel,
  areaText,
  categoryText,
  categoryMetaEntries,
  fmtTime,
  formatScheduleDate,
  toDateTimeMs,
  scheduleStatusLabel,
  ymdToday,
  toArray,
} from "./mypage.helpers";

import {
  toProfileRow,
  toTeamRow,
  toMatchSlotRow,
  toMatchRequestRow,
  toMatchOfferRow,
  toChatMemberRow,
  toChatMessageRow,
  toTeamSchedule,
} from "./mypage.utils";

import {
  DashboardLinkRow,
  CurrentStatusSection,
  AccountSection,
  NotificationSection,
  TeamSection,
} from "./mypage.blocks";

import {
  pageWrap,
  loadingWrap,
  loadingBox,
  box,
  sectionHead,
  sectionTitle,
  errorTextWrap,
  reloadWrap,
  reloadErrorText,
  toastBox,
  toastSuccess,
  toastError,
  toastInfo,
  toastClose,
} from "./mypage.styles";

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
  const [nextSchedule, setNextSchedule] = useState<NextScheduleCard | null>(null);
  const [scheduleCount, setScheduleCount] = useState(0);

  const loadRunningRef = useRef(false);
  const mountedRef = useRef(true);

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
    if (authLoading || loadRunningRef.current) return;

    loadRunningRef.current = true;

    if (!user) {
      if (mountedRef.current) {
        setProfile(null);
        setTeams([]);
        setOpenCount(0);
        setReceivedOfferCount(0);
        setSentOfferCount(0);
        setUnreadTotal(0);
        setNextSchedule(null);
        setScheduleCount(0);
        setLoadError("");
        setLoading(false);
      }
      loadRunningRef.current = false;
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setLoadError("");
    }

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

      if (mountedRef.current) {
        setProfile(toProfileRow(profileRaw));
      }

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

      if (mountedRef.current) {
        setTeams(loadedTeams);
      }

      const myTeamIds = loadedTeams.map((t) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        if (mountedRef.current) {
          setOpenCount(0);
          setReceivedOfferCount(0);
          setSentOfferCount(0);
          setUnreadTotal(0);
          setNextSchedule(null);
          setScheduleCount(0);
          setLoading(false);
        }
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

      const mySlotRows: MatchSlotRow[] = toArray(mySlotsRaw, toMatchSlotRow);
      const mySlotIds = mySlotRows.map((s) => s.id).filter(Boolean);

      if (mountedRef.current) {
        setOpenCount(mySlotRows.filter((s) => !s.is_closed).length);
      }

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

      const schedulesPromise = supabase
        .from("team_schedules")
        .select(
          [
            "id",
            "team_id",
            "category",
            "opponent",
            "strength",
            "date",
            "venue_name",
            "address",
            "meetup_time",
            "dissolve_time",
            "start_time",
            "end_time",
            "parking",
            "belongings",
            "note",
            "thread_id",
            "status",
            "google_event_id",
            "created_at",
            "updated_at",
          ].join(",")
        )
        .in("team_id", myTeamIds)
        .gte("date", ymdToday())
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      const [
        { data: outgoingRequestsRaw, error: outgoingReqErr },
        { data: incomingRequestsRaw, error: incomingReqErr },
        { data: sentOffersRaw, error: sentOffersErr },
        { data: receivedOffersRaw, error: receivedOffersErr },
        { data: memberRowsRaw, error: memberErr },
        { data: schedulesRaw, error: schedulesErr },
      ] = await Promise.all([
        outgoingReqPromise,
        incomingReqPromise,
        sentOffersPromise,
        receivedOffersPromise,
        chatMembersPromise,
        schedulesPromise,
      ]);

      if (outgoingReqErr) console.error("[mypage] outgoingReq error:", outgoingReqErr);
      if (incomingReqErr) console.error("[mypage] incomingReq error:", incomingReqErr);
      if (sentOffersErr) console.error("[mypage] sentOffers error:", sentOffersErr);
      if (receivedOffersErr) {
        console.error("[mypage] receivedOffers error:", receivedOffersErr);
      }
      if (memberErr) console.error("[mypage] chat_members error:", memberErr);
      if (schedulesErr) console.error("[mypage] team_schedules error:", schedulesErr);

      const outgoingRequestRows: MatchRequestRow[] = toArray(
        outgoingRequestsRaw,
        toMatchRequestRow
      );
      const incomingRequestRows: MatchRequestRow[] = toArray(
        incomingRequestsRaw,
        toMatchRequestRow
      );
      const sentOfferRows: MatchOfferRow[] = toArray(sentOffersRaw, toMatchOfferRow);
      const receivedOfferRows: MatchOfferRow[] = toArray(
        receivedOffersRaw,
        toMatchOfferRow
      );

      const pendingReceivedOffers =
        receivedOfferRows.filter((o) => o.status === "pending").length +
        incomingRequestRows.filter(
          (r) => r.status === "pending" && !myTeamIds.includes(r.requester_team_id)
        ).length;

      const pendingSentOffers =
        sentOfferRows.filter((o) => o.status === "pending").length +
        outgoingRequestRows.filter((r) => r.status === "pending").length;

      if (mountedRef.current) {
        setReceivedOfferCount(pendingReceivedOffers);
        setSentOfferCount(pendingSentOffers);
      }

      const myMemberRows: ChatMemberRow[] = toArray(memberRowsRaw, toChatMemberRow);
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
          if (mountedRef.current) setUnreadTotal(0);
        } else {
          const messages: ChatMessageRow[] = toArray(msgRowsRaw, toChatMessageRow);
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

          if (mountedRef.current) {
            setUnreadTotal(unread);
          }
        }
      } else if (mountedRef.current) {
        setUnreadTotal(0);
      }

      const futureSchedules: TeamSchedule[] = toArray(schedulesRaw, toTeamSchedule)
        .filter((s) => !!s.date)
        .sort((a, b) => {
          const aMs = toDateTimeMs(a.date, a.startTime ?? null);
          const bMs = toDateTimeMs(b.date, b.startTime ?? null);
          return aMs - bMs;
        });

      if (mountedRef.current) {
        setScheduleCount(futureSchedules.length);
      }

      if (futureSchedules.length > 0) {
        const s = futureSchedules[0];

        if (mountedRef.current) {
          setNextSchedule({
            id: s.id,
            date: s.date,
            startTime: s.startTime ?? null,
            endTime: s.endTime ?? null,
            category: s.category ?? null,
            opponent: s.opponent ?? null,
            venueName: s.venueName ?? null,
            address: s.address ?? null,
            status: s.status ?? "draft",
            threadId: s.threadId ?? null,
          });
        }
      } else if (mountedRef.current) {
        setNextSchedule(null);
      }
    } catch (e: any) {
      console.error("[mypage] load error:", e);
      if (mountedRef.current) {
        setLoadError(e?.message ?? "マイページの取得に失敗しました");
        setToast({
          type: "error",
          text: e?.message ?? "マイページの取得に失敗しました",
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      loadRunningRef.current = false;
    }
  }, [authLoading, user]);

  useEffect(() => {
    mountedRef.current = true;
    void load();

    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function existsRow(table: string, column: string, teamId: string) {
    const res = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, teamId);

    if (res.error) throw res.error;
    return (res.count ?? 0) > 0;
  }

  async function canDeleteTeamSafely(teamId: string) {
    const blockers: string[] = [];

    const checks = [
      { label: "募集枠", run: () => existsRow("match_slots", "host_team_id", teamId) },
      { label: "試合申込", run: () => existsRow("match_requests", "requester_team_id", teamId) },
      { label: "送った招待", run: () => existsRow("match_offers", "from_team_id", teamId) },
      { label: "届いた招待", run: () => existsRow("match_offers", "to_team_id", teamId) },
      { label: "チャット参加情報", run: () => existsRow("chat_members", "team_id", teamId) },
      { label: "チャット送信履歴", run: () => existsRow("chat_messages", "sender_team_id", teamId) },
      { label: "チーム予定", run: () => existsRow("team_schedules", "team_id", teamId) },
    ];

    for (const check of checks) {
      try {
        const hit = await check.run();
        if (hit) blockers.push(check.label);
      } catch (e: any) {
        console.error(`delete-check failed: ${check.label}`, e);
        throw new Error(
          `削除前チェックに失敗しました（${check.label}）: ${e?.message ?? "unknown error"}`
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
        "安全のため、募集・申込・招待・チャット履歴・予定データなどの関連データがあるチームは削除できません。"
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
        setToast({ type: "error", text: `チーム削除失敗: ${error.message}` });
        setDeletingTeamId("");
        return;
      }

      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      setToast({ type: "success", text: `✅ 「${team.name}」を削除しました` });

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
      <main style={loadingWrap}>
        <AppTabNav />
        <AppHero
          icon="⚙️"
          title="マイページ"
          desc="アカウント情報、試合状況、チーム情報、グラウンド情報を確認・編集できます。"
        />
        <div style={loadingBox}>Loading...</div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
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
        <div style={errorTextWrap}>ログインが必要です。</div>
      ) : loadError ? (
        <div style={reloadWrap}>
          <div style={reloadErrorText}>{loadError}</div>
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
          <div style={sectionTitle}>現在の状況</div>
        </div>

        <CurrentStatusSection
          openCount={openCount}
          receivedOfferCount={receivedOfferCount}
          sentOfferCount={sentOfferCount}
          unreadTotal={unreadTotal}
          nextSchedule={nextSchedule}
          scheduleCount={scheduleCount}
          formatScheduleDate={formatScheduleDate}
          fmtTime={fmtTime}
          scheduleStatusLabel={scheduleStatusLabel}
        />
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>アカウント</h2>
          <Link href="/mypage/account" className="sh-btn sh-btn--primary">
            アカウント編集
          </Link>
        </div>

        <AccountSection me={me} profile={profile} />
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>通知</h2>
        </div>

        <NotificationSection>
          <PushPermissionButton />
        </NotificationSection>
      </section>

      <section style={box}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>チーム</h2>
        </div>

        <TeamSection
          teams={teams}
          mainTeam={mainTeam}
          deletingTeamId={deletingTeamId}
          deleteTeam={deleteTeam}
          areaText={areaText}
          categoryText={categoryText}
          categoryMetaEntries={categoryMetaEntries}
          rankLabel={rankLabel}
        />
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