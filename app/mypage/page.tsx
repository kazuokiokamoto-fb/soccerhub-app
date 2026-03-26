"use client";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { categoryLabel, categoryLabels } from "@/app/lib/categories";

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
  bike_parking?: string | null;
  bike_parking_capacity?: string | null;
  member_count?: number | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  uniform_gk?: string | null;
  note?: string | null;
};

type Toast = { type: "success" | "error" | "info"; text: string };

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
  const area = (team.area ?? "").trim();
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

export default function MyPage() {
  const [me, setMe] = useState<{ id: string; email?: string | null } | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const mainTeam = useMemo(() => teams[0] ?? null, [teams]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    setToast(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error(userErr);
      setToast({ type: "error", text: `ユーザー取得失敗: ${userErr.message}` });
      setLoading(false);
      return;
    }

    if (!user) {
      setMe(null);
      setProfile(null);
      setTeams([]);
      setLoading(false);
      return;
    }

    setMe({
      id: user.id,
      email: user.email ?? null,
    });

    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id,name,phone,line_id,notify_email,notify_line")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error(profileErr);
      setToast({ type: "error", text: `プロフィール読込失敗: ${profileErr.message}` });
    }

    setProfile((profileRow as ProfileRow | null) ?? null);

    const { data: myTeamsRows, error: teamsErr } = await supabase
      .from("teams")
      .select(
        "id,owner_id,name,category,categories,level,strength_rank,area,prefecture,city,town,has_ground,bike_parking,bike_parking_capacity,member_count,uniform_main,uniform_sub,uniform_gk,note"
      )
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (teamsErr) {
      console.error(teamsErr);
      setToast({ type: "error", text: `チーム読込失敗: ${teamsErr.message}` });
      setTeams([]);
      setLoading(false);
      return;
    }

    setTeams(((myTeamsRows ?? []) as TeamRow[]) || []);
    setLoading(false);
  }

  if (loading) {
    return <main style={{ padding: 20 }}>Loading...</main>;
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
        desc="アカウント情報、チーム情報、グラウンド情報を確認・編集できます。"
      />

      {!me ? (
        <div style={{ marginTop: 16, color: "#991b1b" }}>ログインが必要です。</div>
      ) : null}

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
          <h2 style={sectionTitle}>チーム</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/teams/new" className="sh-btn">
              ＋チーム登録
            </Link>

            {mainTeam ? (
              <Link href={`/teams/${mainTeam.id}/edit`} className="sh-btn sh-btn--primary">
                チーム編集
              </Link>
            ) : null}
          </div>
        </div>

        {teams.length === 0 ? (
          <div style={{ color: "#666" }}>まだチーム登録がありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {teams.map((team) => (
              <div key={team.id} style={card}>
                <div style={cardHead}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{team.name}</div>
                    <div style={subText}>
                      {categoryText(team)} / {team.strength_rank || rankLabel(team.level)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/teams/${team.id}`} className="sh-btn">
                      詳細
                    </Link>
                    <Link href={`/teams/${team.id}/edit`} className="sh-btn sh-btn--primary">
                      編集
                    </Link>
                  </div>
                </div>

                <div style={{ color: "#555", marginTop: 10, lineHeight: 1.8 }}>
                  エリア : {areaText(team)}
                  <br />
                  カテゴリ : {categoryText(team)}
                  <br />
                  強さ : {team.strength_rank || rankLabel(team.level)}
                  <br />
                  グラウンド : {team.has_ground ? "あり" : "なし"}
                  <br />
                  駐輪場 : {team.bike_parking ?? "不明"}
                  {team.bike_parking_capacity ? `（${team.bike_parking_capacity}）` : ""}
                  <br />
                  所属人数 : {team.member_count ?? "未設定"}
                  <br />
                  ユニフォーム : {team.uniform_main ?? "不明"} / {team.uniform_sub ?? "不明"} / GK:{" "}
                  {team.uniform_gk ?? "不明"}
                </div>

                {team.note?.trim() ? (
                  <div style={noteBox}>
                    <div style={noteTitle}>メモ</div>
                    <div style={noteBody}>{team.note}</div>
                  </div>
                ) : null}
              </div>
            ))}
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
          登録済みグラウンドを管理できます。<br />
          今後、募集枠作成時に登録済みグラウンドから選択しやすくなります。
        </div>
      </section>
    </main>
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
  flexWrap: "wrap",
};

const subText: React.CSSProperties = {
  marginTop: 4,
  color: "#66756d",
  fontSize: 13,
  lineHeight: 1.6,
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