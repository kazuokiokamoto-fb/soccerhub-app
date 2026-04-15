"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import TeamProfileCard, {
  TeamProfileCardRow,
  teamAreaText,
  teamCategories,
  teamStrengthLabel,
  uniformText,
} from "@/app/teams/components/TeamProfileCard";
import { categoryLabel } from "@/app/lib/categories";
import { MatchHelpModals } from "@/app/match/components/MatchHelpModals";
import { STRENGTH_GUIDES } from "@/app/match/constants/strengthGuides";

type TeamRow = TeamProfileCardRow;

function buildGeminiPrompt(team: TeamRow) {
  const categoryText =
    teamCategories(team).length > 0
      ? teamCategories(team)
          .map((v) => categoryLabel(v) || v)
          .join(" / ")
      : "未設定";

  return `少年サッカー・キッズサッカーのチーム情報を調べたいです。
以下の条件をもとに、日本語で簡潔に整理してください。

チーム名: ${team.name ?? "未設定"}
カテゴリ: ${categoryText}
活動エリア: ${teamAreaText(team)}
強さ: ${teamStrengthLabel(team)}
所属人数: ${team.member_count ?? "未設定"}
ユニフォーム: ${uniformText(team)}

知りたいこと:
・このチームがどんなチームか
・このカテゴリでの活動傾向
・対戦前に確認すると良いこと
・一般的に想定されるレベル感や特徴

不明な情報は推測しすぎず、「不明」と明記してください。`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

function toTeamRow(value: unknown): TeamRow | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;

  return {
    id: value.id,
    owner_id: toNullableString(value.owner_id),
    name: toNullableString(value.name),
    category: toNullableString(value.category),
    categories: toStringArrayOrNull(value.categories),
    level: toNullableNumber(value.level),
    strength_rank: toNullableString(value.strength_rank),
    area: toNullableString(value.area),
    prefecture: toNullableString(value.prefecture),
    city: toNullableString(value.city),
    town: toNullableString(value.town),
    member_count: toNullableNumber(value.member_count),
    uniform_main: toNullableString(value.uniform_main),
    uniform_sub: toNullableString(value.uniform_sub),
    note: toNullableString(value.note),
  };
}

export default function TeamDetailPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const teamId = useMemo(() => {
    const raw = params?.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return "";
  }, [params]);

  const myUserId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!teamId) {
        if (!active) return;
        setTeam(null);
        setLoadError("チームIDが不正です");
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const { data, error } = await supabase
          .from("teams")
          .select(
            [
              "id",
              "owner_id",
              "name",
              "category",
              "categories",
              "level",
              "strength_rank",
              "area",
              "prefecture",
              "city",
              "town",
              "member_count",
              "uniform_main",
              "uniform_sub",
              "note",
            ].join(",")
          )
          .eq("id", teamId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!active) return;

        if (!data) {
          setTeam(null);
          setLoadError("チームが見つかりません");
          return;
        }

        const nextTeam = toTeamRow(data);
        if (!nextTeam) {
          setTeam(null);
          setLoadError("チームデータの形式が不正です");
          return;
        }

        setTeam(nextTeam);
      } catch (e: any) {
        console.error("[team detail] load error:", e);
        if (!active) return;
        setTeam(null);
        setLoadError(e?.message ?? "チーム詳細の取得に失敗しました");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [teamId]);

  const mine = !!myUserId && !!team && team.owner_id === myUserId;
  const canOpenChat = !!team && !!myUserId && !mine;

  const openChat = async () => {
    try {
      if (!myUserId) {
        window.location.href = "/login";
        return;
      }

      if (!team?.id) return;

      if (team.owner_id === myUserId) {
        alert("自分のチームにはチャットできません");
        return;
      }

      setChatLoading(true);

      const { data: myTeams, error: myTeamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", myUserId)
        .limit(1);

      if (myTeamsError) throw myTeamsError;

      const myTeamId = myTeams?.[0]?.id;
      if (!myTeamId) {
        alert("先に自分のチームを登録してください");
        window.location.href = "/teams/new";
        return;
      }

      const { data: threadId, error: threadError } = await supabase.rpc(
        "rpc_get_or_create_dm_thread",
        {
          my_team_id: myTeamId,
          other_team_id: team.id,
        }
      );

      if (threadError) throw threadError;
      if (!threadId) throw new Error("チャットスレッドを作成できませんでした");

      window.location.href = `/chat/${threadId}?from=team-detail`;
    } catch (e: any) {
      console.error("[team detail] open chat error:", e);
      alert(`チャットを開けませんでした: ${e?.message ?? "unknown error"}`);
    } finally {
      setChatLoading(false);
    }
  };

  const openGeminiSearch = async () => {
    if (!team) return;

    const prompt = buildGeminiPrompt(team);

    try {
      await navigator.clipboard.writeText(prompt);
      alert("Gemini用の検索文をコピーしました。Geminiに貼り付けてください。");
    } catch (e) {
      console.error("[team detail] copy gemini prompt error:", e);
      window.prompt(
        "この検索文をコピーしてGeminiに貼り付けてください。",
        prompt
      );
    }
  };

  return (
    <>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
        <AppTabNav />

        <AppHero
          icon="👥"
          title="チーム詳細"
          desc="登録チームのプロフィールを確認できます。"
        />

        <div style={topRow}>
          <Link href="/teams" className="sh-btn">
            ← チーム一覧へ戻る
          </Link>

          {mine && team ? (
            <Link
              href={`/teams/${team.id}/edit`}
              className="sh-btn sh-btn--primary"
            >
              チーム編集
            </Link>
          ) : null}
        </div>

        {loading || authLoading ? (
          <div style={loadingBox}>読み込み中…</div>
        ) : loadError ? (
          <div style={errorBox}>
            <div style={errorTitle}>読み込みエラー</div>
            <div>{loadError}</div>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={() => window.location.reload()}
              >
                再読み込み
              </button>
            </div>
          </div>
        ) : !team ? (
          <div style={emptyBox}>チームが見つかりませんでした。</div>
        ) : (
          <>
            <TeamProfileCard
              team={team}
              title="チーム詳細"
              mine={mine}
              onOpenStrengthHelp={() => setShowStrengthHelp(true)}
              onOpenGeminiSearch={!mine ? openGeminiSearch : undefined}
              showGeminiSection={!mine}
            />

            {!mine ? (
              <div style={bottomActionRow}>
                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={openChat}
                  disabled={!canOpenChat || chatLoading}
                >
                  {chatLoading ? "チャット準備中…" : "チャットで連絡"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>

      <MatchHelpModals
        showStrengthHelp={showStrengthHelp}
        showCalendarHelp={false}
        onCloseStrengthHelp={() => setShowStrengthHelp(false)}
        onCloseCalendarHelp={() => {}}
        strengthGuides={STRENGTH_GUIDES}
      />
    </>
  );
}

const topRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const loadingBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  lineHeight: 1.8,
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

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  lineHeight: 1.8,
  textAlign: "center",
};

const bottomActionRow: React.CSSProperties = {
  marginTop: 20,
  display: "flex",
  justifyContent: "flex-end",
};