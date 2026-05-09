"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { categoryLabel } from "@/app/lib/categories";
import { STRENGTH_GUIDES } from "@/app/match/constants/strengthGuides";

export type TeamProfileCardRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  area: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  address_detail?: string | null;
  member_count?: number | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  note?: string | null;
};

function levelToRank(level?: number | null) {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

export function teamStrengthLabel(team?: TeamProfileCardRow | null) {
  if (!team) return "未設定";
  if (team.strength_rank && String(team.strength_rank).trim()) {
    return String(team.strength_rank).trim();
  }
  return levelToRank(team.level) || "未設定";
}

export function teamStrengthShortDescription(team?: TeamProfileCardRow | null) {
  const rank = teamStrengthLabel(team);

  if (rank === "SS") return "全国・地域トップ級";
  if (rank === "S") return "都・県リーグ上位";
  if (rank === "A") return "都・県リーグ1・2部";
  if (rank === "B") return "地域リーグ・育成中心";
  if (rank === "C") return "交流・入門中心";
  return "未設定";
}

export function teamCategories(team?: TeamProfileCardRow | null) {
  if (!team) return [];
  if (Array.isArray(team.categories) && team.categories.length > 0) {
    return team.categories;
  }
  if (team.category) return [team.category];
  return [];
}

export function teamCategoryText(team?: TeamProfileCardRow | null) {
  const categories = teamCategories(team);
  if (categories.length === 0) return "未設定";
  return categories.map((v) => categoryLabel(v) || v).join(" / ");
}

export function teamAreaText(team?: TeamProfileCardRow | null) {
  if (!team) return "未設定";

  const parts = [team.prefecture, team.city, team.town]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ・ ");
  }

  return team.area || "未設定";
}

export function uniformText(team?: TeamProfileCardRow | null) {
  if (!team) return "未設定";
  return (
    [team.uniform_main, team.uniform_sub]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" / ") || "未設定"
  );
}

function buildGeminiPrompt(
  team?: TeamProfileCardRow | null,
  categoryTextOverride?: string
) {
  return `少年サッカー・キッズサッカーのチーム情報を調べたいです。
以下の条件をもとに、日本語で簡潔に整理してください。

チーム名: ${team?.name ?? "未設定"}
カテゴリ: ${categoryTextOverride || teamCategoryText(team)}
活動エリア: ${teamAreaText(team)}
強さ: ${teamStrengthLabel(team)}
レベル感: ${teamStrengthShortDescription(team)}
所属人数: ${
    team?.member_count != null ? `${team.member_count}人` : "未設定"
  }
ユニフォーム: ${uniformText(team)}

知りたいこと:
・このチームがどんなチームか
・このカテゴリでの活動傾向
・対戦前に確認すると良いこと
・一般的に想定されるレベル感や特徴

不明な情報は推測しすぎず、「不明」と明記してください。`;
}

export type TeamProfileCardProps = {
  title?: string;
  team: TeamProfileCardRow;
  myUserId?: string;
  backHref?: string;
  backLabel?: string;
  showBackButton?: boolean;
  editHref?: string;
  showEditButton?: boolean;
  categoryTextOverride?: string;
  showAddressDetail?: boolean;
  showGeminiSection?: boolean;
  showChatButton?: boolean;
  showStrengthHelpButton?: boolean;
  chatFrom?: string;
  chatSlotId?: string;
  chatDate?: string;
};

export default function TeamProfileCard(props: TeamProfileCardProps) {
  const {
    title = "チーム詳細",
    team,
    myUserId = "",
    backHref,
    backLabel = "← 戻る",
    showBackButton = false,
    editHref,
    showEditButton = false,
    categoryTextOverride,
    showAddressDetail = true,
    showGeminiSection = true,
    showChatButton = true,
    showStrengthHelpButton = true,
    chatFrom = "team-detail",
    chatSlotId = "",
    chatDate = "",
  } = props;

  const mine = !!myUserId && team.owner_id === myUserId;
  const canOpenChat = !!myUserId && !mine;

  const [chatLoading, setChatLoading] = useState(false);
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  const [copiedGemini, setCopiedGemini] = useState(false);
  const [showGeminiModal, setShowGeminiModal] = useState(false);

  const geminiPrompt = useMemo(
    () => buildGeminiPrompt(team, categoryTextOverride),
    [team, categoryTextOverride]
  );

  const copyGeminiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(geminiPrompt);
      setCopiedGemini(true);
      window.setTimeout(() => setCopiedGemini(false), 2000);
      return true;
    } catch (e) {
      console.error("[TeamProfileCard] copyGeminiPrompt error:", e);
      alert("コピーに失敗しました。");
      return false;
    }
  };

  const openGeminiAfterCopy = async () => {
    const ok = await copyGeminiPrompt();
    if (!ok) return;

    window.location.href = "https://gemini.google.com/";
  };

  const openChat = async () => {
    try {
      if (!myUserId) {
        window.location.href = "/login";
        return;
      }

      if (!team?.id) return;

      if (mine) {
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

      const qs = new URLSearchParams();
      if (chatFrom) qs.set("from", chatFrom);
      if (chatSlotId) qs.set("slotId", chatSlotId);
      if (chatDate) qs.set("date", chatDate);

      const query = qs.toString();
      window.location.href = query
        ? `/chat/${threadId}?${query}`
        : `/chat/${threadId}`;
    } catch (e: any) {
      console.error("[TeamProfileCard] openChat error:", e);
      alert(`チャットを開けませんでした: ${e?.message ?? "unknown error"}`);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
      {showBackButton || (showEditButton && mine) ? (
        <div style={topRow}>
          {showBackButton && backHref ? (
            <a href={backHref} className="sh-btn">
              {backLabel}
            </a>
          ) : (
            <div />
          )}

          {showEditButton && mine && editHref ? (
            <a href={editHref} className="sh-btn sh-btn--primary">
              チーム編集
            </a>
          ) : null}
        </div>
      ) : null}

      <section style={card}>
        <div style={headerRow}>
          <div style={sectionTitle}>{title}</div>

          {showChatButton && canOpenChat ? (
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={openChat}
              disabled={chatLoading}
            >
              {chatLoading ? "チャット準備中…" : "チャットで連絡"}
            </button>
          ) : null}
        </div>

        <div style={teamNameRow}>
          <div style={teamName}>{team.name || "未設定"}</div>
          {mine ? <span style={mineBadge}>自分のチーム</span> : null}
        </div>

        <div style={teamMetaGrid}>
          <div style={teamMetaItem}>
            <div style={metaLabel}>カテゴリ</div>
            <div style={metaValue}>
              {categoryTextOverride || teamCategoryText(team)}
            </div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>強さ</div>
            <div style={strengthValueRow}>
              <span style={strengthValueMain}>{teamStrengthLabel(team)}</span>
              <span style={strengthValueSub}>
                {teamStrengthShortDescription(team)}
              </span>

              {showStrengthHelpButton ? (
                <button
                  type="button"
                  aria-label="強さの説明を見る"
                  onClick={() => setShowStrengthHelp(true)}
                  style={helpButton}
                >
                  ?
                </button>
              ) : null}
            </div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>エリア</div>
            <div style={metaValue}>{teamAreaText(team)}</div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>チーム人数</div>
            <div style={metaValue}>
              {team.member_count != null ? `${team.member_count}人` : "未設定"}
            </div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>ユニフォーム</div>
            <div style={metaValue}>{uniformText(team)}</div>
          </div>

          {showAddressDetail && team.address_detail ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>住所補足</div>
              <div style={metaValue}>{team.address_detail}</div>
            </div>
          ) : null}

          {team.note ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>チームメモ</div>
              <div style={metaValue}>{team.note}</div>
            </div>
          ) : null}

          {showGeminiSection && !mine ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>Geminiによるチーム情報</div>
              <div style={metaValue}>
                先に検索文を確認してから、コピーしてGeminiへ進めます。
              </div>

              <div style={geminiActionRow}>
                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={() => setShowGeminiModal(true)}
                >
                  Geminiでこのチームを調べる
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {showGeminiModal ? (
        <div style={modalOverlay} onClick={() => setShowGeminiModal(false)}>
          <div style={modalCardWide} onClick={(e) => e.stopPropagation()}>
            <div style={modalTitle}>Gemini検索文</div>

            <div style={modalText}>
              下の文章をコピーして、そのままGeminiに進めます。
            </div>

            <textarea
              value={geminiPrompt}
              readOnly
              style={promptTextarea}
            />

            <div style={copiedText}>
              {copiedGemini ? "コピーしました" : "内容を確認してから進めます"}
            </div>

            <div style={modalActionRow}>
              <button
                type="button"
                className="sh-btn"
                onClick={copyGeminiPrompt}
              >
                検索文をコピー
              </button>

              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={openGeminiAfterCopy}
              >
                コピーしてGeminiを開く
              </button>
            </div>

            <div style={modalCloseRow}>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setShowGeminiModal(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStrengthHelp ? (
        <div style={modalOverlay} onClick={() => setShowStrengthHelp(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalTitle}>強さの目安</div>

            <div style={guideList}>
              {STRENGTH_GUIDES.map((guide) => (
                <div key={guide.rank} style={guideCard}>
                  <div style={guideHeader}>
                    <strong style={guideRankBadge}>{guide.rank}</strong>
                    <span style={guideShort}>{guide.short}</span>
                  </div>

                  <div style={guideTitle}>{guide.title}</div>

                  <ul style={guideBullets}>
                    {guide.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>

                  <div style={guideNote}>{guide.note}</div>
                </div>
              ))}
            </div>

            <div style={modalCloseRow}>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setShowStrengthHelp(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

const card: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 18,
  border: "1px solid #dce9df",
  background: "#fff",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const teamNameRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const teamName: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const mineBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

const teamMetaGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 14,
};

const teamMetaItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const metaLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#6b7280",
  lineHeight: 1.4,
};

const metaValue: React.CSSProperties = {
  fontSize: 16,
  color: "#1c2b22",
  lineHeight: 1.7,
};

const strengthValueRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const strengthValueMain: React.CSSProperties = {
  fontSize: 16,
  color: "#1c2b22",
  lineHeight: 1.7,
  fontWeight: 800,
};

const strengthValueSub: React.CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.7,
};

const helpButton: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid #b7dcbf",
  background: "#f3fbf5",
  color: "#1f5d30",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const geminiActionRow: React.CSSProperties = {
  marginTop: 8,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  padding: 16,
  zIndex: 1000,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  maxHeight: "85vh",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #dce9df",
  padding: 16,
  boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
  display: "grid",
  gap: 12,
  margin: "24px auto",
};

const modalCardWide: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #dce9df",
  padding: 16,
  boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
  display: "grid",
  gap: 12,
};

const modalTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const modalText: React.CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.7,
};

const promptTextarea: React.CSSProperties = {
  width: "100%",
  minHeight: 260,
  borderRadius: 14,
  border: "1px solid #dce9df",
  padding: 14,
  fontSize: 14,
  lineHeight: 1.7,
  color: "#1c2b22",
  background: "#f9fbfa",
  resize: "vertical",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const copiedText: React.CSSProperties = {
  fontSize: 13,
  color: "#166534",
  lineHeight: 1.5,
};

const guideList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const guideItem: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  fontSize: 15,
  color: "#1c2b22",
  lineHeight: 1.7,
};

const modalActionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const modalCloseRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const guideCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#fbfdfc",
  display: "grid",
  gap: 10,
};

const guideHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const guideRankBadge: React.CSSProperties = {
  minWidth: 48,
  minHeight: 34,
  borderRadius: 999,
  background: "#25662f",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  fontWeight: 900,
};

const guideShort: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#16391f",
};

const guideTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#1f2937",
  lineHeight: 1.6,
};

const guideBullets: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  color: "#374151",
  lineHeight: 1.8,
  fontSize: 13,
};

const guideNote: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #f3d37a",
  background: "#fff8db",
  color: "#5b4500",
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.6,
};