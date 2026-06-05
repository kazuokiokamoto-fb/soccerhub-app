"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchSelectionEvents } from "@/app/lib/selections";
import type { SelectionEvent } from "@/app/types/selection";

type SelectionSectionProps = {
  eventCount?: number;
  candidateCount?: number;
};

export function SelectionSection(props: SelectionSectionProps) {
  const { eventCount, candidateCount } = props;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SelectionEvent[]>([]);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      // HomeCalendar 側から件数を渡している場合は、ここでは再取得しない
      if (typeof eventCount === "number") {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const rows = await fetchSelectionEvents();

        if (!active) return;

        setItems(rows);
      } catch (e: any) {
        console.error("SelectionSection load error:", e);

        if (!active) return;

        setItems([]);
        setErrorText(e?.message ?? "読み込みエラー");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [eventCount]);

  const fixedCount =
    typeof eventCount === "number" ? eventCount : items.length;

  const candidateTotal =
    typeof candidateCount === "number" ? candidateCount : 0;

  const totalCount = fixedCount + candidateTotal;

  return (
    <Link href="/selection" style={sectionLink}>
      <section style={summaryBoxClickable} className="ui-card">
        <div style={summaryCardTop}>
          <div style={summaryDateText} className="ui-title">
            セレクション情報
          </div>

          <span style={sectionCtaSmall}>セレ一覧</span>
        </div>

        <div style={summaryInnerCompactBox} className="ui-card-soft">
          <div>
            <div style={summaryCountLineCompact} className="ui-title">
              掲載件数：
              {loading ? "読み込み中…" : `${totalCount.toLocaleString()}件`}
            </div>

            <div style={summarySubTight} className="ui-meta">
              {errorText
                ? `取得エラー：${errorText}`
                : `確定情報 ${fixedCount.toLocaleString()}件 / 候補 ${candidateTotal.toLocaleString()}件`}
            </div>
          </div>
        </div>
      </section>
    </Link>
  );
}

const summaryBox: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
};

const summaryCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const summaryDateText: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
};

const summaryInnerCompactBox: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  display: "grid",
  gap: 10,
};

const summaryCountLineCompact: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
};

const summarySubTight: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
};

const sectionLink: React.CSSProperties = {
  display: "block",
  color: "inherit",
  textDecoration: "none",
};

const summaryBoxClickable: React.CSSProperties = {
  ...summaryBox,
  cursor: "pointer",
};

const sectionCtaSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 999,
  background: "#0f7a35",
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
