// /app/selection/[id]/page.tsx

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { fetchSelectionEventById } from "@/app/lib/selections";

function formatDate(date?: string | null) {
  if (!date) return "未定";
  return new Date(date).toLocaleDateString("ja-JP");
}

function orgLabel(type?: string | null) {
  switch (type) {
    case "j_club":
      return "J下部";
    case "strong_team":
      return "強豪";
    case "school":
      return "スクール";
    case "club_team":
      return "クラブ";
    default:
      return "その他";
  }
}

function genderLabel(gender?: string | null) {
  switch (gender) {
    case "boys":
      return "男子";
    case "girls":
      return "女子";
    default:
      return "男女";
  }
}

function statusStyle(status?: string): CSSProperties {
  if (status === "募集中") {
    return {
      background: "#ecfdf3",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (status === "申込終了" || status === "開催終了") {
    return {
      background: "#f3f4f6",
      color: "#374151",
      border: "1px solid #d1d5db",
    };
  }

  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

function feeText(item: Awaited<ReturnType<typeof fetchSelectionEventById>>) {
  if (!item) return "-";

  if (item.fee_amount != null) {
    return `${item.fee_amount.toLocaleString()}円`;
  }

  if (item.fee_note) return item.fee_note;

  return "未定";
}

function DetailRow(props: {
  label: string;
  value?: ReactNode;
}) {
  return (
    <div style={detailRow}>
      <div style={detailLabel}>{props.label}</div>
      <div style={detailValue}>{props.value || "-"}</div>
    </div>
  );
}

export default async function SelectionDetailPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const params = await props.params;

  const item = await fetchSelectionEventById(params.id);

  if (!item) {
    return (
      <main style={wrap}>
        <Link href="/selection" className="sh-btn">
          ← 一覧へ
        </Link>

        <section className="ui-card" style={emptyBox}>
          情報が見つかりません
        </section>
      </main>
    );
  }

  const locationText =
    [item.prefecture, item.city, item.area].filter(Boolean).join(" ") ||
    "未定";

  const officialUrl = item.official_url || item.source_url || "";

  return (
    <main style={wrap}>
      <div style={topBar}>
        <Link href="/selection" className="sh-btn">
          ← 一覧へ
        </Link>

        <Link href="/" className="sh-btn">
          ホーム
        </Link>
      </div>

      <section className="ui-card" style={heroCard}>
        <div style={badgeRow}>
          <span style={orgBadge}>{orgLabel(item.organization_type)}</span>

          <span
            style={{
              ...statusBadge,
              ...statusStyle(item.display_status),
            }}
          >
            {item.display_status || "日程未定"}
          </span>
        </div>

        <h1 style={title}>{item.title}</h1>

        <div className="ui-meta" style={organization}>
          {item.organization_name || "団体名未設定"}
        </div>

        <div style={summaryRow}>
          {item.summary ? <p style={summary}>{item.summary}</p> : <div />}

          {officialUrl ? (
            <a
              href={officialUrl}
              target="_blank"
              rel="noreferrer"
              className="sh-btn sh-btn--primary"
              style={actionButton}
            >
              公式サイトを見る
            </a>
          ) : null}
        </div>

        <div style={heroInfoGrid}>
          <div style={heroInfoBox}>
            <div style={heroInfoLabel}>開催日</div>
            <div style={heroInfoValue}>{formatDate(item.event_date)}</div>
          </div>

          <div style={heroInfoBox}>
            <div style={heroInfoLabel}>地域</div>
            <div style={heroInfoValue}>{locationText}</div>
          </div>
        </div>
      </section>

      <section className="ui-card" style={detailCard}>
        <h2 style={sectionTitle}>基本情報</h2>

        <DetailRow
          label="対象カテゴリ"
          value={
            item.target_categories?.length
              ? item.target_categories.join(" / ")
              : undefined
          }
        />
        <DetailRow label="対象" value={genderLabel(item.gender)} />
        <DetailRow label="会場" value={item.venue_name} />
        <DetailRow label="住所" value={item.venue_address} />
        <DetailRow label="参加費" value={feeText(item)} />
        <DetailRow label="費用メモ" value={item.fee_note} />
      </section>
    </main>
  );
}

const wrap: CSSProperties = {
  padding: 16,
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 12,
};

const topBar: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const heroCard: CSSProperties = {
  padding: 16,
};

const badgeRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const orgBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 11px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  border: "1px solid #dce9df",
  fontSize: 13,
  fontWeight: 900,
};

const statusBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 11px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 900,
};

const title: CSSProperties = {
  margin: "14px 0 0",
  fontSize: 24,
  lineHeight: 1.4,
  color: "#111827",
};

const organization: CSSProperties = {
  marginTop: 8,
  fontSize: 14,
};

const summaryRow: CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const summary: CSSProperties = {
  margin: 0,
  lineHeight: 1.7,
  color: "#374151",
  fontSize: 14,
  flex: "1 1 360px",
  minWidth: 0,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const actionButton: CSSProperties = {
  textDecoration: "none",
  flexShrink: 0,
  marginLeft: "auto",
};

const heroInfoGrid: CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const heroInfoBox: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#f8faf8",
  border: "1px solid #e5ece7",
};

const heroInfoLabel: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 4,
};

const heroInfoValue: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.4,
};

const detailCard: CSSProperties = {
  padding: 16,
};

const sectionTitle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 18,
  color: "#16391f",
};

const detailRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 10,
  padding: "11px 0",
  borderTop: "1px solid #edf2ee",
};

const detailLabel: CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.5,
};

const detailValue: CSSProperties = {
  color: "#111827",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.6,
  minWidth: 0,
  wordBreak: "break-word",
};

const emptyBox: CSSProperties = {
  padding: 22,
  textAlign: "center",
};