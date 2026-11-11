import assert from "node:assert/strict";
import test from "node:test";
import { reportNoticeHref, reportNoticesFromPayload } from "./reportBanner.ts";

const TEAM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function year(input: {
  fiscalYear: number;
  phase: string;
  code: string;
  deadlineDate?: string;
}) {
  return {
    fiscalYear: input.fiscalYear,
    deadlineDate: input.deadlineDate ?? `${input.fiscalYear + 1}-05-31`,
    phase: input.phase,
    code: input.code,
    blocksProduct: false,
  };
}

function payload(
  teams: Array<{
    id?: string;
    name?: string;
    role?: string;
    years: ReturnType<typeof year>[];
  }>,
) {
  return {
    ok: true as const,
    teams: teams.map((team) => ({
      id: team.id ?? TEAM,
      name: team.name ?? "青葉FC",
      role: team.role ?? "coach",
      years: team.years,
    })),
  };
}

test("the year still in progress is not a home banner", () => {
  const notices = reportNoticesFromPayload(
    payload([
      {
        years: [
          year({ fiscalYear: 2026, phase: "in_progress", code: "not_started" }),
          year({ fiscalYear: 2025, phase: "due", code: "submitted_results" }),
        ],
      },
    ]),
  );
  assert.deepEqual(notices, []);
});

test("an unsubmitted report inside the deadline uses the in-window sentence", () => {
  for (const code of ["not_started", "draft", "in_review"]) {
    const notices = reportNoticesFromPayload(
      payload([{ years: [year({ fiscalYear: 2025, phase: "due", code })] }]),
    );
    assert.equal(notices.length, 1);
    assert.equal(
      notices[0]?.message,
      "青葉FCの2025年度の公式戦年次報告の提出期限は2026年5月31日です。期限内に確認して提出してください。",
    );
    assert.equal(reportNoticeHref(notices), `/results/${TEAM}?year=2025`);
  }
});

test("an overdue unsubmitted report can still be filed and does not block the product", () => {
  const notices = reportNoticesFromPayload(
    payload([
      {
        role: "owner",
        years: [year({ fiscalYear: 2025, phase: "overdue", code: "draft" })],
      },
    ]),
  );
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.phase, "overdue");
  assert.equal(
    notices[0]?.message,
    "提出期限（2026年5月31日）を過ぎています。期限後も提出できます。ほかの機能はそのまま使えます。",
  );
  assert.equal(reportNoticeHref(notices), `/results/${TEAM}?year=2025`);
});

test("submitted reports and members do not get a banner", () => {
  assert.deepEqual(
    reportNoticesFromPayload(
      payload([
        {
          years: [
            year({ fiscalYear: 2025, phase: "overdue", code: "submitted_none" }),
            year({ fiscalYear: 2025, phase: "due", code: "submitted_results" }),
          ],
        },
      ]),
    ),
    [],
  );
  assert.deepEqual(
    reportNoticesFromPayload(
      payload([
        {
          role: "member",
          years: [year({ fiscalYear: 2025, phase: "overdue", code: "not_started" })],
        },
      ]),
    ),
    [],
  );
});

test("several teams open the report list", () => {
  const notices = reportNoticesFromPayload(
    payload([
      {
        id: TEAM,
        name: "青葉FC",
        years: [year({ fiscalYear: 2025, phase: "overdue", code: "not_started" })],
      },
      {
        id: OTHER,
        name: "緑FC",
        role: "owner",
        years: [year({ fiscalYear: 2025, phase: "due", code: "draft" })],
      },
    ]),
  );
  assert.equal(notices.length, 2);
  assert.equal(notices[0]?.phase, "overdue");
  assert.equal(reportNoticeHref(notices), "/results");
});

test("bad payloads and a mismatched deadline stay silent", () => {
  assert.deepEqual(reportNoticesFromPayload(null), []);
  assert.deepEqual(reportNoticesFromPayload({ ok: false, error: "read_failed" }), []);
  assert.deepEqual(reportNoticesFromPayload({ ok: true }), []);
  assert.deepEqual(
    reportNoticesFromPayload(
      payload([
        {
          years: [
            year({
              fiscalYear: 2025,
              phase: "overdue",
              code: "draft",
              deadlineDate: "2026-06-01",
            }),
          ],
        },
      ]),
    ),
    [],
  );
  assert.deepEqual(
    reportNoticesFromPayload(
      payload([
        {
          id: "not-a-uuid",
          years: [year({ fiscalYear: 2025, phase: "due", code: "draft" })],
        },
      ]),
    ),
    [],
  );
});
