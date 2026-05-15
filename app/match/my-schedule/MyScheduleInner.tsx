// /app/match/my-schedule/MyScheduleInner.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel } from "@/app/lib/categories";

import {
  buildCalendarCells,
  addMonths,
  startOfMonth,
  toMonthKey,
  ymdToday,
} from "@/app/match/utils/date";

import {
  MatchCalendarBase,
  type CalendarItem,
} from "@/app/match/components/MatchCalendarBase";

type Role = "owner" | "coach" | "member";

type TeamIdRow = {
  id: string;
};

type TeamMemberRow = {
  team_id: string;
  user_id?: string;
  role?: Role | string;
};

type MatchSlotRow = {
  id: string;
  host_team_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  area: string | null;
  area_text: string | null;
  category: string | null;
  is_closed: boolean | null;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

type MyScheduleItem = {
  id: string;
  slotId: string;
  teamId: string;
  opponentTeamId: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  opponent: string;
  strength: string | null;
  venueName: string | null;
  address: string | null;
  status: "confirmed" | "draft";
  role: "host" | "guest";
};

type StatusFilter = "all" | "confirmed" | "draft";
type RoleFilter = "all" | "host" | "guest";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asBooleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function toArray<T>(value: unknown, mapper: (v: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

function toTeamIdRow(value: unknown): TeamIdRow | null {
  const r = asRecord(value);
  if (!r) return null;
  const id = asString(r.id);
  if (!id) return null;
  return { id };
}

function toTeamMemberRow(value: unknown): TeamMemberRow | null {
  const r = asRecord(value);
  if (!r) return null;
  const team_id = asString(r.team_id);
  if (!team_id) return null;

  return {
    team_id,
    user_id: asString(r.user_id),
    role: asString(r.role),
  };
}

function toMatchSlotRow(value: unknown): MatchSlotRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const host_team_id = asString(r.host_team_id);
  const date = asString(r.date);

  if (!id || !host_team_id || !date) return null;

  return {
    id,
    host_team_id,
    date,
    start_time: asNullableString(r.start_time),
    end_time: asNullableString(r.end_time),
    area: asNullableString(r.area),
    area_text: asNullableString(r.area_text),
    category: asNullableString(r.category),
    is_closed: asBooleanOrNull(r.is_closed),
  };
}

function toMatchRequestRow(value: unknown): MatchRequestRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const slot_id = asString(r.slot_id);
  const requester_team_id = asString(r.requester_team_id);
  const status = asString(r.status) as MatchRequestRow["status"];

  if (!id || !slot_id || !requester_team_id || !status) return null;

  return {
    id,
    slot_id,
    requester_team_id,
    status,
  };
}

function formatDate(date?: string | null) {
  if (!date) return "未定";
  return new Date(date).toLocaleDateString("ja-JP");
}

function formatDateLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;

  const dt = new Date(y, m - 1, d);
  const week = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];

  return `${m}/${d}（${week}）`;
}

function formatTime(v?: string | null) {
  if (!v) return "未定";
  return String(v).slice(0, 5);
}

function statusLabel(status?: "confirmed" | "draft" | null) {
  return status === "confirmed" ? "確定" : "交渉";
}

function roleLabel(role?: "host" | "guest" | null) {
  return role === "host" ? "主催" : "参加";
}

function teamStrengthLabel(team: any) {
  if (!team) return null;

  if (typeof team.strength_rank === "string" && team.strength_rank.trim()) {
    return team.strength_rank;
  }

  const level = Number(team.level ?? 0);
  if (!Number.isFinite(level)) return null;
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function statusStyle(status?: string): React.CSSProperties {
  if (status === "confirmed") {
    return {
      background: "#ecfdf3",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  return {
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
  };
}

function sortByDate(rows: MyScheduleItem[]) {
  return [...rows].sort((a, b) => {
    const aa = `${a.date} ${a.startTime ?? ""}`;
    const bb = `${b.date} ${b.startTime ?? ""}`;
    return aa.localeCompare(bb);
  });
}

export default function MyScheduleInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const userId = user?.id ?? "";
  const dateParam = searchParams.get("date") ?? "";

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<MyScheduleItem[]>([]);
  const [errorText, setErrorText] = useState("");

  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [category, setCategory] = useState("all");

  const [showCalendar, setShowCalendar] = useState(true);
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(dateParam);

  useEffect(() => {
    if (dateParam) {
      setSelectedDate(dateParam);
      setMonthDate(startOfMonth(new Date(dateParam)));
    }
  }, [dateParam]);

  const load = async () => {
    if (authLoading) return;

    if (!userId) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      const { data: ownerTeamsRaw, error: ownerTeamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", userId);

      if (ownerTeamsError) throw ownerTeamsError;

      const { data: memberTeamsRaw, error: memberTeamsError } = await supabase
        .from("team_members")
        .select("team_id,user_id,role")
        .eq("user_id", userId);

      if (memberTeamsError) throw memberTeamsError;

      const ownerTeamIds = toArray(ownerTeamsRaw, toTeamIdRow).map(
        (row) => row.id
      );

      const memberRows = toArray(memberTeamsRaw, toTeamMemberRow);
      const memberTeamIds = memberRows.map((row) => row.team_id);

      const myTeamIds = Array.from(new Set([...ownerTeamIds, ...memberTeamIds]));

      if (myTeamIds.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const { data: allTeamsRaw, error: allTeamsError } = await supabase
        .from("teams")
        .select("id,name,level,strength_rank,owner_id")
        .order("updated_at", { ascending: false });

      if (allTeamsError) throw allTeamsError;

      const allTeams = Array.isArray(allTeamsRaw) ? allTeamsRaw : [];
      const teamMap = new Map(allTeams.map((t: any) => [t.id, t]));

      const today = ymdToday();

      const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
        .from("match_slots")
        .select(
          "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed"
        )
        .in("host_team_id", myTeamIds)
        .gte("date", today)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(300);

      if (hostedSlotsError) throw hostedSlotsError;

      const hostedSlots = toArray(hostedSlotsRaw, toMatchSlotRow);
      const hostedSlotIds = hostedSlots.map((slot) => slot.id);

      let hostedRequests: MatchRequestRow[] = [];

      if (hostedSlotIds.length > 0) {
        const { data: hostedRequestsRaw, error: hostedRequestsError } =
          await supabase
            .from("match_requests")
            .select("id,slot_id,requester_team_id,status")
            .in("slot_id", hostedSlotIds)
            .in("status", ["pending", "accepted"]);

        if (hostedRequestsError) throw hostedRequestsError;

        hostedRequests = toArray(hostedRequestsRaw, toMatchRequestRow);
      }

      const hostedRequestBySlotId = new Map<string, MatchRequestRow>();

      for (const req of hostedRequests) {
        const current = hostedRequestBySlotId.get(req.slot_id);

        if (!current || req.status === "accepted") {
          hostedRequestBySlotId.set(req.slot_id, req);
        }
      }

      const { data: requesterRequestsRaw, error: requesterRequestsError } =
        await supabase
          .from("match_requests")
          .select("id,slot_id,requester_team_id,status")
          .in("requester_team_id", myTeamIds)
          .in("status", ["pending", "accepted"]);

      if (requesterRequestsError) throw requesterRequestsError;

      const requesterRequests = toArray(
        requesterRequestsRaw,
        toMatchRequestRow
      );

      const requesterSlotIds = Array.from(
        new Set(requesterRequests.map((row) => row.slot_id))
      ).filter((id) => !hostedSlotIds.includes(id));

      let requesterSlots: MatchSlotRow[] = [];

      if (requesterSlotIds.length > 0) {
        const { data: requesterSlotsRaw, error: requesterSlotsError } =
          await supabase
            .from("match_slots")
            .select(
              "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed"
            )
            .in("id", requesterSlotIds)
            .gte("date", today)
            .order("date", { ascending: true })
            .order("start_time", { ascending: true });

        if (requesterSlotsError) throw requesterSlotsError;

        requesterSlots = toArray(requesterSlotsRaw, toMatchSlotRow);
      }

      const requesterRequestBySlotId = new Map<string, MatchRequestRow>();

      for (const req of requesterRequests) {
        const current = requesterRequestBySlotId.get(req.slot_id);

        if (!current || req.status === "accepted") {
          requesterRequestBySlotId.set(req.slot_id, req);
        }
      }

      const hostedItems: MyScheduleItem[] = hostedSlots.map((slot) => {
        const req = hostedRequestBySlotId.get(slot.id);
        const opponentTeamId = req?.requester_team_id ?? null;
        const opponentTeam = opponentTeamId ? teamMap.get(opponentTeamId) : null;

        return {
          id: `host:${slot.id}`,
          slotId: slot.id,
          teamId: slot.host_team_id,
          opponentTeamId,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          category: categoryLabel(slot.category) || slot.category || "未設定",
          opponent: opponentTeam?.name || (req ? "対戦相手未設定" : "募集中"),
          strength: teamStrengthLabel(opponentTeam),
          venueName: slot.area_text || slot.area || null,
          address: slot.area_text || slot.area || null,
          status: req?.status === "accepted" ? "confirmed" : "draft",
          role: "host",
        };
      });

      const requesterItems: MyScheduleItem[] = requesterSlots.map((slot) => {
        const req = requesterRequestBySlotId.get(slot.id);
        const hostTeamId = slot.host_team_id;
        const hostTeam = teamMap.get(hostTeamId);
        const myRequestTeamId =
          req?.requester_team_id && myTeamIds.includes(req.requester_team_id)
            ? req.requester_team_id
            : myTeamIds[0];

        return {
          id: `guest:${slot.id}`,
          slotId: slot.id,
          teamId: myRequestTeamId,
          opponentTeamId: hostTeamId,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          category: categoryLabel(slot.category) || slot.category || "未設定",
          opponent: hostTeam?.name || "対戦相手未設定",
          strength: teamStrengthLabel(hostTeam),
          venueName: slot.area_text || slot.area || null,
          address: slot.area_text || slot.area || null,
          status: req?.status === "accepted" ? "confirmed" : "draft",
          role: "guest",
        };
      });

      const merged = sortByDate([...hostedItems, ...requesterItems]);

      const deduped: MyScheduleItem[] = [];
      const seen = new Set<string>();

      for (const item of merged) {
        const key = `${item.slotId}:${item.teamId}:${item.role}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }

      setSchedules(deduped);
    } catch (e: any) {
      console.error(e);
      setSchedules([]);
      setErrorText(e?.message ?? "予定の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId]);

  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  const categories = useMemo(() => {
    return Array.from(new Set(schedules.map((v) => v.category).filter(Boolean))).sort();
  }, [schedules]);

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    const rows = schedules.filter((item) => {
      if (selectedDate && item.date !== selectedDate) return false;
      if (status !== "all" && item.status !== status) return false;
      if (role !== "all" && item.role !== role) return false;
      if (category !== "all" && item.category !== category) return false;

      if (q) {
        const hay = [
          item.category,
          item.opponent,
          item.strength,
          item.venueName,
          item.address,
          item.role,
          item.status,
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return sortByDate(rows);
  }, [schedules, keyword, status, role, category, selectedDate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    const grouped = new Map<
      string,
      {
        confirmed: number;
        draft: number;
      }
    >();

    for (const item of schedules) {
      const current = grouped.get(item.date) ?? {
        confirmed: 0,
        draft: 0,
      };

      if (item.status === "confirmed") {
        current.confirmed += 1;
      } else {
        current.draft += 1;
      }

      grouped.set(item.date, current);
    }

    for (const [ymd, count] of grouped.entries()) {
      const calendarItems: CalendarItem[] = [];

      if (count.confirmed > 0) {
        calendarItems.push({
          label: "決定",
          count: count.confirmed,
          tone: "decided",
        });
      }

      if (count.draft > 0) {
        calendarItems.push({
          label: "交渉",
          count: count.draft,
          tone: "negotiating",
        });
      }

      map.set(ymd, calendarItems);
    }

    return map;
  }, [schedules]);

  const selectedDateText = useMemo(() => {
    if (!selectedDate) return "すべての日程";
    return `${formatDate(selectedDate)} 予定分`;
  }, [selectedDate]);

  const clearFilters = () => {
    setKeyword("");
    setStatus("all");
    setRole("all");
    setCategory("all");
    setSelectedDate("");
  };

  const openCreatePage = () => {
    const params = new URLSearchParams();
    params.set("date", selectedDate || ymdToday());

    window.location.href = `/match/my-schedule/new?${params.toString()}`;
  };

  return (
    <main style={wrap}>
      <div style={topBar}>
        <Link href="/" className="sh-btn">
          ← ホーム
        </Link>

        <div style={pageTitle}>マイスケジュール</div>
      </div>

      <section className="ui-card" style={searchBox}>
        <div style={searchHeader}>
          <div className="ui-title" style={searchTitle}>
            条件検索
          </div>

          <div style={headerButtonRow}>
            <button
              type="button"
              className="sh-btn"
              onClick={() => setShowCalendar((v) => !v)}
            >
              {showCalendar ? "カレンダーを閉じる" : "カレンダー表示"}
            </button>

            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={openCreatePage}
            >
              予定作成
            </button>
          </div>
        </div>

        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="対戦相手・会場・カテゴリなど"
          style={input}
        />

        <div style={filterGrid}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            style={select}
          >
            <option value="all">状態すべて</option>
            <option value="confirmed">確定</option>
            <option value="draft">交渉</option>
          </select>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleFilter)}
            style={select}
          >
            <option value="all">役割すべて</option>
            <option value="host">主催</option>
            <option value="guest">参加</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={select}
          >
            <option value="all">カテゴリすべて</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={filterFooter}>
          <div className="ui-meta">
            {selectedDateText} / 表示件数：{filteredItems.length}件
          </div>

          <button type="button" className="sh-btn" onClick={clearFilters}>
            条件クリア
          </button>
        </div>
      </section>

      {showCalendar ? (
        <section className="ui-card" style={calendarBox}>
          <div style={calendarTitle}>予定カレンダー</div>

          <div style={calendarHint} className="ui-meta">
            日付を押すと、その日の予定だけを表示します。
          </div>

          <MatchCalendarBase
            monthKey={monthKey}
            cells={calendarCells}
            selectedYmd={selectedDate}
            itemsByDate={itemsByDate}
            onSelectDate={(ymd) => {
              setSelectedDate((current) => (current === ymd ? "" : ymd));
            }}
            onPrevMonth={() => setMonthDate((prev) => addMonths(prev, -1))}
            onNextMonth={() => setMonthDate((prev) => addMonths(prev, 1))}
          />
        </section>
      ) : null}

      {errorText ? (
        <div className="ui-card" style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{errorText}</div>
        </div>
      ) : null}

      {loading || authLoading ? (
        <div className="ui-card" style={emptyBox}>
          読み込み中…
        </div>
      ) : !userId ? (
        <div className="ui-card" style={emptyBox}>
          ログイン後に表示されます
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="ui-card" style={emptyBox}>
          条件に合う予定がありません
        </div>
      ) : (
        <section style={listWrap}>
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              style={linkButton}
              onClick={() => {
                const qs = new URLSearchParams();
                qs.set("teamId", item.teamId);

                if (item.opponentTeamId) {
                  qs.set("opponentTeamId", item.opponentTeamId);
                }

                qs.set("role", item.role);

                window.location.href = `/match/${item.slotId}?${qs.toString()}`;
              }}
            >
              <article className="ui-card" style={card}>
                <div style={cardTop}>
                  <span style={roleBadge}>{roleLabel(item.role)}</span>

                  <span
                    style={{
                      ...statusBadge,
                      ...statusStyle(item.status),
                    }}
                  >
                    {statusLabel(item.status)}
                  </span>
                </div>

                <h2 style={cardTitle}>
                  {formatDateLabel(item.date)} {formatTime(item.startTime)}
                  {item.endTime ? `–${formatTime(item.endTime)}` : ""}
                </h2>

                <div className="ui-meta" style={orgName}>
                  対戦相手：{item.opponent || "未設定"}
                </div>

                <div style={tagWrap}>
                  <span style={tag}>{item.category || "カテゴリ未設定"}</span>
                  <span style={tag}>強さ {item.strength || "未設定"}</span>
                </div>

                <div style={infoGrid}>
                  <div>
                    <div style={label}>会場</div>
                    <div style={value}>{item.venueName || "未設定"}</div>
                  </div>

                  <div>
                    <div style={label}>住所</div>
                    <div style={value}>{item.address || "未設定"}</div>
                  </div>
                </div>
              </article>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 12,
};

const topBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const pageTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

const searchBox: React.CSSProperties = {
  padding: 14,
};

const searchHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
};

const searchTitle: React.CSSProperties = {
  fontSize: 18,
};

const headerButtonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 16,
  outline: "none",
  background: "#fff",
};

const filterGrid: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
};

const select: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 10px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 14,
};

const filterFooter: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const calendarBox: React.CSSProperties = {
  padding: 14,
};

const calendarTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const calendarHint: React.CSSProperties = {
  marginTop: 4,
  marginBottom: 10,
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const linkButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  textAlign: "left",
  color: "inherit",
  cursor: "pointer",
};

const card: React.CSSProperties = {
  padding: 14,
};

const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const roleBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  border: "1px solid #dce9df",
  fontSize: 12,
  fontWeight: 900,
};

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const cardTitle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 18,
  lineHeight: 1.45,
  color: "#111827",
};

const orgName: React.CSSProperties = {
  marginTop: 6,
};

const infoGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 3,
};

const value: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#1f2937",
};

const tagWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const tag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

const errorBox: React.CSSProperties = {
  padding: 14,
  color: "#991b1b",
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};

const emptyBox: React.CSSProperties = {
  padding: 22,
  textAlign: "center",
};