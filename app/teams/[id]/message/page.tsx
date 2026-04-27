"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";

type Role = "owner" | "coach" | "member";

type TeamRow = {
  id: string;
  name: string | null;
  owner_id: string | null;
};

type MemberRow = {
  team_id: string;
  user_id: string;
  role: Role;
  display_name: string | null;
};

type MessageRow = {
  id: string;
  team_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function isRole(v: string): v is Role {
  return v === "owner" || v === "coach" || v === "member";
}

function roleLabel(role: Role) {
  if (role === "owner") return "管理者";
  if (role === "coach") return "コーチ";
  return "メンバー";
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(
    2,
    "0"
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TeamMessagePage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const slotId = searchParams.get("slotId") || "";

  const teamId = useMemo(() => {
    const raw = params?.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return "";
  }, [params]);

  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [bodyTouched, setBodyTouched] = useState(false);
  const [myRole, setMyRole] = useState<Role | "">("");

  const canView = !!myRole;

  const load = async () => {
    if (!teamId || authLoading) return;

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      const { data: teamRaw, error: teamError } = await supabase
        .from("teams")
        .select("id,name,owner_id")
        .eq("id", teamId)
        .maybeSingle();

      if (teamError) throw teamError;

      if (!teamRaw) {
        setTeam(null);
        setMembers([]);
        setMessages([]);
        setMyRole("");
        setErrorText("チームが見つかりません");
        return;
      }

      const nextTeam: TeamRow = {
        id: String(teamRaw.id),
        name: typeof teamRaw.name === "string" ? teamRaw.name : null,
        owner_id:
          typeof teamRaw.owner_id === "string" ? teamRaw.owner_id : null,
      };

      setTeam(nextTeam);

      const { data: membersRaw, error: membersError } = await supabase
        .from("team_members")
        .select("team_id,user_id,role,display_name")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      const nextMembers: MemberRow[] = [];

      if (nextTeam.owner_id) {
        nextMembers.push({
          team_id: teamId,
          user_id: nextTeam.owner_id,
          role: "owner",
          display_name: "チーム管理者",
        });
      }

      if (Array.isArray(membersRaw)) {
        for (const r of membersRaw as any[]) {
          const role = String(r.role ?? "");
          const uid = String(r.user_id ?? "");

          if (!uid || !isRole(role)) continue;
          if (nextMembers.some((m) => m.user_id === uid)) continue;

          nextMembers.push({
            team_id: String(r.team_id ?? teamId),
            user_id: uid,
            role,
            display_name:
              typeof r.display_name === "string" ? r.display_name : null,
          });
        }
      }

      setMembers(nextMembers);

      let nextMyRole: Role | "" = "";

      if (nextTeam.owner_id === userId) {
        nextMyRole = "owner";
      } else {
        const mine = nextMembers.find((m) => m.user_id === userId);
        nextMyRole = mine?.role ?? "";
      }

      setMyRole(nextMyRole);

      if (!nextMyRole) {
        setMessages([]);
        return;
      }

      const { data: messagesRaw, error: messagesError } = await supabase
        .from("team_messages")
        .select("id,team_id,sender_id,body,created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (messagesError) throw messagesError;

      const nextMessages: MessageRow[] = Array.isArray(messagesRaw)
        ? messagesRaw.map((m: any) => ({
            id: String(m.id),
            team_id: String(m.team_id),
            sender_id: String(m.sender_id),
            body: String(m.body ?? ""),
            created_at: String(m.created_at ?? ""),
          }))
        : [];

      setMessages(nextMessages);
    } catch (e: any) {
      console.error(e);
      setTeam(null);
      setMembers([]);
      setMessages([]);
      setMyRole("");
      setErrorText(e?.message ?? "チーム連絡の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [teamId, userId, authLoading]);

  useEffect(() => {
    if (!slotId) return;
    if (bodyTouched) return;
    if (body.trim()) return;

    setBody(
      [
        "【試合連絡】",
        "集合時間：",
        "持ち物：",
        "連絡事項：",
      ].join("\n")
    );
  }, [slotId, bodyTouched, body]);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const m of members) {
      map.set(m.user_id, m.display_name?.trim() || `ユーザー ${m.user_id.slice(0, 8)}`);
    }

    return map;
  }, [members]);

  const sendMessage = async () => {
    const text = body.trim();

    if (!text) {
      alert("メッセージを入力してください");
      return;
    }

    if (!userId || !teamId || !canView) {
      alert("送信権限がありません");
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.from("team_messages").insert({
        team_id: teamId,
        sender_id: userId,
        body: text,
      });

      if (error) throw error;

      setBody("");
      await load();
    } catch (e: any) {
      console.error(e);
      alert(`送信に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="💬"
        title="チーム連絡"
        desc="チーム内の連絡事項をメンバー全員で確認できます。"
      />

      <div style={topNavWrap}>
        <Link href={`/teams/${teamId}`} className="sh-btn">
          チーム詳細へ戻る
        </Link>

        <Link href={`/teams/${teamId}/members`} className="sh-btn">
          メンバー管理
        </Link>

        <Link href="/match/my-schedule" className="sh-btn sh-btn--primary">
          マイスケジュール
        </Link>
      </div>

      {loading || authLoading ? (
        <div style={emptyBox}>読み込み中…</div>
      ) : errorText ? (
        <div style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{errorText}</div>
        </div>
      ) : !userId ? (
        <div style={emptyBox}>ログイン後に表示されます</div>
      ) : !team ? (
        <div style={emptyBox}>チームが見つかりません</div>
      ) : !canView ? (
        <div style={emptyBox}>このチームのメンバーのみ閲覧できます</div>
      ) : (
        <>
          <section style={panel}>
            <div style={panelTitle}>{team.name || "チーム"} の連絡板</div>
            <div style={panelDesc}>
              あなたの権限：{roleLabel(myRole)}
            </div>
            {slotId ? (
              <div style={matchNotice}>
                この試合について連絡中
              </div>
            ) : null}
          </section>

          <section style={sendBox}>
            <textarea
              value={body}
              onChange={(e) => {
                setBodyTouched(true);
                setBody(e.target.value);
              }}
              placeholder="例：集合時間、持ち物、出欠締切などを共有できます。"
              style={textarea}
              rows={4}
            />

            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={sendMessage}
              disabled={sending}
            >
              {sending ? "送信中…" : "送信する"}
            </button>
          </section>

          <section style={listBox}>
            <div style={sectionTitle}>連絡履歴</div>

            {messages.length === 0 ? (
              <div style={miniEmpty}>まだ連絡はありません</div>
            ) : (
              <div style={messageList}>
                {messages.map((m) => {
                  const mine = m.sender_id === userId;

                  return (
                    <div key={m.id} style={messageCard}>
                      <div style={messageHead}>
                        <span style={messageName}>
                          {memberNameMap.get(m.sender_id) ||
                            `ユーザー ${m.sender_id.slice(0, 8)}`}
                        </span>
                        <span style={messageDate}>
                          {formatDateTime(m.created_at)}
                          {mine ? " / 自分" : ""}
                        </span>
                      </div>

                      <div style={messageBody}>{m.body}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

const topNavWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  lineHeight: 1.7,
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};

const panel: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const panelTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const panelDesc: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#3b6a49",
  lineHeight: 1.7,
};

const sendBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fff",
  display: "grid",
  gap: 10,
};

const textarea: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  fontSize: 14,
  lineHeight: 1.7,
  resize: "vertical",
};

const listBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#16391f",
};

const miniEmpty: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  background: "#f9fafb",
  color: "#6b7280",
  textAlign: "center",
};

const messageList: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const messageCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
};

const messageHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const messageName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#14532d",
};

const messageDate: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
};

const messageBody: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  color: "#111827",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
};

const matchNotice: React.CSSProperties = {
  marginTop: 8,
  padding: "8px 10px",
  borderRadius: 12,
  background: "#eef6f0",
  color: "#14532d",
  fontSize: 13,
  fontWeight: 900,
};