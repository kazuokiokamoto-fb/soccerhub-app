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
   🆕 スケジュール関連（ここが今回の核）
========================= */

/** ステータス */
export type ScheduleStatus = "draft" | "confirmed";

/** 出欠 */
export type AttendanceStatus = "attending" | "absent" | "pending";

/** スケジュール本体（←あなたの指定フォーマット完全反映） */
export type TeamSchedule = {
  id: string;

  teamId: string;

  /** 基本情報 */
  category: string;
  opponent: string;
  strength?: string | null;

  /** 日程 */
  date: string;
  startTime?: string | null;
  endTime?: string | null;

  /** 集合解散 */
  meetupTime?: string | null;
  dissolveTime?: string | null;

  /** 会場 */
  venueName?: string | null;
  address?: string | null;

  /** 設備 */
  parking?: string | null;

  /** 持ち物・備考 */
  belongings?: string | null;
  note?: string | null;

  /** チャット連携 */
  threadId?: string | null;

  /** 状態 */
  status: ScheduleStatus;

  /** Googleカレンダー連携 */
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
   ユーザー（チーム配下）
========================= */

export type TeamUser = {
  id: string;
  teamId: string;

  name: string;

  role?: "owner" | "member";

  createdAt: string;
};