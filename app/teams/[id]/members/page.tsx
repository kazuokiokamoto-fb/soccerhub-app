"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";

type Role = "owner" | "coach" | "member";
type InviteRole = "coach" | "member";

type TeamRow = {
  id: string;
  name: string | null;
  owner_id: string | null;
};

type MemberRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: Role;
  display_name: string | null;
  created_at: string;
};

type InviteRow = {
  id: string;
  team_id: string;
  code: string;
  role: InviteRole;
  display_name: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
};

function roleLabel(role: Role | InviteRole) {
  if (role === "owner") return "管理者";
  if (role === "coach") return "コーチ";
  return "メンバー";
}

function isRole(v: string): v is Role {
  return v === "owner" || v === "coach" || v === "member";
}

function isInviteRole(v: string): v is InviteRole {
  return v === "coach" || v === "member";
}

function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function formatDateTime(value: string | null) {
  if (!value) return "期限なし";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "期限なし";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TeamMembersPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const teamId = useMemo(() => {
    const raw = params?.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return "";
  }, [params]);

  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [myRole, setMyRole] = useState<Role | "">("");

  const [newUserId, setNewUserId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");

  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteDays, setInviteDays] = useState("14");

  const canManage = myRole === "owner" || myRole === "coach";
  const canManageOwner = myRole === "owner";

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
        setInvites([]);
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

      let nextMyRole: Role | "" = "";

      if (nextTeam.owner_id === userId) {
        nextMyRole = "owner";
      } else {
        const { data: myMemberRaw, error: myMemberError } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", teamId)
          .eq("user_id", userId)
          .maybeSingle();

        if (myMemberError) throw myMemberError;

        const role =
          myMemberRaw && typeof myMemberRaw.role === "string"
            ? myMemberRaw.role
            : "";

        if (isRole(role)) nextMyRole = role;
      }

      setMyRole(nextMyRole);

      const { data: membersRaw, error: membersError } = await supabase
        .from("team_members")
        .select("id,team_id,user_id,role,display_name,created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      const rows: MemberRow[] = Array.isArray(membersRaw)
        ? membersRaw
            .map((r: any) => {
              const role = String(r.role ?? "");
              if (!isRole(role)) return null;

              return {
                id: String(r.id),
                team_id: String(r.team_id),
                user_id: String(r.user_id),
                role,
                display_name:
                  typeof r.display_name === "string" ? r.display_name : null,
                created_at: String(r.created_at ?? ""),
              };
            })
            .filter((v): v is MemberRow => v !== null)
        : [];

      const hasOwnerRow = rows.some((m) => m.user_id === nextTeam.owner_id);

      if (nextTeam.owner_id && !hasOwnerRow) {
        rows.unshift({
          id: "owner-virtual",
          team_id: teamId,
          user_id: nextTeam.owner_id,
          role: "owner",
          display_name: "チーム管理者",
          created_at: "",
        });
      }

      setMembers(rows);

      const { data: invitesRaw, error: invitesError } = await supabase
        .from("team_invites")
        .select(
          "id,team_id,code,role,display_name,expires_at,max_uses,used_count,is_active,created_at"
        )
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

      if (invitesError) throw invitesError;

      const inviteRows: InviteRow[] = Array.isArray(invitesRaw)
        ? invitesRaw
            .map((r: any) => {
              const role = String(r.role ?? "");
              if (!isInviteRole(role)) return null;

              return {
                id: String(r.id),
                team_id: String(r.team_id),
                code: String(r.code ?? ""),
                role,
                display_name:
                  typeof r.display_name === "string" ? r.display_name : null,
                expires_at:
                  typeof r.expires_at === "string" ? r.expires_at : null,
                max_uses:
                  typeof r.max_uses === "number" ? r.max_uses : null,
                used_count:
                  typeof r.used_count === "number" ? r.used_count : 0,
                is_active: Boolean(r.is_active),
                created_at: String(r.created_at ?? ""),
              };
            })
            .filter((v): v is InviteRow => v !== null)
        : [];

      setInvites(inviteRows);
    } catch (e: any) {
      console.error(e);
      setTeam(null);
      setMembers([]);
      setInvites([]);
      setMyRole("");
      setErrorText(e?.message ?? "メンバー情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [teamId, userId, authLoading]);

  const addMember = async () => {
    const targetUserId = newUserId.trim();
    const displayName = newDisplayName.trim();

    if (!targetUserId) {
      alert("追加するユーザーIDを入力してください");
      return;
    }

    if (!canManage) {
      alert("メンバーを追加する権限がありません");
      return;
    }

    if (newRole === "owner" && !canManageOwner) {
      alert("管理者を追加できるのは管理者のみです");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("team_members").upsert(
        {
          team_id: teamId,
          user_id: targetUserId,
          role: newRole,
          display_name: displayName || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "team_id,user_id",
        }
      );

      if (error) throw error;

      setNewUserId("");
      setNewDisplayName("");
      setNewRole("member");
      await load();
    } catch (e: any) {
      console.error(e);
      alert(`追加に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const createInvite = async () => {
    if (!canManage) {
      alert("招待コードを発行する権限がありません");
      return;
    }

    const daysNum = Number(inviteDays);

    const expiresAt =
      Number.isFinite(daysNum) && daysNum > 0
        ? new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString()
        : null;

    setSaving(true);

    try {
      let lastError: any = null;

      for (let i = 0; i < 5; i++) {
        const code = randomInviteCode();

        const { error } = await supabase.from("team_invites").insert({
          team_id: teamId,
          code,
          role: inviteRole,
          display_name: inviteDisplayName.trim() || null,
          expires_at: expiresAt,
          created_by: userId || null,
          updated_at: new Date().toISOString(),
        });

        if (!error) {
          setInviteRole("member");
          setInviteDisplayName("");
          setInviteDays("14");
          await load();
          return;
        }

        lastError = error;
      }

      throw lastError ?? new Error("招待コードの発行に失敗しました");
    } catch (e: any) {
      console.error(e);
      alert(`招待コードの発行に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  function buildInviteJoinUrl(code: string) {
    if (typeof window === "undefined") return `/teams/join?code=${code}`;
    return `${window.location.origin}/teams/join?code=${encodeURIComponent(code)}`;
  }

  function buildInviteText(invite: InviteRow) {
    const url = buildInviteJoinUrl(invite.code);

    return [
      "サカまっちのチーム招待です。",
      "",
      `チーム：${team?.name || "チーム"}`,
      `招待コード：${invite.code}`,
      `参加ページ：${url}`,
      "",
      "上記URLを開いて、表示名を入力して参加してください。",
    ].join("\n");
  }

  const copyInvite = async (invite: InviteRow) => {
    const text = buildInviteText(invite);

    try {
      await navigator.clipboard.writeText(text);
      alert("招待文をコピーしました");
    } catch {
      alert(text);
    }
  };

  const deleteInvite = async (invite: InviteRow) => {
    if (!canManage) return;
    if (!window.confirm("この招待コードを削除しますか？")) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("team_invites")
        .delete()
        .eq("id", invite.id);

      if (error) throw error;

      await load();
    } catch (e: any) {
      console.error(e);
      alert(`削除に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (member: MemberRow, role: Role) => {
    if (!canManage) return;

    if (member.role === "owner" && !canManageOwner) {
      alert("管理者の権限変更は管理者のみ可能です");
      return;
    }

    if (role === "owner" && !canManageOwner) {
      alert("管理者に変更できるのは管理者のみです");
      return;
    }

    if (member.id === "owner-virtual") {
      alert("チーム所有者の権限はここでは変更できません");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("team_members")
        .update({
          role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id);

      if (error) throw error;

      await load();
    } catch (e: any) {
      console.error(e);
      alert(`権限変更に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member: MemberRow) => {
    if (!canManage) return;

    if (member.role === "owner") {
      alert("管理者は削除できません");
      return;
    }

    if (member.id === "owner-virtual") {
      alert("チーム所有者は削除できません");
      return;
    }

    if (!window.confirm("このメンバーを削除しますか？")) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", member.id);

      if (error) throw error;

      await load();
    } catch (e: any) {
      console.error(e);
      alert(`削除に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="👥"
        title="メンバー管理"
        desc="チームメンバーの追加、招待コード発行、権限変更、削除ができます。"
      />

      <div style={topNavWrap}>
        <Link href={`/teams/${teamId}`} className="sh-btn">
          戻る
        </Link>

        <Link
          href={`/chat/team/${teamId}?from=team-members&teamId=${teamId}`}
          className="sh-btn sh-btn--primary"
        >
          チーム連絡
        </Link>

        <Link
          href={`/teams/join?from=members&teamId=${teamId}`}
          className="sh-btn"
        >
          招待コードで参加
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
      ) : !canManage ? (
        <div style={emptyBox}>メンバー管理の権限がありません</div>
      ) : (
        <>
          <section style={panel}>
            <div style={panelTitle}>{team.name || "チーム"} のメンバー管理</div>
            <div style={panelDesc}>
              管理者・コーチはメンバーを管理できます。メンバーは予定確認と出欠回答ができます。
            </div>
          </section>

          <section style={addBox}>
            <div style={sectionTitle}>招待コード発行</div>

            <div style={formGrid}>
              <label style={fieldLabel}>
                招待する権限
                <select
                  value={inviteRole}
                  onChange={(e) => {
                    const role = e.target.value;
                    if (isInviteRole(role)) setInviteRole(role);
                  }}
                  style={input}
                >
                  <option value="member">メンバー</option>
                  <option value="coach">コーチ</option>
                </select>
              </label>

              <label style={fieldLabel}>
                表示名の初期値（任意）
                <input
                  value={inviteDisplayName}
                  onChange={(e) => setInviteDisplayName(e.target.value)}
                  placeholder="例：山田さん"
                  style={input}
                />
              </label>

              <label style={fieldLabel}>
                有効期限（日数）
                <input
                  value={inviteDays}
                  onChange={(e) => setInviteDays(e.target.value)}
                  placeholder="例：14"
                  inputMode="numeric"
                  style={input}
                />
              </label>
            </div>

            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={createInvite}
              disabled={saving}
            >
              招待コードを発行
            </button>
          </section>

          <section style={listBox}>
            <div style={sectionTitle}>招待コード一覧</div>

            {invites.length === 0 ? (
              <div style={miniEmpty}>招待コードはまだありません</div>
            ) : (
              <div style={memberList}>
                {invites.map((invite) => {
                  const isExpired =
                    !!invite.expires_at &&
                    new Date(invite.expires_at).getTime() < Date.now();
                  const isLimitReached =
                    typeof invite.max_uses === "number" &&
                    invite.max_uses > 0 &&
                    invite.used_count >= invite.max_uses;
                  const available =
                    invite.is_active && !isExpired && !isLimitReached;

                  return (
                    <div key={invite.id} style={memberCard}>
                      <div style={memberMain}>
                        <div style={inviteCode}>{invite.code}</div>
                        <div style={memberMeta}>
                          権限：{roleLabel(invite.role)} / 利用：{invite.used_count}回 /{" "}
                          {formatDateTime(invite.expires_at)}
                        </div>
                        <div style={available ? inviteActive : inviteStopped}>
                          {available
                            ? "利用可能"
                            : invite.is_active
                              ? "期限切れまたは上限到達"
                              : "停止中"}
                        </div>
                      </div>

                      <div style={memberActions}>
                        <button
                          type="button"
                          className="sh-btn"
                          onClick={() => copyInvite(invite)}
                        >
                          コピー
                        </button>

                        <a
                          className="sh-btn"
                          href={`mailto:?subject=${encodeURIComponent(
                            "サカまっち チーム招待"
                          )}&body=${encodeURIComponent(buildInviteText(invite))}`}
                        >
                          メール
                        </a>

                        <a
                          className="sh-btn sh-btn--primary"
                          href={`https://line.me/R/msg/text/?${encodeURIComponent(
                            buildInviteText(invite)
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          LINE
                        </a>

                        <button
                          type="button"
                          className="sh-btn"
                          disabled={saving}
                          onClick={() => deleteInvite(invite)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={addBox}>
            <div style={sectionTitle}>メンバー直接追加</div>

            <div style={formGrid}>
              <label style={fieldLabel}>
                ユーザーID
                <input
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="追加するユーザーのID"
                  style={input}
                />
              </label>

              <label style={fieldLabel}>
                表示名
                <input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="例：山田さん"
                  style={input}
                />
              </label>

              <label style={fieldLabel}>
                権限
                <select
                  value={newRole}
                  onChange={(e) => {
                    const role = e.target.value;
                    if (isRole(role)) setNewRole(role);
                  }}
                  style={input}
                >
                  <option value="member">メンバー</option>
                  <option value="coach">コーチ</option>
                  {canManageOwner ? <option value="owner">管理者</option> : null}
                </select>
              </label>
            </div>

            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={addMember}
              disabled={saving}
            >
              直接追加する
            </button>
          </section>

          <section style={listBox}>
            <div style={sectionTitle}>登録メンバー</div>

            <div style={memberList}>
              {members.map((member) => (
                <div key={`${member.id}-${member.user_id}`} style={memberCard}>
                  <div style={memberMain}>
                    <div style={memberName}>
                      {member.display_name || "名前未設定"}
                    </div>
                    <div style={memberMeta}>{member.user_id}</div>
                    <div style={memberRoleText}>{roleLabel(member.role)}</div>
                  </div>

                  <div style={memberActions}>
                    <select
                      value={member.role}
                      disabled={
                        saving ||
                        member.id === "owner-virtual" ||
                        (member.role === "owner" && !canManageOwner)
                      }
                      onChange={(e) => {
                        const role = e.target.value;
                        if (isRole(role)) void updateRole(member, role);
                      }}
                      style={roleSelect}
                    >
                      <option value="member">メンバー</option>
                      <option value="coach">コーチ</option>
                      {canManageOwner ? <option value="owner">管理者</option> : null}
                    </select>

                    <button
                      type="button"
                      className="sh-btn"
                      disabled={
                        saving ||
                        member.role === "owner" ||
                        member.id === "owner-virtual"
                      }
                      onClick={() => removeMember(member)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
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

const miniEmpty: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  background: "#f9fafb",
  color: "#6b7280",
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

const addBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fff",
  display: "grid",
  gap: 12,
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

const formGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 11px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 14,
};

const memberList: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const memberCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const memberMain: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const memberName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const inviteCode: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#14532d",
  letterSpacing: "0.08em",
};

const memberMeta: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  wordBreak: "break-all",
};

const memberRoleText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#166534",
};

const inviteActive: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#166534",
};

const inviteStopped: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#991b1b",
};

const memberActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const roleSelect: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontWeight: 800,
};