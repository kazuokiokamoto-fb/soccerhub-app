import type { ScheduleStatus } from "@/app/lib/types";
import type { TeamRow } from "./mypage.types";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asStringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

export function isMissingColumnError(err: unknown) {
  const msg = String((err as { message?: string } | null)?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("uniform_gk") ||
        msg.includes("category_meta") ||
        msg.includes("categories")))
  );
}

export function rankLabel(level?: number | null) {
  const n = Number(level ?? 0);
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

export function areaText(team?: TeamRow | null) {
  if (!team) return "未設定";

  const area = String(team.area ?? "").trim();
  if (area) return area;

  const text = `${team.prefecture ?? ""} ${team.city ?? ""}${
    team.town ? "・" + team.town : ""
  }`.trim();

  return text || "未設定";
}

export function categoryText(team?: TeamRow | null) {
  if (!team) return "未設定";

  if (Array.isArray(team.categories) && team.categories.length > 0) {
    return team.categories.join(" / ");
  }

  return team.category || "未設定";
}

export function categoryMetaEntries(
  team?: TeamRow | null
): Array<
  [string, { strength_rank?: string | null; member_count?: number | null }]
> {
  if (!team?.category_meta || typeof team.category_meta !== "object") {
    return [];
  }

    return Object.entries(team.category_meta).filter(
      ([key]) => Boolean(key)
    ) as Array<
      [string, { strength_rank?: string | null; member_count?: number | null }]
    >;
}

export function fmtTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

export function formatScheduleDate(ymd?: string | null) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd);
  return `${m}/${d}`;
}

export function ymdToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toDateTimeMs(date?: string | null, time?: string | null) {
  if (!date) return 0;
  if (!time) return new Date(`${date}T00:00:00`).getTime();
  return new Date(`${date}T${time}`).getTime();
}

export function scheduleStatusLabel(status?: ScheduleStatus | null) {
  return status === "confirmed" ? "確定" : "下書き";
}

export function toArray<T>(
  value: unknown,
  mapper: (v: unknown) => T | null
): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}