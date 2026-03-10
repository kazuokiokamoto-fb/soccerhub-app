export type GradeKey = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

export type Team = {
  id: string;
  name: string;

  // 表示用（例: "東京都 世田谷区・三宿"）
  area: string;

  // 住所（構造化）
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  addressDetail?: string | null;

  category: string; // 例: "U-12"
  level: number; // 旧互換の数値レベル
  hasGround: boolean; // グラウンド提供できる

  bikeParking: string; // "あり" | "なし" | "不明"
  bikeParkingCapacity?: string | null; // 例: "20", "50+", "不明"

  uniformMain: string; // 例: "青"
  uniformSub: string; // 例: "白"

  // 新仕様：チーム所属人数（概算）
  memberCount?: number | null;

  // 旧データ互換用
  rosterByGrade: Record<GradeKey, number>;

  // 希望枠
  desiredDates: string[]; // 例: ["土 午後", "祝日"]

  note: string;
  updatedAt: string;
};

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

export type MatchRow = {
  id: string;
  teamA: Team;
  teamB: Team;
  date: string; // マッチした日付
  score: number;
  reasons: string[];
};