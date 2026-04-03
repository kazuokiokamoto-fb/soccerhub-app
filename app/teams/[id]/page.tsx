"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";

type TeamOption = {
  id: string;
  name: string | null;
  category: string | null;
};

function levelToRankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (!level && level !== 0) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function buildCarryQuery(params: {
  from?: string | null;
  threadId?: string | null;
  slotId?: string | null;
  date?: string | null;
}) {
  const qs = new URLSearchParams();

  if (params.from) qs.set("from", params.from);
  if (params.threadId) qs.set("threadId", params.threadId);
  if (params.slotId) qs.set("slotId", params.slotId);
  if (params.date) qs.set("date", params.date);

  return qs.toString();
}

function getBackLink(params: {
  from?: string | null;
  threadId?: string | null;
  slotId?: string | null;
  date?: string | null;
}) {
  const { from, threadId, slotId, date } = params;

  switch (from) {
    case "match-calendar": {
      const qs = new URLSearchParams();
      if (date) qs.set("date", date);
      if (slotId) qs.set("slotId", slotId);

      return {
        href: qs.toString() ? `/match?${qs.toString()}` : "/match",
        label: "← 試合を探すに戻る",
      };
    }

    case "sent-offers":
      return {
        href: "/match/status/offers",
        label: "← 送ったオファーへ",
      };

    case "received-offers":
      return {
        href: "/match/status/offers-received",
        label: "← 届いたオファーへ",
      };

    case "chat-list":
      return {
        href: "/chat",
        label: "← 一覧へ",
      };

    default:
      if (threadId) {
        const qs = new URLSearchParams();
        if (from) qs.set("from", from);
        if (slotId) qs.set("slotId", slotId);
        if (date) qs.set("date", date);

        return {
          href: qs.toString() ? `/chat/${threadId}?${qs.toString()}` : `/chat/${threadId}`,
          label: "← チャットへ戻る",
        };
      }

      return {
        href: "/teams/search",
        label: "← チーム検索へ",
      };
  }
}

export default function TeamDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  const threadId = searchParams.get("threadId") ?? "";
  const from = searchParams.get("from");
  const slotId = searchParams.get("slotId");
  const date = searchParams.get("date");

  const carriedQueryString = useMemo(
    () =>
      buildCarryQuery({
        from,
        threadId,
        slotId,
        date,
      }),
    [from, threadId, slotId, date]
  );

  const backLink = useMemo(
    () =>
      getBackLink({
        from,
        threadId,
        slotId,
        date,
      }),
    [from, threadId, slotId, date]
  );

  const [team, setTeam] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const [meId, setMeId] = useState("");
  const [myTeams, setMyTeams] = useState<TeamOption[]>([]);
  const [selectedMyTeamId, setSelectedMyTeamId] = useState("");

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    if (!id) return;

    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? "";
      setMeId(userId);

      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        setTeam(null);
      } else {
        setTeam(data);
      }

      if (userId) {
        const { data: ownTeams, error: ownTeamsErr } = await supabase
          .from("teams")
          .select("id,name,category")
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false });

        if (ownTeamsErr) {
          console.error(ownTeamsErr);
          setMyTeams([]);
          setSelectedMyTeamId("");
        } else {
          const rows = (ownTeams ?? []) as TeamOption[];
          setMyTeams(rows);

          const firstAvailable =
            rows.find((t) => t.id !== id)?.id ?? rows[0]?.id ?? "";

          setSelectedMyTeamId(firstAvailable);
        }
      } else {
        setMyTeams([]);
        setSelectedMyTeamId("");
      }
    } finally {
      setLoading(false);
    }
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

  const selectedMyTeam = useMemo(() => {
    return myTeams.find((t) => t.id === selectedMyTeamId) ?? null;
  }, [myTeams, selectedMyTeamId]);

  async function openDirectChat() {
    if (!id || !team || openingChat) return;

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      alert("ログインしてください");
      return;
    }

    setOpeningChat(true);

    try {
      let myTeamId = selectedMyTeamId;

      if (!myTeamId) {
        const fallbackTeamId =
          myTeams.find((t) => t.id !== id)?.id ?? myTeams[0]?.id ?? "";

        myTeamId = fallbackTeamId;
      }

      if (!myTeamId) {
        alert("先にチーム登録してください");
        return;
      }

      if (myTeamId === id) {
        alert("自分のチームとのチャットは開けません");
        return;
      }

      const { data: createdThreadId, error: threadErr } = await supabase.rpc(
        "rpc_get_or_create_dm_thread",
        {
          my_team_id: myTeamId,
          other_team_id: id,
        }
      );

      if (threadErr || !createdThreadId) {
        console.error(threadErr);
        alert(threadErr?.message ?? "チャットを開けませんでした");
        return;
      }

      const nextQs = buildCarryQuery({
        from: from ?? "chat-list",
        threadId: null,
        slotId,
        date,
      });

      router.push(
        nextQs ? `/chat/${createdThreadId}?${nextQs}` : `/chat/${createdThreadId}`
      );
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "チャットを開けませんでした");
    } finally {
      setOpeningChat(false);
    }
  }

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
      let myTeamId = selectedMyTeamId;

      if (!myTeamId) {
        const fallbackTeamId =
          myTeams.find((t) => t.id !== id)?.id ?? myTeams[0]?.id ?? "";

        myTeamId = fallbackTeamId;
      }

      if (!myTeamId) {
        alert("先にチーム登録してください");
        return;
      }

      const myTeam = myTeams.find((t) => t.id === myTeamId) ?? null;

      if (!myTeam) {
        alert("申込チームを選択してください");
        return;
      }

      if (myTeam.id === id) {
        alert("自分のチームには申込できません");
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
          comment.trim() ? `コメント: ${comment.trim()}` : "",
        ].filter(Boolean);

        const { error: msgErr } = await supabase.from("chat_messages").insert({
          thread_id: createdThreadId,
          sender_id: user.id,
          sender_team_id: myTeam.id,
          body: bodyLines.join("\n"),
        });

        if (msgErr) {
          console.error(msgErr);
        }

        alert("試合申込しました");

        const nextQs = buildCarryQuery({
          from: from ?? "match-calendar",
          threadId: null,
          slotId: slot.id,
          date: slot.date,
        });

        router.push(
          nextQs ? `/chat/${createdThreadId}?${nextQs}` : `/chat/${createdThreadId}`
        );
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

  const chatBackHref =
    threadId
      ? `/chat/${threadId}${carriedQueryString ? `?${carriedQueryString}` : ""}`
      : "";

  return (
    <main style={pageWrap}>
      <div style={topRow}>
        <Link href={backLink.href} className="sh-btn sh-btn--primary">
          {backLink.label}
        </Link>

        {threadId ? (
          <Link href={chatBackHref} className="sh-btn">
            ← チャットへ戻る
          </Link>
        ) : null}

        <Link href="/teams/search" className="sh-btn">
          ← チーム検索へ
        </Link>

        <button
          type="button"
          onClick={openDirectChat}
          className="sh-btn"
          disabled={openingChat}
        >
          {openingChat ? "チャットを開いています…" : "チャットする"}
        </button>
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

        <label style={fieldLabel}>
          <span style={fieldTitle}>申込元チーム</span>
          <select
            value={selectedMyTeamId}
            onChange={(e) => setSelectedMyTeamId(e.target.value)}
            className="sh-select"
            style={selectStyle}
            disabled={requesting || myTeams.length === 0}
          >
            {myTeams.length === 0 ? (
              <option value="">チーム未登録</option>
            ) : (
              myTeams
                .filter((t) => t.id !== id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? "チーム未設定"}
                    {t.category
                      ? `（${categoryLabel(t.category) || t.category}）`
                      : ""}
                  </option>
                ))
            )}
          </select>
        </label>

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

        {myTeams.length === 0 ? (
          <div style={hintText}>
            試合申込には、先に自分のチーム登録が必要です。
          </div>
        ) : null}

        {myTeams.length > 0 && !selectedMyTeam ? (
          <div style={hintText}>
            申込元に使う自分のチームを選択してください。
          </div>
        ) : null}
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

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 12,
};

const fieldTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
};

const commentStyle: React.CSSProperties = {
  minHeight: 110,
};

const hintText: React.CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.7,
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