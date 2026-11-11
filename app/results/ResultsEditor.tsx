"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  dateInFiscalYear,
  fiscalYearContaining,
  isExactReportingYear,
  reportingYearChoices,
  resolveReportingYear,
} from "@/lib/official-results/fiscal";
import {
  asStoredResult,
  GOAL_CHOICES,
  interpretScores,
  lineGoalsForApi,
  resolveResultLabel,
  STORED_RESULTS,
  type StoredResult,
} from "@/lib/official-results/lineInput";
import {
  CONFIDENCE_TEXT,
  errorText,
  EXTENT_TEXT,
  fiscalYearChoiceLabel,
  fiscalYearLabel,
  PHASE_TEXT,
  resultText,
  STATE_TEXT,
} from "./labels";
import "./results.css";

type Report = {
  id: string;
  state: "draft" | "in_review" | "submitted";
  outcome: string;
  version: number;
  submitted_at: string | null;
  submitted_by: string | null;
};

type Source = {
  id: string;
  source_url: string;
  retrieved_at: string;
  discovery_extent: string;
  match_confidence: string;
  http_status: number | null;
  page_title: string | null;
  note: string | null;
};

type Candidate = {
  id: string;
  competition_name: string | null;
  opponent_name: string | null;
  played_on: string | null;
  team_goals: number | null;
  opponent_goals: number | null;
  excerpt: string;
  match_basis: string;
};

type Line = {
  id: string;
  origin_candidate_id: string | null;
  competition_name: string;
  opponent_name: string;
  played_on: string | null;
  team_goals: number | null;
  opponent_goals: number | null;
  result_label: string;
  included: boolean;
  team_note: string | null;
  version: number;
};

type Revision = {
  id: string;
  line_id: string;
  editor_id: string;
  edited_at: string;
  before_values: Record<string, unknown>;
  after_values: Record<string, unknown>;
};

type Bundle = {
  ok: true;
  discovery: { label: string };
  policy: {
    periodKind: string;
    deadlineMonth: number;
    deadlineDay: number;
    deadlineTimeZone: string;
    lateSubmission: string;
  };
  duty: {
    fiscalYear: number;
    periodStart: string;
    periodEnd: string;
    deadlineDate: string;
    phase: string;
    blocksProduct: false;
    lateSubmission: "allowed";
  };
  team: { id: string; name: string };
  report: Report | null;
  sources: Source[];
  candidates: Candidate[];
  lines: Line[];
  revisions: Revision[];
  idempotent?: boolean;
  duplicate?: boolean;
};

type LineDraft = {
  competitionName: string;
  opponentName: string;
  playedOn: string;
  teamGoals: string;
  opponentGoals: string;
  resultLabel: StoredResult;
  teamNote: string;
  included: boolean;
  candidateId: string | null;
  lineId: string | null;
  expectedVersion: number | null;
};

const emptyLine: LineDraft = {
  competitionName: "",
  opponentName: "",
  playedOn: "",
  teamGoals: "",
  opponentGoals: "",
  resultLabel: "unknown",
  teamNote: "",
  included: true,
  candidateId: null,
  lineId: null,
  expectedVersion: null,
};

function goalValue(value: number | null): string {
  return value === null ? "" : String(value);
}

export default function ResultsEditor() {
  const params = useParams<{ teamId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const teamId = params.teamId;
  const now = useMemo(() => new Date(), []);
  const choices = useMemo(() => reportingYearChoices(now), [now]);
  const currentYear = fiscalYearContaining(now);
  const rawYear = search.get("year");
  const year = resolveReportingYear(rawYear, now);
  const primaryYears = choices.filter((choice) => choice >= currentYear - 1);
  const olderYears = choices.filter((choice) => choice < currentYear - 1);

  const [notice, setNotice] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [bundleYear, setBundleYear] = useState<number | null>(null);
  const [teamName, setTeamName] = useState("");
  const [message, setMessage] = useState("");
  const [line, setLine] = useState<LineDraft>(emptyLine);
  const [lineYear, setLineYear] = useState(year);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLFormElement | null>(null);
  const yearRef = useRef(year);
  yearRef.current = year;

  if (lineYear !== year) {
    setLineYear(year);
    setLine(emptyLine);
    setUrl("");
    setMessage("");
  }

  useEffect(() => {
    if (rawYear === String(year)) return;
    if (rawYear != null && rawYear !== "" && !isExactReportingYear(rawYear, now)) {
      setNotice("指定された年度は報告の対象外です。進行中の年度を開きました。");
    }
    router.replace(`/results/${encodeURIComponent(teamId)}?year=${year}`, { scroll: false });
  }, [rawYear, year, teamId, router, now]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/official-results/${teamId}?year=${year}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as Bundle | { ok: false; error: string };
        if (cancelled) return;
        if (!response.ok || !body.ok) {
          setBundle(null);
          setBundleYear(year);
          setMessage(errorText("error" in body ? body.error : "read_failed"));
          return;
        }
        setBundle(body);
        setBundleYear(year);
        if (body.team.name) setTeamName(body.team.name);
        setMessage("");
      } catch {
        if (cancelled) return;
        setBundle(null);
        setBundleYear(year);
        setMessage(errorText("read_failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, year]);

  function selectYear(nextValue: string) {
    if (!isExactReportingYear(nextValue, now) || Number(nextValue) === year) return;
    setNotice("");
    router.replace(`/results/${encodeURIComponent(teamId)}?year=${nextValue}`, { scroll: false });
  }

  function remember(body: Bundle, reportedYear: number) {
    setBundle(body);
    setBundleYear(reportedYear);
    if (body.team.name) setTeamName(body.team.name);
  }

  async function send(path: string, method: string, payload: Record<string, unknown>) {
    const requested = year;
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as Bundle | { ok: false; error: string };
      if (yearRef.current !== requested) return false;
      if (!response.ok || !body.ok) {
        setMessage(errorText("error" in body ? body.error : "write_failed"));
        return false;
      }
      remember(body, requested);
      if (body.duplicate) setMessage("同じページはすでに取り込んであります。候補は増やしていません。");
      else if (body.idempotent) setMessage("すでに同じ内容で提出済みです。確認者と時刻は変えていません。");
      else setMessage("保存しました。取得した候補は、提出するまでチームの報告ではありません。");
      return true;
    } catch {
      if (yearRef.current !== requested) return false;
      setMessage(errorText("write_failed"));
      return false;
    }
  }

  function showLine(next: LineDraft) {
    setLine(next);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function withGoals(patch: Partial<Pick<LineDraft, "teamGoals" | "opponentGoals">>): LineDraft {
    const next = { ...line, ...patch };
    const interpreted = interpretScores(next.teamGoals, next.opponentGoals);
    if (interpreted.status === "scored") next.resultLabel = interpreted.result;
    return next;
  }

  const opened = bundleYear === year ? bundle : null;
  const pending = loading || bundleYear !== year;
  const locked = opened?.report?.state === "submitted";
  const scoreState = interpretScores(line.teamGoals, line.opponentGoals);
  const shownResult: StoredResult | null =
    scoreState.status === "scored"
      ? scoreState.result
      : scoreState.status === "empty"
        ? line.resultLabel
        : null;
  const canPickResult = scoreState.status === "empty" && !locked;
  const yearOption = (choice: number) => (
    <option key={choice} value={String(choice)}>
      {fiscalYearChoiceLabel(choice)}
    </option>
  );

  return (
    <main className="or-editor">
      <p>
        <Link href="/results">年次報告の一覧</Link>
      </p>
      <h1>{teamName || "公式戦の年次報告"}</h1>
      <p>選手個人の名前は入れないでください。取得した情報だけでは提出になりません。</p>
      <label className="or-field" htmlFor="official-year">
        <span>対象年度</span>
        <select
          id="official-year"
          className="sh-select"
          value={String(year)}
          onChange={(event) => selectYear(event.target.value)}
        >
          {olderYears.length > 0 ? (
            <>
              <optgroup label="進行中と直前の年度">{primaryYears.map(yearOption)}</optgroup>
              <optgroup label="それより前の年度">{olderYears.map(yearOption)}</optgroup>
            </>
          ) : (
            choices.map(yearOption)
          )}
        </select>
        <span className="or-hint">選ぶと、その年度を開きます。</span>
      </label>
      {pending ? <p>読み込み中です。</p> : null}
      {notice ? (
        <p className="or-message" role="status">
          {notice}
        </p>
      ) : null}
      {message ? (
        <p className="or-message" role="status">
          {message}
        </p>
      ) : null}
      {opened ? <p>{opened.discovery.label}</p> : null}
      {opened ? (
        <p>
          {fiscalYearLabel(opened.duty.fiscalYear)}。提出期限は {opened.duty.deadlineDate}{" "}
          の終わり（日本時間）です。
          {PHASE_TEXT[opened.duty.phase] ?? opened.duty.phase}
          期限を過ぎてもこの画面から提出できます。ログイン、試合、チャット、予定は止まりません。
        </p>
      ) : null}
      {opened && !opened.report ? (
        <button
          type="button"
          className="sh-btn sh-btn--primary"
          onClick={() => void send(`/api/official-results/${teamId}`, "POST", { year })}
        >
          この年度の下書きを作る
        </button>
      ) : null}
      {opened?.report ? (
        <>
          <p>
            状態: {STATE_TEXT[opened.report.state]} / 版 {opened.report.version}
            {opened.report.submitted_at
              ? ` / 提出 ${opened.report.submitted_at} / 確認者 ${opened.report.submitted_by}`
              : ""}
          </p>
          <section className="or-section">
            <h2>公開ページから候補を取る</h2>
            <p>自動ではインターネットを検索しません。公式サイトや大会ページのURLを指定してください。</p>
            <label className="or-field" htmlFor="official-source-url">
              <span>公開ページのURL</span>
              <input
                id="official-source-url"
                className="sh-input"
                type="url"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
                disabled={locked}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="sh-btn"
              disabled={locked}
              onClick={() =>
                void send(`/api/official-results/${teamId}/sources`, "POST", {
                  year,
                  url,
                })
              }
            >
              このURLを取得する
            </button>
            <ul>
              {opened.sources.map((source) => (
                <li key={source.id} className="or-line">
                  <a href={source.source_url}>{source.page_title || source.source_url}</a>
                  <div>取得時刻: {source.retrieved_at}</div>
                  <div>{EXTENT_TEXT[source.discovery_extent] ?? source.discovery_extent}</div>
                  <div>{CONFIDENCE_TEXT[source.match_confidence] ?? source.match_confidence}</div>
                  {source.note ? <div>{source.note}</div> : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="or-section">
            <h2>取得した元の値</h2>
            <p>ここは取得時の写しです。訂正してもこの欄は変わりません。</p>
            {opened.candidates.length === 0 ? <p>候補はありません。</p> : null}
            <ul>
              {opened.candidates.map((candidate) => (
                <li key={candidate.id} className="or-line">
                  <div>{candidate.excerpt}</div>
                  <div>{candidate.match_basis}</div>
                  <button
                    type="button"
                    className="sh-btn"
                    disabled={locked}
                    onClick={() =>
                      showLine({
                        competitionName: candidate.competition_name ?? "",
                        opponentName: candidate.opponent_name ?? "",
                        playedOn: candidate.played_on ?? "",
                        teamGoals: goalValue(candidate.team_goals),
                        opponentGoals: goalValue(candidate.opponent_goals),
                        resultLabel: "unknown",
                        teamNote: "",
                        included: true,
                        candidateId: candidate.id,
                        lineId: null,
                        expectedVersion: null,
                      })
                    }
                  >
                    報告の行として直す
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="or-section">
            <h2>チームの報告</h2>
            <form
              ref={formRef}
              autoComplete="off"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                if (locked || !opened.report) return;
                const competitionName = line.competitionName.trim();
                const opponentName = line.opponentName.trim();
                if (!competitionName || !opponentName) {
                  setMessage(errorText("validation"));
                  return;
                }
                if (line.playedOn && !dateInFiscalYear(line.playedOn, year)) {
                  setMessage("試合日は、この年度の4月1日から翌年3月31日までにしてください。");
                  return;
                }
                const scores = lineGoalsForApi(line.teamGoals, line.opponentGoals);
                if (!scores) {
                  setMessage("得点は、両方の数字を選ぶか、両方とも未入力にしてください。");
                  return;
                }
                const label = resolveResultLabel(scores.team, scores.opponent, line.resultLabel);
                if (!label) {
                  setMessage(errorText("validation"));
                  return;
                }
                const payload = {
                  year,
                  competitionName,
                  opponentName,
                  playedOn: line.playedOn || null,
                  teamGoals: scores.team,
                  opponentGoals: scores.opponent,
                  resultLabel: label,
                  teamNote: line.teamNote.trim(),
                  included: line.included,
                  candidateId: line.candidateId,
                  lineId: line.lineId,
                  expectedVersion: line.expectedVersion,
                };
                const path = `/api/official-results/${teamId}/lines`;
                void send(path, line.lineId ? "PATCH" : "POST", payload).then((saved) => {
                  if (saved) setLine(emptyLine);
                });
              }}
            >
              <fieldset className="or-fieldset" disabled={locked}>
                <label className="or-field" htmlFor="official-competition">
                  <span>大会名</span>
                  <input
                    id="official-competition"
                    className="sh-input"
                    required
                    maxLength={80}
                    value={line.competitionName}
                    onChange={(event) => setLine({ ...line, competitionName: event.target.value })}
                  />
                </label>
                <label className="or-field" htmlFor="official-opponent">
                  <span>対戦相手のチーム名</span>
                  <input
                    id="official-opponent"
                    className="sh-input"
                    required
                    maxLength={80}
                    placeholder="個人名は入れない"
                    value={line.opponentName}
                    onChange={(event) => setLine({ ...line, opponentName: event.target.value })}
                  />
                </label>
                <label className="or-field" htmlFor="official-played-on">
                  <span>試合日</span>
                  <input
                    id="official-played-on"
                    className="sh-input"
                    type="date"
                    min={opened.duty.periodStart}
                    max={opened.duty.periodEnd}
                    value={line.playedOn}
                    onChange={(event) => setLine({ ...line, playedOn: event.target.value })}
                  />
                  <span className="or-hint">
                    空欄でも追加できます。入れるときは {opened.duty.periodStart} から{" "}
                    {opened.duty.periodEnd} までです。
                  </span>
                </label>
                <div className="or-split">
                  <label className="or-field" htmlFor="official-team-goals">
                    <span>自チームの得点</span>
                    <select
                      id="official-team-goals"
                      className="sh-select"
                      value={line.teamGoals}
                      onChange={(event) => setLine(withGoals({ teamGoals: event.target.value }))}
                    >
                      <option value="">未入力</option>
                      {GOAL_CHOICES.map((goal) => (
                        <option key={goal} value={String(goal)}>
                          {goal}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="or-field" htmlFor="official-opponent-goals">
                    <span>相手の得点</span>
                    <select
                      id="official-opponent-goals"
                      className="sh-select"
                      value={line.opponentGoals}
                      onChange={(event) => setLine(withGoals({ opponentGoals: event.target.value }))}
                    >
                      <option value="">未入力</option>
                      {GOAL_CHOICES.map((goal) => (
                        <option key={goal} value={String(goal)}>
                          {goal}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="or-field">
                  <span id="official-result-label">勝敗</span>
                  {canPickResult ? (
                    <div
                      className="or-segment"
                      role="group"
                      aria-labelledby="official-result-label"
                    >
                      {STORED_RESULTS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={shownResult === key}
                          onClick={() => setLine({ ...line, resultLabel: key })}
                        >
                          {resultText(key)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="or-result" role="group" aria-labelledby="official-result-label">
                      {STORED_RESULTS.map((key) => (
                        <span key={key} data-active={shownResult === key ? "true" : "false"}>
                          {resultText(key)}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="or-hint">
                    {scoreState.status === "incomplete"
                      ? "得点は、両方の数字を選ぶか、両方とも未入力にしてください。"
                      : scoreState.status === "scored"
                        ? "勝敗は得点に合わせます。"
                        : "得点が未入力のときは、勝敗を選べます。"}
                  </span>
                </div>
                <div className="or-field">
                  <span id="official-included-label">提出</span>
                  <div className="or-segment" role="group" aria-labelledby="official-included-label">
                    <button
                      type="button"
                      aria-pressed={line.included}
                      onClick={() => setLine({ ...line, included: true })}
                    >
                      含める
                    </button>
                    <button
                      type="button"
                      aria-pressed={!line.included}
                      onClick={() => setLine({ ...line, included: false })}
                    >
                      外す
                    </button>
                  </div>
                  <span className="or-hint">結果ありで提出するには、含める行が1つ必要です。</span>
                </div>
                <label className="or-field" htmlFor="official-note">
                  <span>補足</span>
                  <textarea
                    id="official-note"
                    className="sh-textarea"
                    maxLength={200}
                    rows={3}
                    placeholder="個人名は入れないでください"
                    value={line.teamNote}
                    onChange={(event) => setLine({ ...line, teamNote: event.target.value })}
                  />
                </label>
                <button type="submit" className="sh-btn sh-btn--primary">
                  {line.lineId ? "行を訂正する" : "行を追加する"}
                </button>
              </fieldset>
            </form>
            <ul>
              {opened.lines.map((item) => (
                <li key={item.id} className="or-line">
                  <div>{item.included ? "含める" : "外す"}</div>
                  <strong>
                    {item.competition_name} 対 {item.opponent_name}
                  </strong>
                  <div>{item.played_on ?? "日付なし"}</div>
                  <div>
                    {item.team_goals == null || item.opponent_goals == null
                      ? `得点なし / ${resultText(item.result_label)}`
                      : `${item.team_goals}-${item.opponent_goals} ${resultText(item.result_label)}`}
                  </div>
                  {item.team_note ? <div>{item.team_note}</div> : null}
                  <button
                    type="button"
                    className="sh-btn"
                    disabled={locked}
                    onClick={() =>
                      showLine({
                        competitionName: item.competition_name,
                        opponentName: item.opponent_name,
                        playedOn: item.played_on ?? "",
                        teamGoals: goalValue(item.team_goals),
                        opponentGoals: goalValue(item.opponent_goals),
                        resultLabel: asStoredResult(item.result_label) ?? "unknown",
                        teamNote: item.team_note ?? "",
                        included: item.included,
                        candidateId: null,
                        lineId: item.id,
                        expectedVersion: item.version,
                      })
                    }
                  >
                    編集
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="or-section">
            <h2>提出</h2>
            <p>
              提出した時点の確認者と時刻が記録されます。ページの取得だけでは提出になりません。
              {opened.duty.phase === "overdue"
                ? " 期限は過ぎていますが、提出ボタンはそのまま使えます。"
                : ""}
            </p>
            <div className="or-actions">
              <button
                type="button"
                className="sh-btn"
                disabled={locked}
                onClick={() =>
                  void send(`/api/official-results/${teamId}`, "POST", {
                    action: "review",
                    year,
                    expectedVersion: opened.report?.version,
                  })
                }
              >
                確認中にする
              </button>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                disabled={locked}
                onClick={() =>
                  void send(`/api/official-results/${teamId}/submit`, "POST", {
                    year,
                    expectedVersion: opened.report?.version,
                    outcome: "has_results",
                  })
                }
              >
                結果ありで提出する
              </button>
              <button
                type="button"
                className="sh-btn"
                disabled={locked}
                onClick={() =>
                  void send(`/api/official-results/${teamId}/submit`, "POST", {
                    year,
                    expectedVersion: opened.report?.version,
                    outcome: "no_official_results",
                  })
                }
              >
                公式戦はなかった、として提出する
              </button>
            </div>
          </section>
          <section className="or-section">
            <h2>訂正の履歴</h2>
            {opened.revisions.length === 0 ? <p>訂正はまだありません。</p> : null}
            <ul>
              {opened.revisions.map((revision) => (
                <li key={revision.id} className="or-line">
                  {revision.edited_at} / 確認者ID {revision.editor_id}
                  <pre>{JSON.stringify(revision.before_values)}</pre>
                  <pre>{JSON.stringify(revision.after_values)}</pre>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
