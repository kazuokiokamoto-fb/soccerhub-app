// app/match/types.ts
export type DbTeam = {
  id: string;
  name: string;
  area: string | null;
  category: string | null;
  level: number | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  roster_by_grade: Record<string, number> | null;
  desired_dates: string[] | null;
  note: string | null;
  updated_at: string;
  owner_id: string | null;
};

export type DbVenue = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  has_parking: boolean | null;
  has_bike_parking: boolean | null;
  note: string | null;
};

export type DbSlot = {
  id: string;
  owner_id: string;
  host_team_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS or HH:MM
  end_time: string;
  venue_id: string | null;
  area: string | null;
  category: string | null;
  created_at?: string;
};

export type DbRequest = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
};

export type Toast = { type: "success" | "error" | "info"; text: string };

export type DbThread = {
  id: string;
  slot_id: string;
  request_id: string;
  host_team_id: string;
  requester_team_id: string;
  created_at: string;
};

export type DbMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  sender_team_id: string | null;
  body: string;
  created_at: string;
};