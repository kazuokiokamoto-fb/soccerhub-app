"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { categoryLabel } from "@/app/lib/categories";
import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";

import {
  DbTeam,
  OfferRow,
  Toast,
  STRENGTH_GUIDES,
  STRENGTH_OPTIONS,
  buildAreaText,
  matchesTeamFilters,
} from "./teamSearchUtils";

import {
  summaryWrap,
  summaryHeaderRow,
  pageStack,
  stickySummaryBar,
  stickySummaryDate,
  stickySummaryCount,
  toastBox,
  toastSuccess,
  toastError,
  toastInfo,
  toastClose,
  modalOverlay,
  modalCard,
  offerModalCard,
  offerInfoBox,
  modalHeader,
  modalTitle,
  modalCloseButton,
  textareaStyle,
  guideList,
  guideCard,
  guideTop,
  guideRank,
  guideShort,
  guideTitleText,
  guideBulletList,
  guideBulletRow,
  guideBulletMark,
  guideNote,
  detailLabel,
  detailValue,
  label,
  labelTitle,
  buttonRow,
} from "./teamSearchStyles";

import { TeamSearchResultList } from "./TeamSearchResultList";
import { TeamSearchFilterPanel } from "./TeamSearchFilterPanel";

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
  const filterRef = useRef<HTMLElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const {
    keyword,
    setKeyword,
    categoryFilter,
    setCategoryFilter,
    prefectureFilter,
    setPrefectureFilter,
    cityFilter,
    setCityFilter,
    townFilter,
    setTownFilter,
    groundFilter,
    setGroundFilter,
    strengthFilter,
    setStrengthFilter,
    bikeFilter,
    setBikeFilter,
    bikeCapacityMin,
    setBikeCapacityMin,
    memberCountMin,
    setMemberCountMin,
    filters,
    clearAllFilters,
  } = useMatchFilters();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

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
      setToast({
        type: "error",
        text: `読み込みに失敗しました: ${error.message}`,
      });
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
    void load();
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => matchesTeamFilters(t, filters));
  }, [teams, filters]);

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

      let threadId = "";
      try {
        threadId = await getOrCreateDmThread(fromTeamId, offerTargetTeam.id);
      } catch (e) {
        console.error("thread create failed:", e);
      }

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
          const notificationUrl = threadId ? `/chat/${threadId}` : "/chat";

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
              related_thread_id: threadId || null,
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
        if (!threadId) {
          threadId = await getOrCreateDmThread(fromTeamId, offerTargetTeam.id);
        }

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
    <main
      style={{
        height: "100dvh",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        maxWidth: 980,
        margin: "0 auto",
        background: "#fff",
      }}
    >
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
                ? toastError
                : toastInfo),
            margin: "12px 16px 0",
            flexShrink: 0,
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

      <div style={{ flexShrink: 0, padding: "16px 16px 0" }}>
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
                <div style={stickySummaryCount}>{filteredTeams.length}件ヒット</div>
              </div>

              <button type="button" className="sh-btn" onClick={scrollToFilter}>
                検索条件へ
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          padding: "0 16px 16px",
        }}
      >
        <div style={pageStack}>
          <TeamSearchResultList
            loading={loading}
            filteredTeams={filteredTeams}
            myTeams={myTeams}
            openTeamId={openTeamId}
            setOpenTeamId={setOpenTeamId}
            resultsRef={resultsRef}
            onScrollToFilter={scrollToFilter}
            onOpenDmAndGo={openDmAndGo}
            onOpenOfferModal={openOfferModal}
          />

          <TeamSearchFilterPanel
            filterRef={filterRef}
            loading={loading}
            keyword={keyword}
            setKeyword={setKeyword}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            prefectureFilter={prefectureFilter}
            setPrefectureFilter={setPrefectureFilter}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
            townFilter={townFilter}
            setTownFilter={setTownFilter}
            groundFilter={groundFilter}
            setGroundFilter={setGroundFilter}
            strengthFilter={strengthFilter}
            setStrengthFilter={setStrengthFilter}
            bikeFilter={bikeFilter}
            setBikeFilter={setBikeFilter}
            bikeCapacityMin={bikeCapacityMin}
            setBikeCapacityMin={setBikeCapacityMin}
            memberCountMin={memberCountMin}
            setMemberCountMin={setMemberCountMin}
            onReset={handleResetFilters}
            onBackToResults={scrollToResults}
            onOpenStrengthHelp={() => setShowStrengthHelp(true)}
            strengthGuides={STRENGTH_GUIDES}
            strengthOptions={STRENGTH_OPTIONS}
            liveCount={filteredTeams.length}
          />
        </div>
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
                  {offerTargetTeam.category
                    ? `（${
                        categoryLabel(offerTargetTeam.category) ||
                        offerTargetTeam.category
                      }）`
                    : ""}
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
                        {t.category
                          ? `（${categoryLabel(t.category) || t.category}）`
                          : ""}
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