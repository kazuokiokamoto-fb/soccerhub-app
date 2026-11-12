"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  defaultStandingYear,
  isExactReportingYear,
  reportingYearChoices,
} from "@/lib/official-results/fiscal";
import type { StandingValue } from "@/lib/standings/submit";
import { errorText, PHASE_TEXT } from "./labels";
import { StandingReportCard, type StandingCandidateView } from "./StandingReport";
import "./results.css";

type Bundle = {
  ok: true;
  duty: { fiscalYear: number; phase: string };
  team: { id: string; name: string };
  report: {
    state: string;
    version: number;
    submission_kind?: string | null;
    standing_category?: string | null;
    standing_rank?: number | null;
    standing_rank_unknown?: boolean | null;
  } | null;
  standing?: {
    candidate: StandingCandidateView | null;
  };
};

export default function ResultsEditor() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId;
  const searchParams = useSearchParams();
  const router = useRouter();
  const now = new Date();
  const rawYear = searchParams.get("year");
  const year = rawYear && isExactReportingYear(rawYear, now) ? Number(rawYear) : defaultStandingYear(now);
  const years = reportingYearChoices(now);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    setMessage("");
    void (async () => {
      const response = await fetch(`/api/official-results/${teamId}?year=${year}`);
      const body = (await response.json()) as Bundle | { ok: false; error: string };
      if (cancelled) return;
      if (!response.ok || !body.ok) {
        setMessage(errorText("error" in body ? body.error : "read_failed"));
        return;
      }
      setBundle(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, year]);

  async function submit(mode: "confirm" | "edit", value: StandingValue) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/official-results/${teamId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "standing",
          year,
          expectedVersion: bundle?.report?.version ?? 0,
          mode,
          category: value.category,
          rank: value.rank,
          unknown: value.unknown,
        }),
      });
      const body = (await response.json()) as Bundle | { ok: false; error: string };
      if (!response.ok || !body.ok) {
        setMessage(errorText("error" in body ? body.error : "write_failed"));
        return;
      }
      setBundle(body);
      setMessage("提出しました。");
    } catch {
      setMessage("保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  const report = bundle?.report ?? null;
  const submitted = report?.state === "submitted";
  const legacy = submitted && report?.submission_kind !== "standing" && !report?.standing_category;
  const candidate = bundle?.standing?.candidate ?? null;

  return (
    <main className="or-editor">
      <p>
        <Link href="/results">報告一覧</Link>
      </p>
      <h1>公式戦の年次報告</h1>
      {!bundle && !message ? <p>読み込み中です。</p> : null}
      {bundle ? (
        <StandingReportCard
          key={`${teamId}:${year}:${report?.version ?? 0}:${candidate?.fetchedAt ?? "none"}`}
          teamName={bundle.team.name}
          year={year}
          years={years.includes(year) ? years : [year, ...years]}
          onYear={(next) => router.replace(`/results/${teamId}?year=${next}`)}
          deadlineYear={year + 1}
          phaseLabel={PHASE_TEXT[bundle.duty.phase] ?? ""}
          submitted={
            submitted
              ? {
                  category: report?.standing_category || "未設定",
                  rank: report?.standing_rank ?? null,
                  unknown: Boolean(report?.standing_rank_unknown) || report?.standing_rank == null,
                  legacy,
                }
              : null
          }
          candidate={
            candidate
              ? {
                  category: candidate.category,
                  rank: candidate.rank,
                  sourceUrl: candidate.sourceUrl,
                  fetchedAt: candidate.fetchedAt,
                }
              : null
          }
          busy={busy}
          message={message}
          onSubmit={(mode, value) => void submit(mode, value)}
        />
      ) : message ? (
        <p className="or-message">{message}</p>
      ) : null}
    </main>
  );
}
