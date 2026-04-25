"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { useSearchParams } from "next/navigation";

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

function normalizeTime(v: string) {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{1}:\d{2}$/.test(s)) return `0${s}:00`;
  return null;
}

export default function NewMySchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const defaultTeamId = searchParams.get("teamId") ?? "";
  const defaultDate = searchParams.get("date") ?? todayYmd();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [errorText, setErrorText] = useState("");

  const [teamId, setTeamId] = useState(defaultTeamId);
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState("");
  const [opponent, setOpponent] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [meetupTime, setMeetupTime] = useState("");
  const [dissolveTime, setDissolveTime] = useState("");
  const [parking, setParking] = useState("");
  const [belongings, setBelongings] = useState("");
  const [note, setNote] = useState("");

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === teamId) ?? null,
    [teams, teamId]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (authLoading) return;

      if (!user?.id) {
        setLoading(false);
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
        setTeamId(firstTeamId);

        const firstTeam = rows.find((t) => t.id === firstTeamId) ?? rows[0];
        setCategory(firstTeam?.category ?? "");
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
  }, [authLoading, user?.id, defaultTeamId]);

  useEffect(() => {
    if (selectedTeam?.category && !category) {
      setCategory(selectedTeam.category);
    }
  }, [selectedTeam, category]);

  async function save() {
    if (!user?.id) {
      alert("ログインが必要です");
      return;
    }

    if (!teamId) {
      alert("チームを選択してください");
      return;
    }

    if (!date) {
      alert("日付を入力してください");
      return;
    }

    if (!opponent.trim()) {
      alert("対戦相手を入力してください");
      return;
    }

    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = normalizeTime(endTime);
    const normalizedMeetup = normalizeTime(meetupTime);
    const normalizedDissolve = normalizeTime(dissolveTime);

    if (startTime.trim() && !normalizedStart) {
      alert("開始時間は 13:00 の形式で入力してください");
      return;
    }

    if (endTime.trim() && !normalizedEnd) {
      alert("終了時間は 15:00 の形式で入力してください");
      return;
    }

    if (meetupTime.trim() && !normalizedMeetup) {
      alert("集合時間は 12:30 の形式で入力してください");
      return;
    }

    if (dissolveTime.trim() && !normalizedDissolve) {
      alert("解散時間は 15:30 の形式で入力してください");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        team_id: teamId,
        category: category.trim() || selectedTeam?.category || "",
        opponent: opponent.trim(),
        strength: null,
        date,
        start_time: normalizedStart,
        end_time: normalizedEnd,
        meetup_time: normalizedMeetup,
        dissolve_time: normalizedDissolve,
        venue_name: venueName.trim() || null,
        address: address.trim() || null,
        parking: parking.trim() || null,
        belongings: belongings.trim() || null,
        note: note.trim() || null,
        thread_id: null,
        status: "draft",
        opponent_team_id: null,
        external_opponent_name: opponent.trim(),
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
        desc="サカまっちを使っていない相手との練習試合も、マイスケジュールに登録できます。"
      />

      <div style={topNav}>
        <Link href="/match/my-schedule" className="sh-btn">
          ← 予定一覧へ
        </Link>
      </div>

      {errorText ? (
        <div style={errorBox}>
          <b>読み込みエラー</b>
          <br />
          {errorText}
        </div>
      ) : null}

      <section style={formBox}>
        <div style={field}>
          <label style={label}>自チーム</label>
          <select
            value={teamId}
            onChange={(e) => {
              const nextId = e.target.value;
              setTeamId(nextId);
              const nextTeam = teams.find((t) => t.id === nextId);
              setCategory(nextTeam?.category ?? "");
            }}
            style={input}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div style={field}>
          <label style={label}>対戦相手</label>
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="例：○○FC"
            style={input}
          />
        </div>

        <div style={row2}>
          <div style={field}>
            <label style={label}>日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={field}>
            <label style={label}>カテゴリ</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="例：U-12"
              style={input}
            />
          </div>
        </div>

        <div style={row2}>
          <div style={field}>
            <label style={label}>開始時間</label>
            <input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="13:00"
              style={input}
            />
          </div>

          <div style={field}>
            <label style={label}>終了時間</label>
            <input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="15:00"
              style={input}
            />
          </div>
        </div>

        <div style={row2}>
          <div style={field}>
            <label style={label}>集合時間</label>
            <input
              value={meetupTime}
              onChange={(e) => setMeetupTime(e.target.value)}
              placeholder="12:30"
              style={input}
            />
          </div>

          <div style={field}>
            <label style={label}>解散時間</label>
            <input
              value={dissolveTime}
              onChange={(e) => setDissolveTime(e.target.value)}
              placeholder="15:30"
              style={input}
            />
          </div>
        </div>

        <div style={field}>
          <label style={label}>会場名</label>
          <input
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="例：足立区○○グラウンド"
            style={input}
          />
        </div>

        <div style={field}>
          <label style={label}>住所</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例：東京都足立区..."
            style={input}
          />
        </div>

        <div style={field}>
          <label style={label}>駐車場・駐輪場</label>
          <input
            value={parking}
            onChange={(e) => setParking(e.target.value)}
            placeholder="例：駐車場なし、駐輪場あり"
            style={input}
          />
        </div>

        <div style={field}>
          <label style={label}>持ち物</label>
          <input
            value={belongings}
            onChange={(e) => setBelongings(e.target.value)}
            placeholder="例：ユニフォーム白、ボール、ビブス"
            style={input}
          />
        </div>

        <div style={field}>
          <label style={label}>メモ</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="共有事項や注意点"
            style={textarea}
          />
        </div>

        <div style={actions}>
          <Link href="/match/my-schedule" className="sh-btn">
            キャンセル
          </Link>

          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "保存中…" : "予定を保存"}
          </button>
        </div>
      </section>
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: 16,
};

const topNav: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const box: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 14,
  background: "#fff",
  border: "1px solid #e5e7eb",
};

const errorBox: React.CSSProperties = {
  ...box,
  color: "#991b1b",
  lineHeight: 1.7,
};

const formBox: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 16,
  background: "#fff",
  border: "1px solid #e5ece7",
  display: "grid",
  gap: 14,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const label: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 16,
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 96,
  resize: "vertical",
  lineHeight: 1.6,
};

const row2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const actions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 4,
};