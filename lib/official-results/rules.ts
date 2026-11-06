export type ReportState = "draft" | "in_review" | "submitted";
export type ReportOutcome = "unspecified" | "has_results" | "no_official_results";

export type ObligationCode =
  | "not_started"
  | "draft"
  | "in_review"
  | "submitted_results"
  | "submitted_none";

export function obligation(input: {
  report: { state: ReportState; outcome: ReportOutcome } | null;
}): { code: ObligationCode; blocksProduct: false; lateSubmission: "allowed" } {
  const base = { blocksProduct: false as const, lateSubmission: "allowed" as const };
  if (!input.report) return { ...base, code: "not_started" };
  if (input.report.state === "draft") return { ...base, code: "draft" };
  if (input.report.state === "in_review") return { ...base, code: "in_review" };
  if (input.report.outcome === "no_official_results") return { ...base, code: "submitted_none" };
  return { ...base, code: "submitted_results" };
}

export type SubmitDecision =
  | { action: "idempotent" }
  | { action: "submit" }
  | {
      action: "reject";
      code:
        | "not_found"
        | "version_conflict"
        | "already_submitted_differs"
        | "outcome_required"
        | "lines_required"
        | "lines_forbidden";
    };

export function decideSubmit(input: {
  current: { state: ReportState; outcome: ReportOutcome; version: number } | null;
  expectedVersion: number;
  nextOutcome: ReportOutcome;
  includedLineCount: number;
}): SubmitDecision {
  if (!input.current) return { action: "reject", code: "not_found" };

  if (input.current.state === "submitted") {
    if (input.nextOutcome === input.current.outcome) return { action: "idempotent" };
    return { action: "reject", code: "already_submitted_differs" };
  }

  if (input.expectedVersion !== input.current.version) {
    return { action: "reject", code: "version_conflict" };
  }
  if (input.nextOutcome === "unspecified") {
    return { action: "reject", code: "outcome_required" };
  }
  if (input.nextOutcome === "no_official_results" && input.includedLineCount > 0) {
    return { action: "reject", code: "lines_forbidden" };
  }
  if (input.nextOutcome === "has_results" && input.includedLineCount < 1) {
    return { action: "reject", code: "lines_required" };
  }
  return { action: "submit" };
}

export function sourceDoesNotSubmit(state: ReportState): ReportState {
  return state;
}

export function decideReview(input: {
  state: ReportState;
  version: number;
  expectedVersion: number;
}):
  | { action: "idempotent" }
  | { action: "review" }
  | { action: "reject"; code: "version_conflict" | "submitted" } {
  if (input.state === "submitted") return { action: "reject", code: "submitted" };
  if (input.version !== input.expectedVersion) return { action: "reject", code: "version_conflict" };
  if (input.state === "in_review") return { action: "idempotent" };
  return { action: "review" };
}

export function resultLabel(
  teamGoals: number | null,
  opponentGoals: number | null,
): "win" | "loss" | "draw" | "unknown" {
  if (teamGoals === null || opponentGoals === null) return "unknown";
  if (teamGoals > opponentGoals) return "win";
  if (teamGoals < opponentGoals) return "loss";
  return "draw";
}
