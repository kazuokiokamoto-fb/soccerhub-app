"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";

type Toast = { type: "success" | "error" | "info"; text: string };

type DbTeam = {
  id: string;
  owner_id: string | null;
  name: string | null;

  area: string | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  address_detail?: string | null;

  category: string | null;
  categories: string[] | null;

  level: number | null;
  strength_rank?: string | null;

  has_ground: boolean | null;
  bike_parking: string | null;
  bike_parking_capacity?: string | null;

  member_count?: number | null;
  roster_by_grade?: Record<string, number> | null;

  uniform_main: string | null;
  uniform_sub: string | null;

  desired_dates?: string[] | null;
  note: string | null;

  updated_at: string;
};

type StrengthGuide = {
  rank: StrengthRank;
  short: string;
  title: string;
  bullets: string[];
  note: string;
};

type OfferRow = {
  id: string;
  from_team_id: string;
  to_team_id: string;
  status: string;
  message: string | null;
  created_at: string;
};

const STRENGTH_OPTIONS = [
  { value: "SS", label: "SS 都・県リーグ1・2部" },
  { value: "S", label: "S 都・県リーグ3・4部" },
  { value: "A", label: "A 地域リーグ1・2部" },
  { value: "B", label: "B 地域リーグ3・4部" },
  { value: "C", label: "C フレンドリー" },
];

const STRENGTH_GUIDES: StrengthGuide[] = [
  {
    rank: "SS",
    short: "都・県リーグ1・2部",
    title: "公式戦上位レベルの強度を想定したカテゴリー",
    bullets: [
      "都・県リーグ上位所属",
      "試合強度：★★★★★（非常に高い）",
      "球際・切り替えが速く、戦術理解度が高い",
      "公式戦同等レベルの緊張感ある試合を希望",
    ],
    note: "⭐︎ 「強度の高い実戦形式」を求めるチーム向け",
  },
  {
    rank: "S",
    short: "都・県リーグ3・4部",
    title: "公式戦基準の競争力を持つカテゴリー",
    bullets: [
      "都・県リーグ所属",
      "試合強度：★★★★☆（高い）",
      "基礎技術が安定し、組織的な守備・攻撃ができる",
      "上位リーグ昇格を目指すレベル",
    ],
    note: "⭐︎ 「しっかり競り合える相手」を求めるチーム向け",
  },
  {
    rank: "A",
    short: "地域リーグ1・2部",
    title: "育成と競争のバランス型カテゴリー",
    bullets: [
      "地域リーグ上位所属",
      "試合強度：★★★☆☆（中〜やや高）",
      "個人技術向上＋チーム連携を重視",
      "チャレンジマッチにも適したレベル",
    ],
    note: "⭐︎ 「公式戦を想定しつつ育成も重視」するチーム向け",
  },
  {
    rank: "B",
    short: "地域リーグ3・4部",
    title: "成長重視の実戦経験カテゴリー",
    bullets: [
      "地域リーグ所属",
      "試合強度：★★☆☆☆（やや穏やか）",
      "試合経験を積みながら基礎力を伸ばす段階",
      "バランスの良いマッチング向き",
    ],
    note: "⭐︎「経験を積みたい」「自信をつけたい」チーム向け",
  },
  {
    rank: "C",
    short: "フレンドリー",
    title: "交流・経験重視カテゴリー",
    bullets: [
      "リーグ所属問わず",
      "試合強度：★☆☆☆☆（交流中心）",
      "新チーム編成・初心者中心・交流目的",
      "勝敗よりも経験や交流を重視",
    ],
    note: "⭐︎「楽しく真剣に」「幅広い交流」を希望するチーム向け",
  },
];

function norm(v?: string | null) {
  return (v ?? "").trim();
}

function levelLabel(level: number): StrengthRank {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function getStrength(team: DbTeam): StrengthRank {
  return (
    (team.strength_rank as StrengthRank | null) ||
    levelLabel(Number(team.level ?? 0))
  ) as StrengthRank;
}

function getMemberCount(team: DbTeam) {
  if (typeof team.member_count === "number") return team.member_count;
  const roster = (team.roster_by_grade ?? {}) as Record<string, number>;
  return Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v || v === "不明") return null;
  if (v === "50+") return 50;
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function buildAreaText(team: DbTeam) {
  const direct = norm(team.area);
  if (direct) return direct;

  const composed = `${team.prefecture ?? ""} ${team.city ?? ""}${
    team.town ? "・" + team.town : ""
  }`.trim();

  return composed || "（エリア未設定）";
}

function formatBikeParking(team: DbTeam) {
  if (team.bike_parking === "あり") {
    if (team.bike_parking_capacity) {
      if (team.bike_parking_capacity === "50+") return "あり（50台以上）";
      return `あり（${team.bike_parking_capacity}台）`;
    }
    return "あり";
  }
  return team.bike_parking ?? "不明";
}

function normalizeOptions(
  options: Array<string | { value: string; label: string }>
) {
  return options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
}

function matchesTeamFilters(
  team: DbTeam,
  filters: ReturnType<typeof useMatchFilters>["appliedFilters"]
) {
  const cats =
    Array.isArray(team.categories) && team.categories.length > 0
      ? team.categories
      : team.category
      ? [team.category]
      : [];

  if (filters.categoryFilter.length > 0) {
    if (!cats.some((c) => c && filters.categoryFilter.includes(String(c).trim()))) {
      return false;
    }
  }

  if (filters.prefectureFilter && norm(team.prefecture) !== filters.prefectureFilter) {
    return false;
  }

  if (filters.cityFilter && norm(team.city) !== filters.cityFilter) {
    return false;
  }

  if (filters.townFilter && norm(team.town) !== filters.townFilter) {
    return false;
  }

  if (filters.groundFilter !== "all") {
    const val = team.has_ground ? "あり" : "なし";
    if (val !== filters.groundFilter) return false;
  }

  if (filters.strengthFilter.length > 0) {
    if (!filters.strengthFilter.includes(getStrength(team))) return false;
  }

  if (filters.bikeFilter !== "all") {
    const val = (team.bike_parking ?? "不明") as "あり" | "なし" | "不明";
    if (val !== filters.bikeFilter) return false;
  }

  if (filters.bikeCapacityMin) {
    const cap = parseBikeCapacity(team.bike_parking_capacity);
    if (cap == null || cap < Number(filters.bikeCapacityMin)) return false;
  }

  if (filters.memberCountMin) {
    const count = Number(getMemberCount(team));
    if (count < Number(filters.memberCountMin)) return false;
  }

  if (filters.keyword.trim()) {
    const q = filters.keyword.trim().toLowerCase();
    const hay = [
      team.name,
      team.area,
      team.prefecture,
      team.city,
      team.town,
      team.category,
      ...(team.categories ?? []),
      team.note,
      team.uniform_main,
      team.uniform_sub,
      team.bike_parking,
      team.bike_parking_capacity,
      getStrength(team),
      String(getMemberCount(team)),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!hay.includes(q)) return false;
  }

  return true;
}

export default function TeamsSearchClient() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<DbTeam[]>([]);
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [requestTeamId, setRequestTeamId] = useState("");
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  const [openTeamId, setOpenTeamId] = useState("");

  const [offerTargetTeam, setOfferTargetTeam] = useState<DbTeam | null>(null);
  const [offerMessage, setOfferMessage] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const {
    draftKeyword,
    setDraftKeyword,
    draftCategoryFilter,
    setDraftCategoryFilter,
    draftPrefectureFilter,
    setDraftPrefectureFilter,
    draftCityFilter,
    setDraftCityFilter,
    draftTownFilter,
    setDraftTownFilter,
    draftGroundFilter,
    setDraftGroundFilter,
    draftStrengthFilter,
    setDraftStrengthFilter,
    draftBikeFilter,
    setDraftBikeFilter,
    draftBikeCapacityMin,
    setDraftBikeCapacityMin,
    draftMemberCountMin,
    setDraftMemberCountMin,
    appliedFilters,
    draftFilters,
    hasDraftChanges,
    applyDraftToApplied,
    clearAllFilters,
  } = useMatchFilters();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const categoryOptions = useMemo(() => {
    return normalizeOptions(
      CATEGORY_OPTIONS as Array<string | { value: string; label: string }>
    );
  }, []);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("teams")
      .select(
        "id,owner_id,name,area,prefecture,city,town,address_detail,category,categories,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,member_count,roster_by_grade,uniform_main,uniform_sub,desired_dates,note,updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setTeams([]);
      setToast({ type: "error", text: `読み込みに失敗しました: ${error.message}` });
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DbTeam[];
    setTeams(rows);

    const { data: authData } = await supabase.auth.getUser();
    const meId = authData?.user?.id ?? "";

    if (meId) {
      const own = rows.filter((t) => t.owner_id === meId);
      setMyTeams(own);
      if (!requestTeamId && own[0]?.id) {
        setRequestTeamId(own[0].id);
      }
    } else {
      setMyTeams([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => matchesTeamFilters(t, appliedFilters));
  }, [teams, appliedFilters]);

  const draftFilteredTeams = useMemo(() => {
    return teams.filter((t) => matchesTeamFilters(t, draftFilters));
  }, [teams, draftFilters]);

  const scrollToResults = () => {
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const scrollToFilter = () => {
    setTimeout(() => {
      filterRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const handleApplyAndJump = () => {
    applyDraftToApplied();
    setOpenTeamId("");
    scrollToResults();
  };

  const handleResetFilters = () => {
    clearAllFilters();
    setOpenTeamId("");
    scrollToResults();
  };

  const getOrCreateDmThread = async (myTeamId: string, otherTeamId: string) => {
    const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
      my_team_id: myTeamId,
      other_team_id: otherTeamId,
    });

    if (error) throw error;
    return data as string;
  };

  const openDmAndGo = async (otherTeamId: string) => {
    try {
      const myTeamId = requestTeamId || myTeams[0]?.id;
      if (!myTeamId) {
        alert("自分のチームがありません");
        return;
      }
      if (!otherTeamId || myTeamId === otherTeamId) return;

      const threadId = await getOrCreateDmThread(myTeamId, otherTeamId);
      window.location.href = `/chat/${threadId}`;
    } catch (e: any) {
      console.error(e);
      alert(`チャットを開けません: ${e?.message ?? "unknown error"}`);
    }
  };

  const openOfferModal = (team: DbTeam) => {
    if (!requestTeamId && !myTeams[0]?.id) {
      alert("自分のチームがありません");
      return;
    }
    setOfferTargetTeam(team);
    setOfferMessage("");
  };

  const sendOffer = async () => {
    try {
      if (!offerTargetTeam) return;

      const fromTeamId = requestTeamId || myTeams[0]?.id;
      if (!fromTeamId) {
        alert("自分のチームを選択してください");
        return;
      }
      if (fromTeamId === offerTargetTeam.id) {
        alert("自分自身のチームには送れません");
        return;
      }

      setSendingOffer(true);

      const { data: authData } = await supabase.auth.getUser();
      const meId = authData?.user?.id ?? "";
      if (!meId) {
        alert("ログインが必要です");
        setSendingOffer(false);
        return;
      }

      const { data: existingRows, error: existingErr } = await supabase
        .from("match_offers")
        .select("id, from_team_id, to_team_id, status, message, created_at")
        .eq("from_team_id", fromTeamId)
        .eq("to_team_id", offerTargetTeam.id)
        .in("status", ["pending", "accepted"])
        .limit(1);

      if (existingErr) {
        console.error(existingErr);
      }

      const existing = ((existingRows ?? []) as OfferRow[])[0];
      if (existing) {
        alert("この相手にはすでに有効なオファーを送っています");
        setSendingOffer(false);
        return;
      }

      const { data: insertedOffer, error } = await supabase
        .from("match_offers")
        .insert({
          from_team_id: fromTeamId,
          to_team_id: offerTargetTeam.id,
          from_user_id: meId,
          status: "pending",
          message: offerMessage.trim() || null,
        })
        .select("id, from_team_id, to_team_id, status, message, created_at")
        .single();

      if (error) {
        console.error(error);
        alert(`オファー送信に失敗しました: ${error.message}`);
        setSendingOffer(false);
        return;
      }

      const myTeam = myTeams.find((t) => t.id === fromTeamId);

      try {
        const { data: targetTeamRow, error: targetTeamErr } = await supabase
          .from("teams")
          .select("owner_id")
          .eq("id", offerTargetTeam.id)
          .maybeSingle();

        if (targetTeamErr) {
          console.error("target team owner fetch error:", targetTeamErr);
        }

        const targetUserId =
          (targetTeamRow as { owner_id?: string | null } | null)?.owner_id ?? "";

        if (targetUserId) {
          const notificationTitle = "新しい試合オファー";
          const notificationBody = `${
            myTeam?.name ?? "相手チーム"
          } からオファーが届きました`;
          const notificationUrl = "/match/status/offers-received";

          const { error: notificationErr } = await supabase
            .from("notifications")
            .insert({
              user_id: targetUserId,
              type: "match_offer",
              title: notificationTitle,
              body: notificationBody,
              target_url: notificationUrl,
              is_read: false,
              related_team_id: fromTeamId,
              related_offer_id: insertedOffer.id,
            });

          if (notificationErr) {
            console.error("notification insert error:", notificationErr);
          } else {
            try {
              const pushRes = await fetch("/api/push/send", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: targetUserId,
                  title: notificationTitle,
                  body: notificationBody,
                  url: notificationUrl,
                }),
              });

              if (!pushRes.ok) {
                const pushJson = await pushRes.json().catch(() => null);
                console.error("push send error:", pushJson ?? pushRes.statusText);
              }
            } catch (e) {
              console.error("push send fetch error:", e);
            }
          }
        }
      } catch (e) {
        console.error("offer notification error:", e);
      }

      try {
        const threadId = await getOrCreateDmThread(fromTeamId, offerTargetTeam.id);

        await supabase.from("chat_messages").insert({
          thread_id: threadId,
          sender_id: meId,
          sender_team_id: fromTeamId,
          body: [
            "【試合オファー】",
            `送信元チーム: ${myTeam?.name ?? "未設定"}`,
            `送信先チーム: ${offerTargetTeam.name ?? "未設定"}`,
            offerMessage.trim() ? `メッセージ: ${offerMessage.trim()}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      } catch (e) {
        console.error("offer chat relay failed:", e);
      }

      setOfferTargetTeam(null);
      setOfferMessage("");
      setToast({ type: "success", text: "オファーを送信しました" });
      setSendingOffer(false);
    } catch (e: any) {
      console.error(e);
      setSendingOffer(false);
      alert(e?.message ?? "オファー送信に失敗しました");
    }
  };

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
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
          role="status"
          aria-live="polite"
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
        icon="🔎"
        title="チーム検索"
        desc="試合を探すと同じ条件で絞り込みながら、対戦候補のチームを探せます。"
      />

      <div style={summaryWrap}>
        <div style={stickySummaryBar}>
          <div style={summaryHeaderRow}>
            <div>
              <div style={stickySummaryDate}>🔎 検索結果</div>
              <div style={stickySummaryCount}>
                入力中の候補（{draftFilteredTeams.length}件／{filteredTeams.length}件）
              </div>
            </div>

            <button type="button" className="sh-btn" onClick={scrollToFilter}>
              検索条件へ
            </button>
          </div>
        </div>
      </div>

      <div style={contentScrollBox}>
        <div ref={resultsRef} style={dayListWrap}>
          <div style={dayListHeaderRow}>
            <h2 style={dayListTitle}>検索結果</h2>

            <button type="button" className="sh-btn" onClick={scrollToFilter}>
              絞り込み
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#777" }}>読み込み中...</p>
          ) : filteredTeams.length === 0 ? (
            <div style={emptyBox}>条件に合うチームがありません。</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredTeams.map((team) => {
                const expanded = openTeamId === team.id;
                const isMyTeam = myTeams.some((t) => t.id === team.id);

                return (
                  <div key={team.id} style={resultCard}>
                    <div style={resultHeader}>
                      <div>
                        <div style={resultTitle}>{team.name ?? "（名称未設定）"}</div>
                        <div style={resultSub}>
                          📍 {buildAreaText(team)}
                          <br />
                          🏷{" "}
                          {Array.isArray(team.categories) && team.categories.length > 0
                            ? team.categories.join(" / ")
                            : team.category ?? "未設定"}
                          {" / "}💪 強さ {getStrength(team)}
                        </div>
                      </div>

                      <div style={resultHeaderRight}>
                        <span style={strengthBadge}>{getStrength(team)}</span>
                        <button
                          type="button"
                          className="sh-btn"
                          onClick={() => setOpenTeamId(expanded ? "" : team.id)}
                        >
                          {expanded ? "詳細を閉じる" : "詳細"}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div style={detailWrap}>
                        <div style={detailGrid}>
                          <div style={detailBox}>
                            <div style={detailLabel}>グラウンド・駐輪場</div>
                            <div style={detailValue}>
                              グラウンド {team.has_ground ? "あり" : "なし"} / 駐輪場 {formatBikeParking(team)}
                            </div>
                          </div>

                          <div style={detailBox}>
                            <div style={detailLabel}>所属人数</div>
                            <div style={detailValue}>{getMemberCount(team)}人</div>
                          </div>

                          <div style={detailBox}>
                            <div style={detailLabel}>ユニフォーム</div>
                            <div style={detailValue}>
                              {team.uniform_main ?? "不明"}（メイン） / {team.uniform_sub ?? "不明"}（サブ）
                            </div>
                          </div>

                          {team.note ? (
                            <div style={detailBox}>
                              <div style={detailLabel}>メモ</div>
                              <div style={detailValue}>{team.note}</div>
                            </div>
                          ) : null}
                        </div>

                        <div style={buttonRow}>
                          <button
                            type="button"
                            className="sh-btn sh-btn--primary"
                            onClick={() => openDmAndGo(team.id)}
                            disabled={loading || isMyTeam}
                          >
                            チャットを開く
                          </button>

                          <button
                            type="button"
                            className="sh-btn"
                            onClick={() => openOfferModal(team)}
                            disabled={loading || isMyTeam}
                          >
                            オファーを送る
                          </button>

                          <Link href="/match" className="sh-btn">
                            試合を探すへ
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <section ref={filterRef} style={filterWrap}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={filterHeaderRow}>
              <h2 style={filterTitle}>検索条件</h2>

              <button type="button" className="sh-btn" onClick={scrollToResults}>
                検索結果へ
              </button>
            </div>

            <label style={label}>
              <span style={labelTitle}>キーワード</span>

              <input
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                className="sh-input"
                disabled={loading}
                placeholder="例：三宿 / 青 / 強度高め / U-12 / SS"
              />
            </label>

            <AreaPickerKanto
              title="エリア"
              allowAll={true}
              allLabel="関東（すべて）"
              disabled={loading}
              prefecture={draftPrefectureFilter}
              setPrefecture={setDraftPrefectureFilter}
              city={draftCityFilter}
              setCity={setDraftCityFilter}
              town={draftTownFilter}
              setTown={setDraftTownFilter}
              townOptional={true}
              useChipUI={true}
            />

            <CheckboxGroup
              title="カテゴリ"
              options={CATEGORY_OPTIONS}
              values={draftCategoryFilter}
              onChange={setDraftCategoryFilter}
              columns={3}
              disabled={loading}
              useChipUI={true}
            />

            <div style={strengthCard}>
              <div style={strengthHead}>
                <div style={strengthTitleWrap}>
                  <div style={strengthTitleRow}>
                    <div style={strengthTitle}>強さ</div>
                    <button
                      type="button"
                      aria-label="強さの説明"
                      title="強さの説明"
                      style={helpButton}
                      onClick={() => setShowStrengthHelp(true)}
                      disabled={loading}
                    >
                      ?
                    </button>
                  </div>
                  <div style={strengthSubText}>複数選択できます</div>
                </div>

                <div style={strengthHeadRight}>
                  <button
                    type="button"
                    className="sh-btn sh-btn--ghost"
                    onClick={() =>
                      setDraftStrengthFilter(STRENGTH_OPTIONS.map((o) => o.value as StrengthRank))
                    }
                    disabled={loading}
                  >
                    全選択
                  </button>

                  <button
                    type="button"
                    className="sh-btn"
                    onClick={() => setDraftStrengthFilter([])}
                    disabled={loading}
                  >
                    クリア
                  </button>
                </div>
              </div>

              <div style={strengthSimpleList}>
                {STRENGTH_GUIDES.map((item) => {
                  const active = draftStrengthFilter.includes(item.rank);

                  return (
                    <button
                      key={item.rank}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setDraftStrengthFilter((prev) => {
                          if (prev.includes(item.rank)) {
                            return prev.filter((v) => v !== item.rank);
                          }
                          return [...prev, item.rank];
                        });
                      }}
                      aria-pressed={active}
                      style={{
                        ...strengthSimpleButton,
                        border: active ? "1px solid #145c2a" : "1px solid #d6eadb",
                        background: active ? "#145c2a" : "#fff",
                        color: active ? "#fff" : "#23412c",
                        boxShadow: active ? "0 6px 14px rgba(20,92,42,0.14)" : "none",
                        ...(loading ? strengthSimpleButtonDisabled : {}),
                      }}
                    >
                      <span style={strengthSimpleCode}>{item.rank}</span>
                      <span>{item.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={twoCols}>
              <label style={label}>
                <span style={labelTitle}>チーム所属人数（以上）</span>

                <select
                  value={draftMemberCountMin}
                  onChange={(e) => setDraftMemberCountMin(e.target.value)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="">指定なし</option>
                  <option value="5">5人以上</option>
                  <option value="10">10人以上</option>
                  <option value="15">15人以上</option>
                  <option value="20">20人以上</option>
                  <option value="25">25人以上</option>
                  <option value="30">30人以上</option>
                </select>
              </label>

              <label style={label}>
                <span style={labelTitle}>グラウンド</span>

                <select
                  value={draftGroundFilter}
                  onChange={(e) => setDraftGroundFilter(e.target.value as any)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="all">指定なし</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                </select>
              </label>
            </div>

            <div style={twoCols}>
              <label style={label}>
                <span style={labelTitle}>駐輪場</span>

                <select
                  value={draftBikeFilter}
                  onChange={(e) => setDraftBikeFilter(e.target.value as any)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="all">指定なし</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                  <option value="不明">不明</option>
                </select>
              </label>

              <label style={label}>
                <span style={labelTitle}>駐輪場台数（以上）</span>

                <select
                  value={draftBikeCapacityMin}
                  onChange={(e) => setDraftBikeCapacityMin(e.target.value)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="">指定なし</option>
                  <option value="5">5台以上</option>
                  <option value="10">10台以上</option>
                  <option value="15">15台以上</option>
                  <option value="20">20台以上</option>
                  <option value="25">25台以上</option>
                  <option value="30">30台以上</option>
                  <option value="40">40台以上</option>
                  <option value="50">50台以上</option>
                </select>
              </label>
            </div>

            <div style={actionRow}>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={handleApplyAndJump}
                disabled={!hasDraftChanges || loading}
              >
                この条件で一覧表示
              </button>

              <button
                type="button"
                className="sh-btn"
                onClick={handleResetFilters}
                disabled={loading}
              >
                条件リセット
              </button>
            </div>
          </div>
        </section>
      </div>

      {showStrengthHelp ? (
        <div
          style={modalOverlay}
          onClick={() => setShowStrengthHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-label="強さの説明"
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>強さの説明</h3>
              <button
                type="button"
                style={modalCloseButton}
                onClick={() => setShowStrengthHelp(false)}
              >
                閉じる
              </button>
            </div>

            <div style={guideList}>
              {STRENGTH_GUIDES.map((item) => (
                <div key={item.rank} style={guideCard}>
                  <div style={guideTop}>
                    <div style={guideRank}>{item.rank}</div>
                    <div style={guideShort}>{item.short}</div>
                  </div>

                  <div style={guideTitleText}>{item.title}</div>

                  <div style={guideBulletList}>
                    {item.bullets.map((bullet) => (
                      <div key={bullet} style={guideBulletRow}>
                        <span style={guideBulletMark}>•</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  <div style={guideNote}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {offerTargetTeam ? (
        <div
          style={modalOverlay}
          onClick={() => {
            if (!sendingOffer) {
              setOfferTargetTeam(null);
              setOfferMessage("");
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="オファー送信"
        >
          <div style={offerModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>オファー送信</h3>
              <button
                type="button"
                style={modalCloseButton}
                onClick={() => {
                  if (!sendingOffer) {
                    setOfferTargetTeam(null);
                    setOfferMessage("");
                  }
                }}
                disabled={sendingOffer}
              >
                閉じる
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={offerInfoBox}>
                <div style={detailLabel}>送信先</div>
                <div style={detailValue}>
                  {offerTargetTeam.name ?? "未設定"}
                  {offerTargetTeam.category ? `（${offerTargetTeam.category}）` : ""}
                  <br />
                  {buildAreaText(offerTargetTeam)}
                </div>
              </div>

              <label style={label}>
                <span style={labelTitle}>送信元チーム</span>
                <select
                  value={requestTeamId}
                  onChange={(e) => setRequestTeamId(e.target.value)}
                  className="sh-select"
                  disabled={sendingOffer}
                >
                  {myTeams.length === 0 ? (
                    <option value="">自分のチームがありません</option>
                  ) : (
                    myTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name ?? "チーム未設定"}
                        {t.category ? `（${t.category}）` : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label style={label}>
                <span style={labelTitle}>メッセージ</span>
                <textarea
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  placeholder="例：3月後半〜4月前半で練習試合のご相談をしたいです。ご都合いかがでしょうか。"
                  disabled={sendingOffer}
                  style={textareaStyle}
                />
              </label>

              <div style={buttonRow}>
                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={sendOffer}
                  disabled={sendingOffer || myTeams.length === 0 || !requestTeamId}
                >
                  {sendingOffer ? "送信中…" : "オファーを送信"}
                </button>

                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => {
                    if (!sendingOffer) {
                      setOfferTargetTeam(null);
                      setOfferMessage("");
                    }
                  }}
                  disabled={sendingOffer}
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const summaryWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
};

const summaryHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
};

const contentScrollBox: React.CSSProperties = {
  maxHeight: "calc(100vh - 260px)",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const dayListWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const stickySummaryBar: React.CSSProperties = {
  border: "1px solid #dce9df",
  background: "#f7fbf8",
  borderRadius: 18,
  padding: "14px 16px",
};

const stickySummaryDate: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#245233",
};

const stickySummaryCount: React.CSSProperties = {
  marginTop: 4,
  fontSize: 14,
  color: "#3b6a49",
};

const dayListHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

const dayListTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

const filterHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
};

const filterTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  alignItems: "start",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const strengthCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const strengthHead: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

const strengthTitleWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const strengthTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const strengthTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
};

const strengthSubText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const strengthHeadRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap" as const,
};

const helpButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#23412c",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  transition: "all 0.15s ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

const strengthSimpleList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const strengthSimpleButton: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d6eadb",
  background: "#fff",
  cursor: "pointer",
  transition: "all 0.15s ease",
  fontSize: 14,
  fontWeight: 800,
  color: "#23412c",
  lineHeight: 1.5,
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

const strengthSimpleButtonDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const strengthSimpleCode: React.CSSProperties = {
  display: "inline-block",
  minWidth: 28,
  fontWeight: 900,
};

const resultCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const resultHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap" as const,
};

const resultHeaderRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const resultTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const resultSub: React.CSSProperties = {
  marginTop: 8,
  color: "#666",
  lineHeight: 1.8,
};

const strengthBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#f5c542",
  color: "#3a2b00",
  fontWeight: 900,
  fontSize: 12,
};

const detailWrap: React.CSSProperties = {
  marginTop: 14,
};

const detailGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const detailBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

const detailLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const detailValue: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap" as const,
};

const buttonRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
};

const emptyBox: React.CSSProperties = {
  padding: 20,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fff",
  color: "#777",
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

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 2000,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "80vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5ece7",
  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  padding: 18,
};

const offerModalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 640,
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5ece7",
  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  padding: 18,
};

const offerInfoBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  position: "sticky",
  top: 0,
  background: "#fff",
  paddingBottom: 8,
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const modalCloseButton: React.CSSProperties = {
  border: "1px solid #d6ded9",
  background: "#fff",
  borderRadius: 12,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  resize: "vertical",
  border: "1px solid #d6ded9",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  lineHeight: 1.7,
  background: "#fff",
};

const guideList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const guideCard: React.CSSProperties = {
  border: "1px solid #e7ece9",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 14,
};

const guideTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap" as const,
};

const guideRank: React.CSSProperties = {
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#145c2a",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const guideShort: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
  fontSize: 15,
};

const guideTitleText: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 800,
  color: "#314137",
  lineHeight: 1.7,
};

const guideBulletList: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
};

const guideBulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 8,
  alignItems: "start",
  color: "#314137",
  fontSize: 14,
  lineHeight: 1.7,
};

const guideBulletMark: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const guideNote: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e7d08a",
  background: "#fff8dd",
  color: "#4d3a00",
  fontWeight: 800,
  lineHeight: 1.7,
  fontSize: 13,
};