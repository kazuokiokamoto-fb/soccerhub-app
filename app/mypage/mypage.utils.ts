import type {
  TeamSchedule,
  ScheduleStatus,
  OpponentType,
} from "@/app/lib/types";
import type {
  ProfileRow,
  TeamRow,
  MatchSlotRow,
  MatchRequestRow,
  MatchOfferRow,
  ChatMemberRow,
  ChatMessageRow,
  TeamScheduleRow,
} from "./mypage.types";
import {
  asRecord,
  asString,
  asNullableString,
  asBooleanOrNull,
  asNumberOrNull,
  asStringArrayOrNull,
} from "./mypage.helpers";

/* =========================
   Row → 型変換
========================= */

export function toProfileRow(value: unknown): ProfileRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const user_id = asString(r.user_id);
  if (!user_id) return null;

  return {
    user_id,
    name: asNullableString(r.name),
    phone: asNullableString(r.phone),
    line_id: asNullableString(r.line_id),
    notify_email: asBooleanOrNull(r.notify_email),
    notify_line: asBooleanOrNull(r.notify_line),
  };
}

export function toTeamRow(value: unknown): TeamRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const name = asString(r.name);
  if (!id || !name) return null;

  const rawMeta = asRecord(r.category_meta);
  let category_meta: TeamRow["category_meta"] = null;

  if (rawMeta) {
    const mapped: Record<
      string,
      { strength_rank?: string | null; member_count?: number | null }
    > = {};

    for (const [key, val] of Object.entries(rawMeta)) {
      const meta = asRecord(val);
      mapped[key] = {
        strength_rank: meta ? asNullableString(meta.strength_rank) : null,
        member_count: meta ? asNumberOrNull(meta.member_count) : null,
      };
    }

    category_meta = mapped;
  }

  return {
    id,
    owner_id: asNullableString(r.owner_id),
    name,
    category: asNullableString(r.category),
    categories: asStringArrayOrNull(r.categories),
    level: asNumberOrNull(r.level),
    strength_rank: asNullableString(r.strength_rank),
    area: asNullableString(r.area),
    prefecture: asNullableString(r.prefecture),
    city: asNullableString(r.city),
    town: asNullableString(r.town),
    has_ground: asBooleanOrNull(r.has_ground),
    category_meta,
    uniform_main: asNullableString(r.uniform_main),
    uniform_sub: asNullableString(r.uniform_sub),
    uniform_gk: asNullableString(r.uniform_gk),
    note: asNullableString(r.note),
  };
}

export function toMatchSlotRow(value: unknown): MatchSlotRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const host_team_id = asString(r.host_team_id);
  const date = asString(r.date);
  const start_time = asString(r.start_time);
  const end_time = asString(r.end_time);

  if (!id || !host_team_id || !date || !start_time || !end_time) {
    return null;
  }

  return {
    id,
    host_team_id,
    date,
    start_time,
    end_time,
    area: asNullableString(r.area),
    area_text: asNullableString(r.area_text),
    category: asNullableString(r.category),
    is_closed: asBooleanOrNull(r.is_closed),
    created_at: asNullableString(r.created_at),
  };
}

export function toMatchRequestRow(value: unknown): MatchRequestRow | null {
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
    requester_user_id: asNullableString(r.requester_user_id),
    status,
    comment: asNullableString(r.comment),
    created_at: asNullableString(r.created_at),
  };
}

export function toMatchOfferRow(value: unknown): MatchOfferRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const from_team_id = asString(r.from_team_id);
  const to_team_id = asString(r.to_team_id);
  const status = asString(r.status) as MatchOfferRow["status"];

  if (!id || !from_team_id || !to_team_id || !status) return null;

  return {
    id,
    slot_id: asNullableString(r.slot_id),
    from_user_id: asNullableString(r.from_user_id),
    from_team_id,
    to_team_id,
    status,
    message: asNullableString(r.message),
    created_at: asNullableString(r.created_at),
  };
}

export function toChatMemberRow(value: unknown): ChatMemberRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const thread_id = asString(r.thread_id);
  if (!thread_id) return null;

  return {
    thread_id,
    last_read_at: asNullableString(r.last_read_at),
  };
}

export function toChatMessageRow(value: unknown): ChatMessageRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const thread_id = asString(r.thread_id);
  const created_at = asString(r.created_at);

  if (!id || !thread_id || !created_at) return null;

  return {
    id,
    thread_id,
    body: asNullableString(r.body),
    created_at,
  };
}

export function toTeamScheduleRow(value: unknown): TeamScheduleRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const team_id = asString(r.team_id);
  if (!id || !team_id) return null;

  const rawStatus = asNullableString(r.status);
  const status: ScheduleStatus =
    rawStatus === "confirmed" ? "confirmed" : "draft";

  const rawOpponentType = asNullableString(r.opponent_type);
  const opponent_type: OpponentType | null =
    rawOpponentType === "team" || rawOpponentType === "external"
      ? rawOpponentType
      : null;

  const rawSource = asNullableString(r.source);
  const source: "manual" | "proposal" | "chat_extract" | null =
    rawSource === "manual" ||
    rawSource === "proposal" ||
    rawSource === "chat_extract"
      ? rawSource
      : null;

  return {
    id,
    team_id,
    category: asNullableString(r.category),
    opponent: asNullableString(r.opponent),
    strength: asNullableString(r.strength),
    date: asNullableString(r.date),
    venue_name: asNullableString(r.venue_name),
    address: asNullableString(r.address),
    meetup_time: asNullableString(r.meetup_time),
    dissolve_time: asNullableString(r.dissolve_time),
    start_time: asNullableString(r.start_time),
    end_time: asNullableString(r.end_time),
    parking: asNullableString(r.parking),
    belongings: asNullableString(r.belongings),
    note: asNullableString(r.note),
    thread_id: asNullableString(r.thread_id),
    status,
    google_event_id: asNullableString(r.google_event_id),

    proposal_id: asNullableString(r.proposal_id),
    opponent_team_id: asNullableString(r.opponent_team_id),
    opponent_type,
    external_opponent_name: asNullableString(r.external_opponent_name),
    created_by_user_id: asNullableString(r.created_by_user_id),
    source,

    created_at: asNullableString(r.created_at),
    updated_at: asNullableString(r.updated_at),
  };
}

export function toTeamSchedule(value: unknown): TeamSchedule | null {
  const row = toTeamScheduleRow(value);
  if (!row) return null;

  return {
    id: row.id,
    teamId: row.team_id,
    category: row.category ?? "",
    opponent: row.opponent ?? "",
    strength: row.strength,
    date: row.date ?? "",
    venueName: row.venue_name ?? null,
    address: row.address ?? null,
    meetupTime: row.meetup_time ?? null,
    dissolveTime: row.dissolve_time ?? null,
    startTime: row.start_time ?? null,
    endTime: row.end_time ?? null,
    parking: row.parking ?? null,
    belongings: row.belongings ?? null,
    note: row.note ?? null,
    threadId: row.thread_id ?? null,
    status: row.status === "confirmed" ? "confirmed" : "draft",

    proposalId: row.proposal_id ?? null,
    opponentTeamId: row.opponent_team_id ?? null,
    opponentType: row.opponent_type ?? undefined,
    externalOpponentName: row.external_opponent_name ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    source: row.source ?? undefined,

    googleEventId: row.google_event_id ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}