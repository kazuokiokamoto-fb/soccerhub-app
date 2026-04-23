import type { ScheduleStatus, OpponentType } from "@/app/lib/types";

export type ProfileRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  line_id: string | null;
  notify_email: boolean | null;
  notify_line: boolean | null;
};

export type TeamRow = {
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
  category_meta?: Record<
    string,
    { strength_rank?: string | null; member_count?: number | null }
  > | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  uniform_gk?: string | null;
  note?: string | null;
};

export type MatchSlotRow = {
  id: string;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  is_closed: boolean | null;
  created_at?: string | null;
};

export type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id?: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment?: string | null;
  created_at?: string | null;
};

export type MatchOfferRow = {
  id: string;
  slot_id: string | null;
  from_user_id?: string | null;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message?: string | null;
  created_at?: string | null;
};

export type ChatMemberRow = {
  thread_id: string;
  last_read_at: string | null;
};

export type ChatMessageRow = {
  id: string;
  thread_id: string;
  body: string | null;
  created_at: string;
};

export type TeamScheduleRow = {
  id: string;
  team_id: string;
  category: string | null;
  opponent: string | null;
  strength: string | null;
  date: string | null;
  venue_name: string | null;
  address: string | null;
  meetup_time: string | null;
  dissolve_time: string | null;
  start_time: string | null;
  end_time: string | null;
  parking: string | null;
  belongings: string | null;
  note: string | null;
  thread_id: string | null;
  status: ScheduleStatus | null;
  google_event_id: string | null;

  proposal_id: string | null;
  opponent_team_id: string | null;
  opponent_type: OpponentType | null;
  external_opponent_name: string | null;
  created_by_user_id: string | null;
  source: "manual" | "proposal" | "chat_extract" | null;

  created_at: string | null;
  updated_at: string | null;
};

export type NextScheduleCard = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string | null;
  opponent: string | null;
  venueName: string | null;
  address: string | null;
  status: ScheduleStatus | null;
  threadId: string | null;
};

export type Toast = {
  type: "success" | "error" | "info";
  text: string;
};