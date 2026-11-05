"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CONFIDENCE_TEXT, errorText, EXTENT_TEXT, STATE_TEXT } from "./labels";

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
    yearStatus: string;
    reportingYear: number | null;
    deadlineMonth: number | null;
    deadlineDay: number | null;
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
  teamNote: "",
  included: true,
  candidateId: null,
  lineId: null,
  expectedVersion: null,
};

function goals(value: string): number | null {
  if (value.trim() === "") return null;
  return Number(value);
}

export default function ResultsEditor() {
  const params = useParams<{ teamId: string }>();
  const search = useSearchParams();
  const teamId = params.teamId;
  const [year, setYear] = useState(search.get("year") ?? "");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [message, setMessage] = useState("");
  const [line, setLine] = useState<LineDraft>(emptyLine);
  const [url, setUrl] = useState("");

  async function load(nextYear: string) {
    const response = await fetch(`/api/official-results/${teamId}?year=${nextYear}`);
    const body = (await response.json()) as Bundle | { ok: false; error: string };
    if (!response.ok || !body.ok) {
      setBundle(null);
      setMessage(errorText("error" in body ? body.error : "read_failed"));
      return;
    }
    setBundle(body);
    setMessage("");
  }

  async function send(path: string, method: string, payload: Record<string, unknown>) {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as Bundle | { ok: false; error: string };
    if (!response.ok || !body.ok) {
      setMessage(errorText("error" in body ? body.error : "write_failed"));
      return false;
    }
    setBundle(body);
    if (body.duplicate) setMessage("同じページはすでに取り込んであります。候補は増やしていません。");
    else if (body.idempotent) setMessage("すでに同じ内容で提出済みです。確認者と時刻は変えていません。");
    else setMessage("保存しました。取得した候補は、提出するまでチームの報告ではありません。");
    return true;
  }

  const locked = bundle?.report?.state === "submitted";
  const numericYear = Number(year);

  return (
    <main style={{ padding: 24, maxWidth: 880, margin: "0 auto" }}>
      <p>
        <Link href="/results">年次報告の一覧</Link>
      </p>
      <h1>{bundle?.team.name || "公式戦の年次報告"}</h1>
      <p>選手個人の名前は入れないでください。取得した情報だけでは提出になりません。</p>
      <label>
        対象年{" "}
        <input
          value={year}
          inputMode="numeric"
          onChange={(event) => setYear(event.target.value)}
          style={{ width: 100 }}
        />
      </label>
      <button type="button" onClick={() => void load(year)} disabled={!/^\d{4}$/.test(year)}>
        この年を開く
      </button>
      {bundle ? <p>{bundle.discovery.label}</p> : null}
      {bundle?.policy.yearStatus !== "configured" ? (
        <p>義務の対象年と期限は未設定です。この画面で年を選んで下書きできます。試合やチャットは止まりません。</p>
      ) : (
        <p>
          設定上の対象年は {bundle.policy.reportingYear} 年です。
          {bundle.policy.deadlineMonth && bundle.policy.deadlineDay
            ? `期限の設定値は ${bundle.policy.deadlineMonth}/${bundle.policy.deadlineDay} で、表示だけに使います。`
            : "期限は未設定です。"}
        </p>
      )}
      {message ? <p>{message}</p> : null}
      {/^\d{4}$/.test(year) && !bundle?.report ? (
        <button
          type="button"
          onClick={() => void send(`/api/official-results/${teamId}`, "POST", { year: numericYear })}
        >
          この年の下書きを作る
        </button>
      ) : null}
      {bundle?.report ? (
        <>
          <p>
            状態: {STATE_TEXT[bundle.report.state]} / 版 {bundle.report.version}
            {bundle.report.submitted_at
              ? ` / 提出 ${bundle.report.submitted_at} / 確認者 ${bundle.report.submitted_by}`
              : ""}
          </p>
          <section>
            <h2>公開ページから候補を取る</h2>
            <p>自動ではインターネットを検索しません。公式サイトや大会ページのURLを指定してください。</p>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              disabled={locked}
              style={{ width: "100%" }}
            />
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                void send(`/api/official-results/${teamId}/sources`, "POST", {
                  year: numericYear,
                  url,
                })
              }
            >
              このURLを取得する
            </button>
            <ul>
              {bundle.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.source_url}>{source.page_title || source.source_url}</a>
                  <div>取得時刻: {source.retrieved_at}</div>
                  <div>{EXTENT_TEXT[source.discovery_extent] ?? source.discovery_extent}</div>
                  <div>{CONFIDENCE_TEXT[source.match_confidence] ?? source.match_confidence}</div>
                  {source.note ? <div>{source.note}</div> : null}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>取得した元の値</h2>
            <p>ここは取得時の写しです。訂正してもこの欄は変わりません。</p>
            {bundle.candidates.length === 0 ? <p>候補はありません。</p> : null}
            <ul>
              {bundle.candidates.map((candidate) => (
                <li key={candidate.id}>
                  <div>{candidate.excerpt}</div>
                  <div>{candidate.match_basis}</div>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setLine({
                        competitionName: candidate.competition_name ?? "",
                        opponentName: candidate.opponent_name ?? "",
                        playedOn: candidate.played_on ?? "",
                        teamGoals: candidate.team_goals === null ? "" : String(candidate.team_goals),
                        opponentGoals:
                          candidate.opponent_goals === null ? "" : String(candidate.opponent_goals),
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
          <section>
            <h2>チームの報告</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const payload = {
                  year: numericYear,
                  competitionName: line.competitionName,
                  opponentName: line.opponentName,
                  playedOn: line.playedOn || null,
                  teamGoals: goals(line.teamGoals),
                  opponentGoals: goals(line.opponentGoals),
                  teamNote: line.teamNote,
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
              <input
                required
                placeholder="大会名"
                value={line.competitionName}
                disabled={locked}
                onChange={(event) => setLine({ ...line, competitionName: event.target.value })}
              />
              <input
                required
                placeholder="対戦相手のチーム名"
                value={line.opponentName}
                disabled={locked}
                onChange={(event) => setLine({ ...line, opponentName: event.target.value })}
              />
              <input
                placeholder="日付 YYYY-MM-DD"
                value={line.playedOn}
                disabled={locked}
                onChange={(event) => setLine({ ...line, playedOn: event.target.value })}
              />
              <input
                placeholder="自チーム得点"
                value={line.teamGoals}
                disabled={locked}
                onChange={(event) => setLine({ ...line, teamGoals: event.target.value })}
              />
              <input
                placeholder="相手得点"
                value={line.opponentGoals}
                disabled={locked}
                onChange={(event) => setLine({ ...line, opponentGoals: event.target.value })}
              />
              <input
                placeholder="補足（個人名は不可）"
                value={line.teamNote}
                disabled={locked}
                onChange={(event) => setLine({ ...line, teamNote: event.target.value })}
              />
              <label>
                <input
                  type="checkbox"
                  checked={line.included}
                  disabled={locked}
                  onChange={(event) => setLine({ ...line, included: event.target.checked })}
                />
                提出に含める
              </label>
              <button type="submit" disabled={locked}>
                {line.lineId ? "行を訂正する" : "行を追加する"}
              </button>
            </form>
            <ul>
              {bundle.lines.map((item) => (
                <li key={item.id}>
                  {item.included ? "含める" : "外す"} / {item.competition_name} 対 {item.opponent_name}{" "}
                  {item.played_on ?? "日付なし"} {item.team_goals ?? "-"}-{item.opponent_goals ?? "-"}{" "}
                  ({item.result_label})
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setLine({
                        competitionName: item.competition_name,
                        opponentName: item.opponent_name,
                        playedOn: item.played_on ?? "",
                        teamGoals: item.team_goals === null ? "" : String(item.team_goals),
                        opponentGoals: item.opponent_goals === null ? "" : String(item.opponent_goals),
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
          <section>
            <h2>提出</h2>
            <p>提出した時点の確認者と時刻が記録されます。ページの取得だけでは提出になりません。</p>
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                void send(`/api/official-results/${teamId}`, "POST", {
                  action: "review",
                  year: numericYear,
                  expectedVersion: bundle.report?.version,
                })
              }
            >
              確認中にする
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                void send(`/api/official-results/${teamId}/submit`, "POST", {
                  year: numericYear,
                  expectedVersion: bundle.report?.version,
                  outcome: "has_results",
                })
              }
            >
              結果ありで提出する
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                void send(`/api/official-results/${teamId}/submit`, "POST", {
                  year: numericYear,
                  expectedVersion: bundle.report?.version,
                  outcome: "no_official_results",
                })
              }
            >
              公式戦はなかった、として提出する
            </button>
          </section>
          <section>
            <h2>訂正の履歴</h2>
            {bundle.revisions.length === 0 ? <p>訂正はまだありません。</p> : null}
            <ul>
              {bundle.revisions.map((revision) => (
                <li key={revision.id}>
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
