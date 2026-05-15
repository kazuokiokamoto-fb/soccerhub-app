"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel } from "@/app/lib/categories";

import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";
import { useMatchData } from "@/app/match/hooks/useMatchData";

import {
  startOfMonth,
  ymdToday,
} from "@/app/match/utils/date";
import { matchesSlotFilters } from "@/app/match/utils/filters";

import type { StrengthRank } from "@/app/components/StrengthRankPicker";
import { MatchHelpModals } from "@/app/match/components/MatchHelpModals";
import { SelectionSection } from "@/app/home/components/SelectionSection";

type PanelMode = "none" | "team";

type MyScheduleItem = {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  areaText: string;
  categoryText: string;
  role: "host" | "guest";
};

function norm(v?: string | null) {
  return String(v ?? "").trim();
}

function levelToRank(level?: number | null) {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v || v === "不明") return null;
  if (v.includes("50")) return 50;

  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function filterSummaryTextFromFilters(filters: {
  keyword: string;
  categoryFilter: string[];
  prefectureFilter: string;
  cityFilter: string;
  townFilter: string;
  groundFilter: "all" | "あり" | "なし";
  strengthFilter: StrengthRank[];
  bikeFilter: "all" | "あり" | "なし" | "不明";
  bikeCapacityMin: string;
  memberCountMin: string;
}) {
  const parts: string[] = [];

  if (filters.keyword.trim()) {
    parts.push(`キーワード: ${filters.keyword.trim()}`);
  }

  if (filters.prefectureFilter) {
    parts.push(`都道府県: ${filters.prefectureFilter}`);
  }

  if (filters.cityFilter) {
    parts.push(`市区町村: ${filters.cityFilter}`);
  }

  if (filters.townFilter) {
    parts.push(`町名: ${filters.townFilter}`);
  }

  if (filters.categoryFilter.length > 0) {
    parts.push(
      `カテゴリ: ${filters.categoryFilter
        .map((v) => categoryLabel(v) || v)
        .join(" / ")}`
    );
  }

  if (filters.groundFilter !== "all") {
    parts.push(`グラウンド: ${filters.groundFilter}`);
  }

  if (filters.strengthFilter.length > 0) {
    parts.push(`強さ: ${filters.strengthFilter.join(" / ")}`);
  }

  if (filters.bikeFilter !== "all") {
    parts.push(`駐輪場: ${filters.bikeFilter}`);
  }

  if (filters.bikeCapacityMin) {
    parts.push(`駐輪場台数: ${filters.bikeCapacityMin}台以上`);
  }

  if (filters.memberCountMin) {
    parts.push(`所属人数: ${filters.memberCountMin}人以上`);
  }

  return parts.join(" / ");
}

function teamMatchesFilters(
  team: any,
  filters: {
    keyword: string;
    categoryFilter: string[];
    prefectureFilter: string;
    cityFilter: string;
    townFilter: string;
    groundFilter: "all" | "あり" | "なし";
    strengthFilter: StrengthRank[];
    bikeFilter: "all" | "あり" | "なし" | "不明";
    bikeCapacityMin: string;
    memberCountMin: string;
  }
) {
  if (!team) return false;

  const teamCategories =
    Array.isArray(team.categories) && team.categories.length > 0
      ? team.categories
      : team.category
        ? [team.category]
        : [];

  if (filters.categoryFilter.length > 0) {
    const ok = teamCategories.some((c: string) =>
      filters.categoryFilter.includes(String(c).trim())
    );
    if (!ok) return false;
  }

  if (
    filters.prefectureFilter &&
    norm(team.prefecture) !== filters.prefectureFilter
  ) {
    return false;
  }

  if (filters.cityFilter && norm(team.city) !== filters.cityFilter) {
    return false;
  }

  if (filters.townFilter && norm(team.town) !== filters.townFilter) {
    return false;
  }

  if (filters.groundFilter !== "all") {
    const ground = team.has_ground ? "あり" : "なし";
    if (ground !== filters.groundFilter) return false;
  }

  if (filters.strengthFilter.length > 0) {
    const rank = team.strength_rank || levelToRank(team.level);
    if (!filters.strengthFilter.includes(rank)) return false;
  }

  if (filters.bikeFilter !== "all") {
    const bike = (team.bike_parking ?? "不明") as "あり" | "なし" | "不明";
    if (bike !== filters.bikeFilter) return false;
  }

  if (filters.bikeCapacityMin) {
    const cap = parseBikeCapacity(team.bike_parking_capacity);
    if (cap == null || cap < Number(filters.bikeCapacityMin)) return false;
  }

  if (filters.memberCountMin) {
    const count = Number(team.member_count ?? 0);
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
      ...(teamCategories ?? []),
      team.uniform_main,
      team.uniform_sub,
      team.note,
      team.bike_parking,
      team.bike_parking_capacity,
      String(team.member_count ?? ""),
      String(team.strength_rank ?? ""),
      levelToRank(team.level),
    ]
      .join(" ")
      .toLowerCase();

    if (!hay.includes(q)) return false;
  }

  return true;
}

function formatScheduleDate(ymd: string) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${m}/${d}`;
}

export default function HomeCalendar(props: {
  initialPanelMode?: PanelMode;
}) {
  const { initialPanelMode = "none" } = props;

  const { user, loading: authLoading } = useAuth();
  const authUserId = user?.id ?? "";

  const [monthDate] = useState<Date>(() => startOfMonth(new Date()));
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  const [showCalendarHelp, setShowCalendarHelp] = useState(false);

  const [myUpcomingSchedules, setMyUpcomingSchedules] = useState<
    MyScheduleItem[]
  >([]);
  const [myScheduleLoading, setMyScheduleLoading] = useState(false);

  const { filters } = useMatchFilters();

  const authReady = !authLoading;

  const {
    loadingBase,
    loadingMonth,
    baseError,
    monthError,
    meId,
    allTeams,
    myTeams,
    slotsInMonth,
    loadMonth,
  } = useMatchData({
    monthDate,
    authReady,
    currentUserId: authUserId,
  });

  const loading = loadingBase || loadingMonth;
  const currentUserId = authUserId || meId;

  const myTeamIds = useMemo(() => myTeams.map((t: any) => t.id), [myTeams]);

  const teamMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t]));
  }, [allTeams]);

  const hasAnyActiveFilter = useMemo(() => {
    return (
      !!filters.keyword.trim() ||
      filters.categoryFilter.length > 0 ||
      !!filters.prefectureFilter ||
      !!filters.cityFilter ||
      !!filters.townFilter ||
      filters.groundFilter !== "all" ||
      filters.strengthFilter.length > 0 ||
      filters.bikeFilter !== "all" ||
      !!filters.bikeCapacityMin ||
      !!filters.memberCountMin
    );
  }, [filters]);

  const filteredSlotsInMonth = useMemo(() => {
    if (!hasAnyActiveFilter) return slotsInMonth;

    return slotsInMonth.filter((s: any) =>
      matchesSlotFilters(s, teamMap as any, filters)
    );
  }, [slotsInMonth, teamMap, filters, hasAnyActiveFilter]);

  const filteredTeams = useMemo(() => {
    if (!hasAnyActiveFilter) return allTeams;

    return allTeams.filter((team: any) => {
      return teamMatchesFilters(team, filters);
    });
  }, [allTeams, filters, hasAnyActiveFilter]);

  useEffect(() => {
    let active = true;

    const loadMyUpcomingSchedules = async () => {
      if (!authReady || myTeamIds.length === 0) {
        if (active) {
          setMyUpcomingSchedules([]);
          setMyScheduleLoading(false);
        }
        return;
      }

      setMyScheduleLoading(true);

      try {
        const today = ymdToday();

        const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
          .from("match_slots")
          .select(
            "id, date, start_time, end_time, area, area_text, category, host_team_id"
          )
          .in("host_team_id", myTeamIds)
          .gte("date", today)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(50);

        if (hostedSlotsError) throw hostedSlotsError;

        const hostedSlots = (hostedSlotsRaw ?? []) as any[];
        const hostedSlotIds = hostedSlots.map((slot) => slot.id);

        let hostedAcceptedSlotIds: string[] = [];

        if (hostedSlotIds.length > 0) {
          const { data: hostedAcceptedRaw, error: hostedAcceptedError } =
            await supabase
              .from("match_requests")
              .select("slot_id")
              .in("slot_id", hostedSlotIds)
              .eq("status", "accepted");

          if (hostedAcceptedError) throw hostedAcceptedError;

          hostedAcceptedSlotIds = Array.from(
            new Set(
              ((hostedAcceptedRaw ?? []) as Array<{ slot_id: string }>).map(
                (row) => row.slot_id
              )
            )
          );
        }

        const { data: requesterAcceptedRaw, error: requesterAcceptedError } =
          await supabase
            .from("match_requests")
            .select("slot_id, requester_team_id")
            .in("requester_team_id", myTeamIds)
            .eq("status", "accepted");

        if (requesterAcceptedError) throw requesterAcceptedError;

        const requesterAccepted = (requesterAcceptedRaw ?? []) as Array<{
          slot_id: string;
          requester_team_id: string;
        }>;

        const requesterSlotIds = Array.from(
          new Set(requesterAccepted.map((row) => row.slot_id))
        ).filter((id) => !hostedSlotIds.includes(id));

        let requesterSlots: any[] = [];

        if (requesterSlotIds.length > 0) {
          const { data: requesterSlotsRaw, error: requesterSlotsError } =
            await supabase
              .from("match_slots")
              .select(
                "id, date, start_time, end_time, area, area_text, category, host_team_id"
              )
              .in("id", requesterSlotIds)
              .gte("date", today)
              .order("date", { ascending: true })
              .order("start_time", { ascending: true });

          if (requesterSlotsError) throw requesterSlotsError;
          requesterSlots = (requesterSlotsRaw ?? []) as any[];
        }

        const hostedItems: MyScheduleItem[] = hostedSlots
          .filter((slot) => hostedAcceptedSlotIds.includes(slot.id))
          .map((slot) => ({
            slotId: slot.id,
            date: String(slot.date ?? ""),
            startTime: String(slot.start_time ?? ""),
            endTime: String(slot.end_time ?? ""),
            areaText: String(slot.area_text ?? slot.area ?? "未設定"),
            categoryText: String(
              categoryLabel(slot.category) || slot.category || "未設定"
            ),
            role: "host" as const,
          }));

        const requesterItems: MyScheduleItem[] = requesterSlots.map((slot) => ({
          slotId: slot.id,
          date: String(slot.date ?? ""),
          startTime: String(slot.start_time ?? ""),
          endTime: String(slot.end_time ?? ""),
          areaText: String(slot.area_text ?? slot.area ?? "未設定"),
          categoryText: String(
            categoryLabel(slot.category) || slot.category || "未設定"
          ),
          role: "guest" as const,
        }));

        const merged = [...hostedItems, ...requesterItems]
          .filter((item) => !!item.date)
          .sort((a, b) => {
            const aa = `${a.date} ${a.startTime}`;
            const bb = `${b.date} ${b.startTime}`;
            return aa.localeCompare(bb);
          });

        const deduped: MyScheduleItem[] = [];
        const seen = new Set<string>();

        for (const item of merged) {
          if (seen.has(item.slotId)) continue;
          seen.add(item.slotId);
          deduped.push(item);
        }

        if (!active) return;
        setMyUpcomingSchedules(deduped);
      } catch (e) {
        console.error("loadMyUpcomingSchedules error:", e);
        if (!active) return;
        setMyUpcomingSchedules([]);
      } finally {
        if (active) setMyScheduleLoading(false);
      }
    };

    void loadMyUpcomingSchedules();

    return () => {
      active = false;
    };
  }, [authReady, myTeamIds]);

  const filterSummaryText = useMemo(() => {
    const text = filterSummaryTextFromFilters(filters);
    return text || "すべての条件で表示中";
  }, [filters]);

  const totalTeamCountText = useMemo(() => {
    return `登録チーム総数：${allTeams.length}件`;
  }, [allTeams.length]);

  const totalOpenSlotCountText = useMemo(() => {
    const today = ymdToday();

    const count = slotsInMonth.filter((slot: any) => {
      return !slot.is_closed && slot.date >= today;
    }).length;

    return `試合募集中：${count}件`;
  }, [slotsInMonth]);

  const showCriticalError =
    (baseError && baseError.includes("teams:")) ||
    (monthError && monthError.includes("match_slots:"));

  const nextSchedule = myUpcomingSchedules[0] ?? null;

  return (
    <section style={wrap}>
      {showCriticalError ? (
        <div style={errorBox} className="ui-card">
          <div style={errorTitle} className="ui-title">
            読み込みエラー
          </div>

          {baseError && baseError.includes("teams:") ? (
            <div className="ui-body">基礎データ: {baseError}</div>
          ) : null}

          {monthError && monthError.includes("match_slots:") ? (
            <div className="ui-body">月データ: {monthError}</div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => {
                void loadMonth();
                window.location.reload();
              }}
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : null}

      <section style={summaryStatsBox} className="ui-card-soft">
        <div style={summaryStatsInner} className="ui-meta ui-strong">
          {totalTeamCountText}
          <span style={summaryStatsDivider}> / </span>
          {totalOpenSlotCountText}
        </div>
      </section>

      <Link href="/match/my-schedule" style={sectionLink}>
        <section style={summaryBoxClickable} className="ui-card">
          <div style={summaryCardTop}>
            <div style={summaryDateText} className="ui-title">
              マイスケジュール
            </div>
          </div>

          <div style={summaryInnerCompactBox} className="ui-card-soft">
            {myScheduleLoading ? (
              <div style={summarySub} className="ui-meta">
                予定を読み込み中…
              </div>
            ) : nextSchedule ? (
              <div>
                <div style={scheduleMainRow}>
                  <span style={scheduleDateBadge}>
                    {formatScheduleDate(nextSchedule.date)}
                  </span>

                  <span style={scheduleTimeText} className="ui-title">
                    {nextSchedule.startTime.slice(0, 5)}–
                    {nextSchedule.endTime.slice(0, 5)}
                  </span>

                  <span style={scheduleRoleBadge}>
                    {nextSchedule.role === "host" ? "主催" : "参加"}
                  </span>
                </div>

                <div style={summarySubTight} className="ui-meta">
                  {nextSchedule.categoryText} / {nextSchedule.areaText}
                </div>
              </div>
            ) : (
              <div>
                <div style={summaryCountLineCompact} className="ui-title">
                  直近の予定はありません。
                </div>

                <div style={summarySubTight} className="ui-meta">
                  予定確認・予定作成はこちら
                </div>
              </div>
            )}

            <div style={summaryActionRowCompact}>
              <span style={sectionCta}>予定ページを見る →</span>
            </div>
          </div>
        </section>
      </Link>

      <Link href="/teams/search" style={sectionLink}>
        <section style={summaryBoxClickable} className="ui-card">
          <div style={summaryCardTop}>
            <div style={summaryDateText} className="ui-title">
              練習試合を探す
            </div>
          </div>

          <div style={summaryInnerCompactBox} className="ui-card-soft">
            <div>
              <div style={summaryCountLineCompact} className="ui-title">
                対象チーム数：{filteredTeams.length}件
              </div>

              <div style={summarySubTight} className="ui-meta">
                表示条件：{filterSummaryText}
              </div>
            </div>

            <div style={summaryActionRowCompact}>
              <span style={sectionCta}>条件検索へ →</span>
            </div>
          </div>
        </section>
      </Link>

      <SelectionSection />

      <MatchHelpModals
        showStrengthHelp={showStrengthHelp}
        showCalendarHelp={showCalendarHelp}
        onCloseStrengthHelp={() => setShowStrengthHelp(false)}
        onCloseCalendarHelp={() => setShowCalendarHelp(false)}
        strengthGuides={[]}
      />
    </section>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const errorBox: React.CSSProperties = {
  padding: 10,
  fontSize: 14,
  lineHeight: 1.6,
};

const errorTitle: React.CSSProperties = {
  marginBottom: 4,
};

const summaryStatsBox: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
};

const summaryStatsInner: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  textAlign: "center",
};

const summaryStatsDivider: React.CSSProperties = {
  opacity: 0.7,
};

const summaryBox: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
};

const summaryBoxClickable: React.CSSProperties = {
  ...summaryBox,
  cursor: "pointer",
};

const sectionLink: React.CSSProperties = {
  display: "block",
  color: "inherit",
  textDecoration: "none",
};

const summaryCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const summaryDateText: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
};

const summaryInnerCompactBox: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  display: "grid",
  gap: 10,
};

const summaryActionRowCompact: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const summaryCountLineCompact: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
};

const summarySub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  lineHeight: 1.6,
};

const summarySubTight: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
};

const scheduleMainRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0,
};

const scheduleDateBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 13,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

const scheduleTimeText: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.4,
};

const scheduleRoleBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #dce9df",
};

const sectionCta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 999,
  background: "#0f7a35",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};