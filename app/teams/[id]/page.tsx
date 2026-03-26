"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";

function levelToRankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (!level && level !== 0) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

export default function TeamDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  const threadId = searchParams.get("threadId") ?? "";

  const [team, setTeam] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      setTeam(null);
      setLoading(false);
      return;
    }

    setTeam(data);
    setLoading(false);
  }

  const categoryText = useMemo(() => {
    if (!team) return "未設定";

    if (Array.isArray(team.categories) && team.categories.length > 0) {
      const labels = categoryLabels(team.categories);
      return labels.length > 0 ? labels.join(" / ") : team.categories.join(" / ");
    }

    return categoryLabel(team.category) || team.category || "未設定";
  }, [team]);

  const strengthText = useMemo(() => {
    if (!team) return "未設定";
    if (team.strength_rank) return team.strength_rank;
    const rank = levelToRankLabel(team.level);
    return rank || team.level || "未設定";
  }, [team]);

  const memberCountText = useMemo(() => {
    if (!team) return "不明";
    if (team.roster_by_grade?.TOTAL != null) return team.roster_by_grade.TOTAL;
    if (team.member_count != null) return team.member_count;
    return "不明";
  }, [team]);

  async function requestMatch() {
    if (!id || !team) return;
    if (requesting) return;

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      alert("ログインしてください");
      return;
    }

    setRequesting(true);

    try {
      const { data: myTeam, error: myTeamErr } = await supabase
        .from("teams")
        .select("id,name")
        .eq("owner_id", user.id)
        .single();

      if (myTeamErr || !myTeam) {
        alert("先にチーム登録してください");
        setRequesting(false);
        return;
      }

      if (myTeam.id === id) {
        alert("自分のチームには申込できません");
        setRequesting(false);
        return;
      }

      const { data: slot, error: slotErr } = await supabase
        .from("match_slots")
        .select("id,date,start_time,end_time,category,area,area_text")
        .eq("host_team_id", id)
        .eq("is_closed", false)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1)
        .single();

      if (slotErr || !slot) {
        alert("現在募集している試合がありません");
        setRequesting(false);
        return;
      }

      const { data: existingReq } = await supabase
        .from("match_requests")
        .select("id,status")
        .eq("slot_id", slot.id)
        .eq("requester_team_id", myTeam.id)
        .neq("status", "cancelled")
        .maybeSingle();

      if (existingReq) {
        alert("この募集にはすでに申込済みです");
        setRequesting(false);
        return;
      }

      const { data: request, error } = await supabase
        .from("match_requests")
        .insert({
          slot_id: slot.id,
          requester_team_id: myTeam.id,
          requester_user_id: user.id,
          status: "pending",
          comment: comment.trim() || null,
        })
        .select()
        .single();

      if (error || !request) {
        alert(error?.message ?? "試合申込に失敗しました");
        setRequesting(false);
        return;
      }

      const { data: createdThreadId, error: threadErr } = await supabase.rpc(
        "rpc_get_or_create_dm_thread",
        {
          my_team_id: myTeam.id,
          other_team_id: id,
        }
      );

      if (!threadErr && createdThreadId) {
        const bodyLines = [
          "【試合申込】",
          `${slot.date} ${slot.start_time?.slice(0, 5)}-${slot.end_time?.slice(0, 5)}`,
          `カテゴリ: ${categoryLabel(slot.category) || slot.category || "未設定"}`,
          `エリア: ${slot.area_text ?? slot.area ?? "未設定"}`,
          `申込チーム: ${myTeam.name ?? "未設定"}`,
          `募集チーム: ${team.name ?? "未設定"}`,
          `申込チーム強さ: ${strengthText}`,
          comment.trim() ? `コメント: ${comment.trim()}` : "",
        ].filter(Boolean);

        await supabase.from("chat_messages").insert({
          thread_id: createdThreadId,
          sender_id: user.id,
          sender_team_id: myTeam.id,
          body: bodyLines.join("\n"),
        });

        alert("試合申込しました");
        router.push(`/chat/${createdThreadId}`);
        return;
      }

      alert("試合申込しました");
      router.push("/chat");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "試合申込に失敗しました");
    } finally {
      setRequesting(false);
    }
  }

  if (loading) {
    return (
      <main style={pageWrap}>
        <div style={emptyBox}>読み込み中…</div>
      </main>
    );
  }

  if (!team) {
    return (
      <main style={pageWrap}>
        <div style={emptyBox}>チームが見つかりません</div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={topRow}>
        {threadId ? (
          <Link href={`/chat/${threadId}`} className="sh-btn sh-btn--primary">
            ← チャットへ戻る
          </Link>
        ) : null}

        <Link href="/teams/search" className="sh-btn">
          ← チーム検索へ
        </Link>
      </div>

      <section style={heroBox}>
        <div style={heroTitle}>{team.name}</div>
        <div style={heroSub}>
          {categoryText} / {strengthText}
        </div>
      </section>

      <section style={card}>
        <div style={rowItem}>📍 エリア：{team.area || "未設定"}</div>
        <div style={rowItem}>🏷 カテゴリ：{categoryText}</div>
        <div style={rowItem}>💪 強さ：{strengthText}</div>
        <div style={rowItem}>
          🚲 駐輪場：
          {team.bike_parking || "不明"}
          {team.bike_parking_capacity ? `（${team.bike_parking_capacity}）` : ""}
        </div>
        <div style={rowItem}>
          👕 ユニフォーム：
          {team.uniform_main || "-"} / {team.uniform_sub || "-"} / GK:{" "}
          {team.uniform_gk || "-"}
        </div>
        <div style={rowItem}>👥 人数：{memberCountText}</div>
        {team.note ? <div style={noteBox}>📝 {team.note}</div> : null}
      </section>

      <section style={requestCard}>
        <div style={requestTitle}>このチームに試合申込</div>

        <textarea
          placeholder="コメント（任意）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="sh-textarea"
          style={commentStyle}
          disabled={requesting}
        />

        <button
          onClick={requestMatch}
          className="sh-btn sh-btn--primary"
          style={{ marginTop: 10 }}
          disabled={requesting}
        >
          {requesting ? "申込中…" : "試合申込"}
        </button>
      </section>
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: 20,
};

const topRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const heroBox: React.CSSProperties = {
  borderRadius: 18,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 20,
  boxShadow: "0 10px 28px rgba(20,92,42,0.20)",
};

const heroTitle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.3,
};

const heroSub: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.7,
  fontSize: 14,
};

const card: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  display: "grid",
  gap: 8,
};

const rowItem: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.7,
  color: "#21342a",
};

const noteBox: React.CSSProperties = {
  marginTop: 4,
  padding: 12,
  borderRadius: 12,
  background: "#fafcfb",
  border: "1px solid #edf1ee",
  lineHeight: 1.7,
  color: "#374151",
};

const requestCard: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const requestTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  marginBottom: 10,
};

const commentStyle: React.CSSProperties = {
  minHeight: 110,
};

const emptyBox: React.CSSProperties = {
  marginTop: 20,
  textAlign: "center",
  color: "#666",
  padding: 24,
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
};