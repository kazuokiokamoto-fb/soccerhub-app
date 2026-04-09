"use client";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";
import PushPermissionButton from "@/app/components/PushPermissionButton";

/* =========================
  型定義
========================= */

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
  category_meta?: Record<string, any> | null;
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
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  status: string;
};

type MatchOfferRow = {
  id: string;
  slot_id: string | null;
  from_team_id: string;
  to_team_id: string;
  status: string;
};

type NextMatchCard = {
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
};

/* =========================
  Utils
========================= */

function toMs(date?: string, time?: string) {
  if (!date || !time) return 0;
  return new Date(`${date}T${time}`).getTime();
}

function rankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

/* =========================
  本体
========================= */

export default function MyPage() {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [openCount, setOpenCount] = useState(0);
  const [receivedOfferCount, setReceivedOfferCount] = useState(0);
  const [sentOfferCount, setSentOfferCount] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [nextMatch, setNextMatch] = useState<NextMatchCard | null>(null);

  const reloadTimer = useRef<NodeJS.Timeout | null>(null);

  /* =========================
    load（安定版）
  ========================= */

  const load = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const userId = user.id;

      // プロフィール
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      setProfile(profileRow ?? null);

      // チーム
      const { data: teamRows } = await supabase
        .from("teams")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

      const myTeams = (teamRows ?? []) as TeamRow[];
      setTeams(myTeams);

      const myTeamIds = myTeams.map((t) => t.id);

      if (myTeamIds.length === 0) {
        setLoading(false);
        return;
      }

      // スロット
      const { data: slots } = await supabase
        .from("match_slots")
        .select("*")
        .in("host_team_id", myTeamIds);

      const slotRows = (slots ?? []) as MatchSlotRow[];

      setOpenCount(slotRows.filter((s) => !s.is_closed).length);

      const slotIds = slotRows.map((s) => s.id);

      // 申込
      const { data: requests } = await supabase
        .from("match_requests")
        .select("*");

      const reqRows = (requests ?? []) as MatchRequestRow[];

      const incoming = reqRows.filter((r) => slotIds.includes(r.slot_id));
      const outgoing = reqRows.filter((r) =>
        myTeamIds.includes(r.requester_team_id)
      );

      setReceivedOfferCount(
        incoming.filter((r) => r.status === "pending").length
      );

      setSentOfferCount(
        outgoing.filter((r) => r.status === "pending").length
      );

      // 次の試合
      const acceptedIds = reqRows
        .filter((r) => r.status === "accepted")
        .map((r) => r.slot_id);

      const { data: acceptedSlots } = await supabase
        .from("match_slots")
        .select("*")
        .in("id", acceptedIds);

      const future = (acceptedSlots ?? [])
        .filter((s) => toMs(s.date, s.start_time) > Date.now())
        .sort((a, b) => toMs(a.date, a.start_time) - toMs(b.date, b.start_time));

      if (future.length > 0) {
        const s = future[0];
        setNextMatch({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          area: s.area,
          area_text: s.area_text,
          category: s.category,
        });
      } else {
        setNextMatch(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  /* =========================
    初期ロード
  ========================= */

  useEffect(() => {
    void load();
  }, [load]);

  /* =========================
    Realtime（debounce付き）
  ========================= */

  useEffect(() => {
    if (!user?.id) return;

    const triggerReload = () => {
      if (reloadTimer.current) {
        clearTimeout(reloadTimer.current);
      }
      reloadTimer.current = setTimeout(() => {
        void load();
      }, 800);
    };

    const channel = supabase
      .channel("mypage")
      .on("postgres_changes", { event: "*", schema: "public" }, triggerReload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  /* =========================
    UI
  ========================= */

  if (authLoading || loading) {
    return <div>Loading...</div>;
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <AppTabNav />

      <AppHero
        icon="⚙️"
        title="マイページ"
        desc="試合状況・チーム管理"
      />

      <section>
        <h2>📊 状況</h2>
        <div>募集中：{openCount}</div>
        <div>届いた：{receivedOfferCount}</div>
        <div>送った：{sentOfferCount}</div>
      </section>

      <section>
        <h2>📅 次の試合</h2>
        {nextMatch ? (
          <div>
            {nextMatch.date} {nextMatch.start_time}
            <br />
            {nextMatch.area_text ?? nextMatch.area}
            <br />
            {categoryLabel(nextMatch.category)}
          </div>
        ) : (
          <div>まだありません</div>
        )}
      </section>

      <section>
        <h2>👥 チーム</h2>
        {teams.map((t) => (
          <div key={t.id}>
            {t.name} / {rankLabel(t.level)}
          </div>
        ))}
      </section>

      <PushPermissionButton />
    </main>
  );
}