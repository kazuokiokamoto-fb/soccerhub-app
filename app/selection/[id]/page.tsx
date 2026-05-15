// /app/selection/[id]/page.tsx

import Link from "next/link";

import { fetchSelectionEventById } from "@/app/lib/selections";

function formatDate(date?: string | null) {
  if (!date) return "未定";

  return new Date(date).toLocaleDateString("ja-JP");
}

function formatTime(time?: string | null) {
  if (!time) return "";

  return time.slice(0, 5);
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

function statusStyle(status?: string): React.CSSProperties {
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
  value?: React.ReactNode;
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

  const timeText =
    item.event_start_time || item.event_end_time
      ? `${formatTime(item.event_start_time)}${
          item.event_end_time ? `–${formatTime(item.event_end_time)}` : ""
        }`
      : "未定";

  const locationText =
    [item.prefecture, item.city, item.area].filter(Boolean).join(" ") ||
    "未定";

  const officialUrl = item.official_url || item.source_url;

  const showLinkSection =
    !!item.official_url && item.official_url !== item.source_url;

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
            {item.display_status}
          </span>
        </div>

        <h1 style={title}>{item.title}</h1>

        <div className="ui-meta" style={organization}>
          {item.organization_name || "団体名未設定"}
        </div>

        {item.summary ? <p style={summary}>{item.summary}</p> : null}

        <div style={heroInfoGrid}>
          <div style={heroInfoBox}>
            <div style={heroInfoLabel}>開催日</div>
            <div style={heroInfoValue}>{formatDate(item.event_date)}</div>
          </div>

          <div style={heroInfoBox}>
            <div style={heroInfoLabel}>時間</div>
            <div style={heroInfoValue}>{timeText}</div>
          </div>

          <div style={heroInfoBox}>
            <div style={heroInfoLabel}>地域</div>
            <div style={heroInfoValue}>{locationText}</div>
          </div>

          <div style={heroInfoBox}>
            <div style={heroInfoLabel}>申込期限</div>
            <div style={heroInfoValue}>
              {formatDate(item.application_deadline)}
            </div>
          </div>
        </div>

        <div style={actionRow}>
          <a
            href={officialUrl}
            target="_blank"
            rel="noreferrer"
            className="sh-btn sh-btn--primary"
            style={actionButton}
          >
            公式サイトを見る
          </a>
        </div>
      </section>

      <section className="ui-card" style={detailCard}>
        <h2 style={sectionTitle}>基本情報</h2>

        <DetailRow label="対象カテゴリ" value={item.target_categories?.join(" / ")} />
        <DetailRow label="対象" value={genderLabel(item.gender)} />
        <DetailRow label="会場" value={item.venue_name} />
        <DetailRow label="住所" value={item.venue_address} />
        <DetailRow label="参加費" value={feeText(item)} />
        <DetailRow label="費用メモ" value={item.fee_note} />
        <DetailRow label="申込開始日" value={formatDate(item.application_start_date)} />
        <DetailRow label="申込期限" value={formatDate(item.application_deadline)} />
      </section>

      {item.description || item.memo ? (
        <section className="ui-card" style={detailCard}>
          <h2 style={sectionTitle}>詳細・メモ</h2>

          {item.description ? (
            <div style={textBlock}>
              {item.description}
            </div>
          ) : null}

          {item.memo ? (
            <div style={memoBox}>
              {item.memo}
            </div>
          ) : null}
        </section>
      ) : null}

      {showLinkSection ? (
        <section className="ui-card" style={detailCard}>
          <h2 style={sectionTitle}>リンク</h2>

          <DetailRow
            label="公式URL"
            value={
              <a
                href={item.official_url || ""}
                target="_blank"
                rel="noreferrer"
                style={plainLink}
              >
                {item.official_url}
              </a>
            }
          />
        </section>
      ) : null}
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 12,
};

const topBar: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const heroCard: React.CSSProperties = {
  padding: 16,
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const orgBadge: React.CSSProperties = {
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

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 11px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 900,
};

const title: React.CSSProperties = {
  margin: "14px 0 0",
  fontSize: 24,
  lineHeight: 1.4,
  color: "#111827",
};

const organization: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
};

const summary: React.CSSProperties = {
  margin: "14px 0 0",
  lineHeight: 1.7,
  color: "#374151",
  fontSize: 14,
};

const heroInfoGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const heroInfoBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#f8faf8",
  border: "1px solid #e5ece7",
};

const heroInfoLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 4,
};

const heroInfoValue: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.4,
};

const actionRow: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "flex-end",
};

const actionButton: React.CSSProperties = {
  textDecoration: "none",
};

const detailCard: React.CSSProperties = {
  padding: 16,
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 18,
  color: "#16391f",
};

const detailRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 10,
  padding: "11px 0",
  borderTop: "1px solid #edf2ee",
};

const detailLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.5,
};

const detailValue: React.CSSProperties = {
  color: "#111827",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.6,
  minWidth: 0,
  wordBreak: "break-word",
};

const textBlock: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  lineHeight: 1.75,
  fontSize: 14,
  color: "#374151",
};

const memoBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#f8faf8",
  border: "1px solid #e5ece7",
  whiteSpace: "pre-wrap",
  lineHeight: 1.7,
  fontSize: 14,
  color: "#374151",
};

const plainLink: React.CSSProperties = {
  color: "#166534",
  fontWeight: 800,
  wordBreak: "break-all",
};

const emptyBox: React.CSSProperties = {
  padding: 22,
  textAlign: "center",
};