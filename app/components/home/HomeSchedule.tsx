"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadUpcomingSchedule,
  type UpcomingScheduleItem,
} from "@/app/components/home/loadUpcomingSchedule";

type ScheduleMode = "guest" | "checking" | "ready" | "unknown";

function ScheduleHeading({
  level,
  children,
}: {
  level: "h1" | "h2";
  children: string;
}) {
  if (level === "h1") return <h1 className="home-section-title">{children}</h1>;
  return <h2 className="home-section-title">{children}</h2>;
}

function formatScheduleDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  const date = new Date(year, month - 1, day);
  const weeks = ["日", "月", "火", "水", "木", "金", "土"];
  return `${month}/${day}（${weeks[date.getDay()]}）`;
}

function timeRange(start: string, end: string) {
  const from = start.slice(0, 5);
  const to = end.slice(0, 5);
  if (!from && !to) return "";
  if (!to) return from;
  if (!from) return to;
  return `${from}–${to}`;
}

export default function HomeSchedule({
  mode,
  teamIds,
  heading,
}: {
  mode: ScheduleMode;
  teamIds: readonly string[];
  heading: "h1" | "h2";
}) {
  const teamKey = teamIds.join(",");
  const [snapshot, setSnapshot] = useState<{
    key: string;
    items: UpcomingScheduleItem[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (mode !== "ready" || teamKey.length === 0) return;

    let active = true;

    void loadUpcomingSchedule(teamKey.split(","))
      .then((next) => {
        if (!active) return;
        setSnapshot({ key: teamKey, items: next, failed: false });
      })
      .catch((error) => {
        console.error("home schedule error:", error);
        if (!active) return;
        setSnapshot({ key: teamKey, items: [], failed: true });
      });

    return () => {
      active = false;
    };
  }, [mode, teamKey]);

  const loaded = snapshot?.key === teamKey ? snapshot : null;

  const title = (
    <ScheduleHeading level={heading}>マイスケジュール</ScheduleHeading>
  );

  if (mode === "guest") {
    return (
      <section className="home-panel home-empty">
        {title}
        <p className="home-copy">
          ログインすると、自分の試合予定がここに表示されます。
        </p>
        <div className="home-actions">
          <Link href="/login?redirect=/" className="sm-quiet">
            ログイン
          </Link>
        </div>
      </section>
    );
  }

  if (
    mode === "checking" ||
    (mode === "ready" && teamKey.length > 0 && !loaded)
  ) {
    return (
      <section className="home-panel">
        {title}
        <p className="home-copy">予定を確認しています…</p>
      </section>
    );
  }

  if (mode === "unknown" || loaded?.failed) {
    return (
      <section className="home-panel">
        {title}
        <p className="home-copy">予定を確認できませんでした。</p>
      </section>
    );
  }

  const next = loaded?.items[0];
  if (!next) {
    return (
      <section className="home-panel home-empty">
        {title}
        <p className="home-copy">{"まだ予定はありません。"}<Link href="/teams/search" className="home-inline-link">練習試合を探す</Link>{"か、"}<Link href="/match/new" className="home-inline-link">募集</Link>{"してみましょう。"}</p>
      </section>
    );
  }

  const when = timeRange(next.startTime, next.endTime);

  return (
    <Link href="/match/my-schedule" className="home-panel home-panel-link">
      <div className="home-card-top">
        {title}
        <span className="home-card-cta">予定一覧</span>
      </div>
      <p className="home-kicker">次の試合</p>
      <p className="home-next">
        <span className="home-date">{formatScheduleDate(next.date)}</span>
        {when ? <span>{when}</span> : null}
        <span className="home-role">{next.role === "host" ? "主催" : "参加"}</span>
      </p>
      <p className="home-meta">
        {next.categoryText} / {next.areaText}
      </p>
    </Link>
  );
}
