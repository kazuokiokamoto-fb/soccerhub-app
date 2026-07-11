"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchSelectionEvents } from "@/app/lib/selections";
import type { SelectionEvent } from "@/app/types/selection";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";

type SelectionSectionProps = {
  eventCount?: number;
  newCount?: number;
};

export function SelectionSection(props: SelectionSectionProps) {
  const { eventCount, newCount } = props;
  const { user } = useAuth();
  const meId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SelectionEvent[]>([]);
  const [errorText, setErrorText] = useState("");
  const [unreadSelectionCount, setUnreadSelectionCount] = useState(0);

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

  // ログイン中ユーザー宛ての「未読セレクション新着通知」件数を取得してバッジ表示する
  useEffect(() => {
    let active = true;

    async function loadUnreadSelectionCount() {
      if (!meId) {
        if (active) setUnreadSelectionCount(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", meId)
          .eq("type", "selection_event")
          .eq("is_read", false);

        if (error) {
          console.error("SelectionSection unread count error:", error);
          if (active) setUnreadSelectionCount(0);
          return;
        }

        if (active) setUnreadSelectionCount(count ?? 0);
      } catch (e) {
        console.error("SelectionSection unread count catch:", e);
        if (active) setUnreadSelectionCount(0);
      }
    }

    void loadUnreadSelectionCount();

    // 通知一覧ページなどで既読化された時にも反映されるよう、
    // 既存のイベント(badge-updated / notifications-updated)を購読して再取得する
    function handleBadgeUpdated() {
      void loadUnreadSelectionCount();
    }

    window.addEventListener("badge-updated", handleBadgeUpdated);
    window.addEventListener("notifications-updated", handleBadgeUpdated);

    return () => {
      active = false;
      window.removeEventListener("badge-updated", handleBadgeUpdated);
      window.removeEventListener("notifications-updated", handleBadgeUpdated);
    };
  }, [meId]);

  const fixedCount =
    typeof eventCount === "number" ? eventCount : items.length;

  const recentCount =
    typeof newCount === "number" ? newCount : 0;

  return (
    <Link href="/selection" style={sectionLink}>
      <section style={summaryBoxClickable} className="ui-card">
        <div style={summaryCardTop}>
          <div style={summaryTitleRow}>
            <div style={summaryDateText} className="ui-title">
              セレクション情報
            </div>

            {unreadSelectionCount > 0 ? (
              <span style={unreadBadge}>{unreadSelectionCount}</span>
            ) : null}
          </div>

          <span style={sectionCtaSmall}>セレ一覧</span>
        </div>

        <div style={summaryInnerCompactBox} className="ui-card-soft">
          <div>
            <div style={summaryCountLineCompact} className="ui-title">
              掲載件数：
              {loading ? "読み込み中…" : `${fixedCount.toLocaleString()}件`}
            </div>

            <div style={summarySubTight} className="ui-meta">
              {errorText
                ? `取得エラー：${errorText}`
                : `過去7日間の新着：${recentCount.toLocaleString()}件`}
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

const summaryTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const summaryDateText: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
};

const unreadBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 22,
  height: 22,
  padding: "0 6px",
  borderRadius: 999,
  background: "#dc2626",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1,
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
