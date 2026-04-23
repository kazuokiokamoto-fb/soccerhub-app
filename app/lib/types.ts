export type GradeKey = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

/* =========================
   チーム
========================= */

export type Team = {
  id: string;
  name: string;

  area: string;

  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  addressDetail?: string | null;

  category: string;
  level: number;
  hasGround: boolean;

  bikeParking: string;
  bikeParkingCapacity?: string | null;

  uniformMain: string;
  uniformSub: string;

  memberCount?: number | null;

  rosterByGrade: Record<GradeKey, number>;

  desiredDates: string[];

  note: string;
  updatedAt: string;
};

/* =========================
   会場
========================= */

export type Venue = {
  id: string;
  name: string;
  area: string;
  address?: string;
  hasParking: boolean;
  hasBikeParking: boolean;
  note: string;
  updatedAt: string;
};

/* =========================
   マッチ（既存）
========================= */

export type MatchRow = {
  id: string;
  teamA: Team;
  teamB: Team;
  date: string;
  score: number;
  reasons: string[];
};

/* =========================
   スケジュール関連
========================= */

export type ScheduleStatus = "draft" | "confirmed";

export type AttendanceStatus = "attending" | "absent" | "pending";

export type OpponentType = "team" | "external";

export type TeamSchedule = {
  id: string;

  teamId: string;

  category: string;
  opponent: string;
  strength?: string | null;

  date: string;
  startTime?: string | null;
  endTime?: string | null;

  meetupTime?: string | null;
  dissolveTime?: string | null;

  venueName?: string | null;
  address?: string | null;

  parking?: string | null;

  belongings?: string | null;
  note?: string | null;

  threadId?: string | null;

  status: ScheduleStatus;

  proposalId?: string | null;

  opponentTeamId?: string | null;
  opponentType?: OpponentType;

  externalOpponentName?: string | null;

  createdByUserId?: string | null;

  source?: "manual" | "proposal" | "chat_extract";

  googleEventId?: string | null;

  createdAt: string;
  updatedAt: string;
};

/* =========================
   出欠
========================= */

export type ScheduleAttendance = {
  id: string;
  scheduleId: string;
  userId: string;
  status: AttendanceStatus;
  comment?: string | null;
  updatedAt: string;
};

/* =========================
   チーム配下ユーザー
========================= */

export type TeamUserRole = "owner" | "manager" | "member";

export type TeamUser = {
  id: string;
  teamId: string;
  userId: string;
  name: string;
  role: TeamUserRole;
  createdAt: string;
};

/* =========================
   予定提案（チャット起点）
========================= */

export type ScheduleProposalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled";

export type ScheduleProposal = {
  id: string;

  createdByUserId: string;
  createdByTeamId: string;

  opponentType: OpponentType;

  opponentTeamId?: string | null;

  externalOpponentName?: string | null;
  externalOpponentContact?: string | null;

  threadId?: string | null;
  sourceMessageId?: string | null;

  status: ScheduleProposalStatus;

  approvalRequestedToTeamId?: string | null;

  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;

  meetupTime?: string | null;
  dissolveTime?: string | null;

  venueId?: string | null;
  venueName?: string | null;
  address?: string | null;

  category?: string | null;
  strength?: string | null;
  parking?: string | null;
  belongings?: string | null;
  note?: string | null;

  extractedPayload?: any;

  confirmedAt?: string | null;
  approvedByUserId?: string | null;

  createdAt: string;
  updatedAt: string;
};