"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import ScheduleForm, {
  type ScheduleFormValues,
} from "@/app/match/my-schedule/components/ScheduleForm";

type TeamRow = {
  id: string;
  name: string;
  category: string | null;
};

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeTime(v?: string | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{1}:\d{2}$/.test(s)) return `0${s}:00`;
  return null;
}

function NewMyScheduleInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const defaultTeamId = searchParams.get("teamId") ?? "";
  const defaultDate = searchParams.get("date") ?? todayYmd();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [errorText, setErrorText] = useState("");

  const [initialValues, setInitialValues] = useState<ScheduleFormValues>({
    teamId: defaultTeamId,
    opponentName: "",
    date: defaultDate,
    category: "",
    startTime: "",
    endTime: "",
    meetupTime: "",
    dissolveTime: "",
    venueName: "",
    address: "",
    strength: "",
    parking: "",
    belongings: "",
    note: "",
  });

  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        category: team.category,
      })),
    [teams]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (authLoading) return;

      if (!user?.id) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const { data, error } = await supabase
          .from("teams")
          .select("id,name,category")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const rows = ((data ?? []) as TeamRow[]).filter(Boolean);

        if (!active) return;

        setTeams(rows);

        const firstTeamId = defaultTeamId || rows[0]?.id || "";
        const firstTeam = rows.find((t) => t.id === firstTeamId) ?? rows[0];

        setInitialValues((prev) => ({
          ...prev,
          teamId: firstTeamId,
          date: defaultDate,
          category: firstTeam?.category ?? "",
        }));
      } catch (e: any) {
        console.error(e);
        if (!active) return;
        setErrorText(e?.message ?? "チーム情報の取得に失敗しました");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, defaultTeamId, defaultDate]);

  async function save(values: ScheduleFormValues) {
    if (!user?.id) {
      alert("ログインが必要です");
      return;
    }

    if (!values.teamId) {
      alert("チームを選択してください");
      return;
    }

    if (!values.date) {
      alert("日付を入力してください");
      return;
    }

    if (!values.opponentName.trim()) {
      alert("対戦相手を入力してください");
      return;
    }

    const selectedTeam = teams.find((t) => t.id === values.teamId) ?? null;

    const normalizedStart = normalizeTime(values.startTime);
    const normalizedEnd = normalizeTime(values.endTime);
    const normalizedMeetup = normalizeTime(values.meetupTime);
    const normalizedDissolve = normalizeTime(values.dissolveTime);

    setSaving(true);

    try {
      const payload = {
        team_id: values.teamId,
        category: values.category.trim() || selectedTeam?.category || "",
        opponent: values.opponentName.trim(),
        strength: values.strength || null,
        date: values.date,
        start_time: normalizedStart,
        end_time: normalizedEnd,
        meetup_time: normalizedMeetup,
        dissolve_time: normalizedDissolve,
        venue_name: values.venueName || null,
        address: values.address || null,
        parking: values.parking || null,
        belongings: values.belongings || null,
        note: values.note || null,
        thread_id: null,
        status: "draft",
        proposal_id: null,
        opponent_team_id: null,
        external_opponent_name: values.opponentName.trim(),
        created_by_user_id: user.id,
        source: "manual",
      };

      const { error } = await supabase.from("team_schedules").insert(payload);

      if (error) throw error;

      window.location.href = "/match/my-schedule";
    } catch (e: any) {
      console.error(e);
      alert(`予定作成に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main style={pageWrap}>
        <AppTabNav />
        <AppHero icon="🗓" title="予定作成" desc="予定を読み込み中です。" />
        <div style={box}>読み込み中…</div>
      </main>
    );
  }

  if (!user?.id) {
    return (
      <main style={pageWrap}>
        <AppTabNav />
        <AppHero icon="🗓" title="予定作成" desc="ログインが必要です。" />
        <div style={box}>
          <Link href="/login" className="sh-btn sh-btn--primary">
            ログインする
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🗓"
        title="予定作成"
        desc="サカまっちを使っていない相手との練習試合も登録できます。"
      />

      <div style={topNav}>
        <Link href="/match/my-schedule" className="sh-btn">
          ← 予定一覧
        </Link>
      </div>

      {errorText && (
        <div style={errorBox}>
          <b>読み込みエラー</b>
          <br />
          {errorText}
        </div>
      )}

      <ScheduleForm
        initialValues={initialValues}
        loading={saving}
        submitLabel="予定を保存"
        onCancel={() => {
          window.location.href = "/match/my-schedule";
        }}
        onSubmit={(values) => void save(values)}
      />
    </main>
  );
}

export default function NewMySchedulePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewMyScheduleInner />
    </Suspense>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: 16,
};

const topNav: React.CSSProperties = {
  marginTop: 12,
};

const box: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 14,
  background: "#fff",
};

const errorBox: React.CSSProperties = {
  ...box,
  color: "#991b1b",
};