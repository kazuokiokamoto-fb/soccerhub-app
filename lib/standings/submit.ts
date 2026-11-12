import { isAffiliationCategory } from "../affiliation/catalog.ts";
import type { ReportState } from "../official-results/rules.ts";

export type StandingValue = {
  category: string;
  rank: number | null;
  unknown: boolean;
};

export type StoredStanding = {
  state: ReportState;
  version: number;
  category: string | null;
  rank: number | null;
  unknown: boolean;
};

export function confirmableCandidate(candidate: {
  category: string | null;
  rank: number | null;
} | null): StandingValue | null {
  if (!candidate || candidate.rank == null || !candidate.category) return null;
  if (!isAffiliationCategory(candidate.category)) return null;
  if (!Number.isInteger(candidate.rank) || candidate.rank < 1 || candidate.rank > 99) return null;
  return { category: candidate.category, rank: candidate.rank, unknown: false };
}

export function parseStandingEdit(input: {
  category: unknown;
  rank: unknown;
  unknown: unknown;
}): StandingValue | null {
  if (typeof input.category !== "string" || !isAffiliationCategory(input.category)) return null;
  const unknown = input.unknown === true;
  if (unknown) {
    if (input.rank != null && input.rank !== "") return null;
    return { category: input.category, rank: null, unknown: true };
  }
  const rank = typeof input.rank === "number" ? input.rank : Number(input.rank);
  if (!Number.isInteger(rank) || rank < 1 || rank > 99) return null;
  return { category: input.category, rank, unknown: false };
}

export function sameStanding(left: StandingValue, right: {
  category: string | null;
  rank: number | null;
  unknown: boolean;
}): boolean {
  return left.category === right.category && left.rank === right.rank && left.unknown === right.unknown;
}

export type StandingDecision =
  | { action: "submit" }
  | { action: "idempotent" }
  | {
      action: "reject";
      code:
        | "not_found"
        | "version_conflict"
        | "already_submitted_differs"
        | "category_required"
        | "rank_required"
        | "candidate_mismatch";
    };

export function decideStandingSubmit(input: {
  current: StoredStanding | null;
  expectedVersion: number;
  next: StandingValue | null;
  mode: "confirm" | "edit";
  candidate: { category: string | null; rank: number | null } | null;
}): StandingDecision {
  if (!input.next) {
    return { action: "reject", code: input.mode === "edit" ? "rank_required" : "candidate_mismatch" };
  }
  if (input.mode === "confirm") {
    const shown = confirmableCandidate(input.candidate);
    if (!shown || !sameStanding(input.next, shown)) {
      return { action: "reject", code: "candidate_mismatch" };
    }
  }
  if (!input.current) return { action: "reject", code: "not_found" };
  if (input.current.state === "submitted") {
    if (sameStanding(input.next, input.current)) return { action: "idempotent" };
    return { action: "reject", code: "already_submitted_differs" };
  }
  if (input.expectedVersion !== input.current.version) {
    return { action: "reject", code: "version_conflict" };
  }
  return { action: "submit" };
}
