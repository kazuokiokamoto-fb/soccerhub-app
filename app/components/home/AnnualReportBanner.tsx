"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  reportNoticeHref,
  reportNoticesFromPayload,
  type ReportNotice,
} from "@/lib/home/reportBanner";

export function ReportNoticeList({ notices }: { notices: readonly ReportNotice[] }) {
  return (
    <aside className="home-report" aria-label="公式戦の年次報告">
      {notices.map((notice) => (
        <div key={`${notice.teamId}:${notice.fiscalYear}`} className="home-report-item">
          <span className={notice.phase === "overdue" ? "status-chip status-chip--late" : "status-chip status-chip--ok"}>
            {notice.message}
          </span>
          <p className="home-report-title">
            {notice.teamName}
            <span>{notice.fiscalYear}年度</span>
          </p>
        </div>
      ))}
      <div className="home-actions">
        <Link href={reportNoticeHref(notices)} className="sh-btn sh-btn--primary">
          報告を開く
        </Link>
      </div>
    </aside>
  );
}

export default function AnnualReportBanner({ userId }: { userId: string }) {
  const [notices, setNotices] = useState<ReportNotice[] | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/official-results", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (cancelled) return;
        setNotices(reportNoticesFromPayload(body));
      } catch (error) {
        console.error("home report banner skipped:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!notices || notices.length === 0) return null;

  return <ReportNoticeList notices={notices} />;
}
