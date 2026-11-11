import { resultLabel } from "./rules.ts";

export const GOAL_MIN = 0;
export const GOAL_MAX = 20;

export const STORED_RESULTS = ["win", "loss", "draw", "unknown"] as const;
export type StoredResult = (typeof STORED_RESULTS)[number];

export const GOAL_CHOICES: readonly number[] = Array.from(
  { length: GOAL_MAX - GOAL_MIN + 1 },
  (_, index) => GOAL_MIN + index,
);

export function isGoalCount(value: number): boolean {
  return Number.isInteger(value) && value >= GOAL_MIN && value <= GOAL_MAX;
}

export function asStoredResult(value: unknown): StoredResult | null {
  if (typeof value !== "string") return null;
  return (STORED_RESULTS as readonly string[]).includes(value) ? (value as StoredResult) : null;
}

/**
 * A scored line stores the result the score implies.
 * A line with both scores blank may store an explicit win, loss, draw, or unknown.
 * A declared result never overrides a score.
 */
export function resolveResultLabel(
  team: number | null,
  opponent: number | null,
  declared: unknown,
): StoredResult | null {
  if (team == null && opponent == null) {
    if (declared == null || declared === "" || declared === "unknown") return "unknown";
    return asStoredResult(declared);
  }
  if (team == null || opponent == null) return null;
  if (!isGoalCount(team) || !isGoalCount(opponent)) return null;
  const derived = resultLabel(team, opponent);
  return derived === "unknown" ? null : derived;
}

export type InterpretedScores =
  | { status: "empty" }
  | { status: "incomplete" }
  | { status: "scored"; team: number; opponent: number; result: Exclude<StoredResult, "unknown"> };

export function interpretScores(teamGoals: string, opponentGoals: string): InterpretedScores {
  const teamBlank = teamGoals.trim() === "";
  const opponentBlank = opponentGoals.trim() === "";
  if (teamBlank && opponentBlank) return { status: "empty" };
  if (teamBlank || opponentBlank) return { status: "incomplete" };
  if (!/^\d+$/.test(teamGoals) || !/^\d+$/.test(opponentGoals)) return { status: "incomplete" };
  const team = Number(teamGoals);
  const opponent = Number(opponentGoals);
  if (!isGoalCount(team) || !isGoalCount(opponent)) return { status: "incomplete" };
  const result = resultLabel(team, opponent);
  if (result === "unknown") return { status: "incomplete" };
  return { status: "scored", team, opponent, result };
}

export function lineGoalsForApi(
  teamGoals: string,
  opponentGoals: string,
): { team: number | null; opponent: number | null } | null {
  const interpreted = interpretScores(teamGoals, opponentGoals);
  if (interpreted.status === "incomplete") return null;
  if (interpreted.status === "empty") return { team: null, opponent: null };
  return { team: interpreted.team, opponent: interpreted.opponent };
}
