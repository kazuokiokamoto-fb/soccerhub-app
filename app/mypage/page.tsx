"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import PushPermissionButton from "@/app/components/PushPermissionButton";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";

import type { ProfileRow, TeamRow, Toast } from "./mypage.types";

import {
  isMissingColumnError,
  rankLabel,
  areaText,
  categoryText,
  toArray,
} from "./mypage.helpers";

import { toProfileRow, toTeamRow } from "./mypage.utils";

import { AccountSection, NotificationSection } from "./mypage.blocks";

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

type TeamRole = "owner" | "coach" | "member";

type TeamMemberRow = {
  team_id: string;
  role: TeamRole;
};

function isTeamRole(value: string): value is TeamRole {
  return value === "owner" || value === "coach" || value === "member";
}

function roleLabel(role?: TeamRole | null) {
  if (role === "owner") return "管理者";
  if (role === "coach") return "コーチ";
  if (role === "member") return "メンバー";
  return "未設定";
}

function toTeamMemberRow(value: unknown): TeamMemberRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const r = value as Record<string, unknown>;
  const teamId = typeof r.team_id === "string" ? r.team_id : "";
  const roleRaw = typeof r.role === "string" ? r.role : "";

  if (!teamId || !isTeamRole(roleRaw)) return null;

  return {
    team_id: teamId,
    role: roleRaw,
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function MyPage() {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [roleByTeamId, setRoleByTeamId] = useState<Map<string, TeamRole>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState("");
  const [loadError, setLoadError] = useState("");

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

  const loadTeamsByIds = useCallback(async (teamIds: string[]) => {
    if (teamIds.length === 0) return [];

    const primaryRes = await supabase
      .from("teams")
      .select(
        "id,owner_id,name,category,categories,level,strength_rank,area,prefecture,city,town,has_ground,category_meta,uniform_main,uniform_sub,uniform_gk,note,updated_at"
      )
      .in("id", teamIds)
      .order("updated_at", { ascending: false });

    if (primaryRes.error && isMissingColumnError(primaryRes.error)) {
      const fallbackRes = await supabase
        .from("teams")
        .select(
          "id,owner_id,name,category,categories,level,strength_rank,area,prefecture,city,town,has_ground,uniform_main,uniform_sub,note,updated_at"
        )
        .in("id", teamIds)
        .order("updated_at", { ascending: false });

      if (fallbackRes.error) throw fallbackRes.error;
      return toArray(fallbackRes.data, toTeamRow);
    }

    if (primaryRes.error) throw primaryRes.error;
    return toArray(primaryRes.data, toTeamRow);
  }, []);

  const load = useCallback(async () => {
    if (authLoading || loadRunningRef.current) return;

    loadRunningRef.current = true;

    if (!user) {
      if (mountedRef.current) {
        setProfile(null);
        setTeams([]);
        setRoleByTeamId(new Map());
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

      const ownerTeamsPromise = supabase
        .from("teams")
        .select("id")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

      const memberTeamsPromise = supabase
        .from("team_members")
        .select("team_id,role")
        .eq("user_id", userId);

      const [
        { data: profileRaw, error: profileErr },
        { data: ownerTeamsRaw, error: ownerTeamsErr },
        { data: memberTeamsRaw, error: memberTeamsErr },
      ] = await Promise.all([
        profilePromise,
        ownerTeamsPromise,
        memberTeamsPromise,
      ]);

      if (profileErr) console.error("[mypage] profile error:", profileErr);
      if (ownerTeamsErr) throw ownerTeamsErr;
      if (memberTeamsErr) throw memberTeamsErr;

      const ownerTeamIds = Array.isArray(ownerTeamsRaw)
        ? ownerTeamsRaw
            .map((row: any) => String(row.id ?? ""))
            .filter(Boolean)
        : [];

      const memberRows = toArray(memberTeamsRaw, toTeamMemberRow);
      const memberTeamIds = memberRows.map((row) => row.team_id);

      const allTeamIds = uniqueStrings([...ownerTeamIds, ...memberTeamIds]);

      const nextRoleByTeamId = new Map<string, TeamRole>();

      for (const id of ownerTeamIds) {
        nextRoleByTeamId.set(id, "owner");
      }

      for (const row of memberRows) {
        if (!nextRoleByTeamId.has(row.team_id)) {
          nextRoleByTeamId.set(row.team_id, row.role);
        }
      }

      const loadedTeams = await loadTeamsByIds(allTeamIds);

      if (mountedRef.current) {
        setProfile(toProfileRow(profileRaw));
        setTeams(loadedTeams);
        setRoleByTeamId(nextRoleByTeamId);
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
      if (mountedRef.current) setLoading(false);
      loadRunningRef.current = false;
    }
  }, [authLoading, user, loadTeamsByIds]);

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
      { label: "チームメンバー", run: () => existsRow("team_members", "team_id", teamId) },
    ];

    for (const check of checks) {
      const hit = await check.run();
      if (hit) blockers.push(check.label);
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
        setToast({ type: "error", text: `チーム削除失敗: ${error.message}` });
        setDeletingTeamId("");
        return;
      }

      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      setRoleByTeamId((prev) => {
        const next = new Map(prev);
        next.delete(team.id);
        return next;
      });

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
          desc="アカウント情報、チーム情報、グラウンド情報を確認・編集できます。"
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
        desc="アカウント情報、チーム情報、グラウンド情報を確認・編集できます。"
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
          <div style={teamTopActions}>
            <Link href="/teams/new" className="sh-btn">
              ＋チーム登録
            </Link>
          </div>
        </div>

        <div style={teamList}>
          {teams.length === 0 ? (
            <div style={emptyTeamBox}>
              まだチームが登録されていません。
              <br />
              先にチーム登録をしてください。
            </div>
          ) : (
            teams.map((team) => {
              const role = roleByTeamId.get(team.id);
              const isOwner = role === "owner";
              const deleting = deletingTeamId === team.id;
              const categories =
                Array.isArray(team.categories) && team.categories.length > 0
                  ? team.categories
                      .map((c) => String(c))
                      .join(" / ")
                  : String(team.category ?? "未設定");

              return (
                <div key={team.id} style={teamCard}>
                  <div style={teamCardHead}>
                    <div style={teamNameBlock}>
                      <div style={teamName}>{team.name || "名称未設定"}</div>
                      <div style={roleBadge}>{roleLabel(role)}</div>
                    </div>

                    <div style={teamActions}>
                      <Link href={`/teams/${team.id}?from=mypage`} className="sh-btn">
                        詳細
                      </Link>

                      {isOwner ? (
                        <button
                          type="button"
                          className="sh-btn"
                          onClick={() => void deleteTeam(team)}
                          disabled={deleting}
                          style={deleteButton}
                        >
                          {deleting ? "削除中…" : "削除"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={teamMeta}>
                    <div>
                      <b>エリア：</b>
                      {areaText(team)}
                    </div>
                    <div>
                      <b>カテゴリ：</b>
                      {categories || "未設定"}
                    </div>
                    <div>
                      <b>グラウンド提供：</b>
                      {team.has_ground ? "あり" : "なし"}
                    </div>
                    <div>
                      <b>ユニフォーム：</b>
                      {team.uniform_main || "未設定"} /{" "}
                      {team.uniform_sub || "未設定"}
                      {"uniform_gk" in team && (team as any).uniform_gk
                        ? ` / GK: ${(team as any).uniform_gk}`
                        : ""}
                    </div>
                  </div>

                  <div style={categoryMetaBox}>
                    <div style={categoryMetaTitle}>カテゴリ別設定</div>
                    <div style={categoryMetaLine}>
                      強さ：{team.strength_rank || "未設定"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
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

const teamTopActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const teamList: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const emptyTeamBox: React.CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#f7fbf8",
  color: "#4b5563",
  lineHeight: 1.8,
  textAlign: "center",
};

const teamCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
};

const teamCardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const teamNameBlock: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const teamName: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.3,
};

const roleBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  fontSize: 13,
  fontWeight: 900,
};

const teamActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const deleteButton: React.CSSProperties = {
  borderColor: "#fecaca",
  color: "#b91c1c",
  background: "#fff",
};

const teamMeta: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 6,
  color: "#4b5563",
  fontSize: 14,
  lineHeight: 1.7,
};

const categoryMetaBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#fff",
  display: "grid",
  gap: 5,
};

const categoryMetaTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#14532d",
};

const categoryMetaLine: React.CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.6,
};