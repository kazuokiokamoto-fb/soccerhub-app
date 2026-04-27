"use client";

import React from "react";
import Link from "next/link";
import { categoryLabel } from "@/app/lib/categories";
import type { ScheduleStatus } from "@/app/lib/types";
import {
  dashboardLinkRow,
  dashboardLinkLabel,
  dashboardLinkHelper,
  dashboardLinkValue,
  dashboardGrid,
  dashboardCard,
  dashboardTitle,
  statusList,
  dashboardScheduleInner,
  scheduleMainRow,
  schedulePrimaryText,
  scheduleDateBadge,
  scheduleTimeText,
  scheduleConfirmedBadge,
  scheduleDraftBadge,
  scheduleMetaText,
  scheduleSubMetaText,
  scheduleActionRowRight,
  emptyScheduleText,
  infoGrid,
  infoRow,
  teamActionWrap,
  teamList,
  card,
  cardHead,
  cardTitleArea,
  cardActions,
  subText,
  metaBox,
  metaRow,
  noteBox,
  noteTitle,
  noteBody,
  categoryMetaList,
  notifyWrap,
  deleteBtn,
} from "./mypage.styles";

export type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  area: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  has_ground?: boolean | null;
  category_meta?: Record<
    string,
    { strength_rank?: string | null; member_count?: number | null }
  > | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  uniform_gk?: string | null;
  note?: string | null;
};

export type ProfileRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  line_id: string | null;
  notify_email: boolean | null;
  notify_line: boolean | null;
};

export type NextScheduleCard = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string | null;
  opponent: string | null;
  venueName: string | null;
  address: string | null;
  status: ScheduleStatus | null;
  threadId: string | null;
};

export function DashboardLinkRow(props: {
  href: string;
  label: string;
  value: number;
  helper?: string;
}) {
  const { href, label, value, helper } = props;

  return (
    <Link href={href} style={dashboardLinkRow}>
      <div style={{ minWidth: 0 }}>
        <div style={dashboardLinkLabel}>{label}</div>
        {helper ? <div style={dashboardLinkHelper}>{helper}</div> : null}
      </div>
      <span style={dashboardLinkValue}>{value}</span>
    </Link>
  );
}

export function CurrentStatusSection(props: {
  openCount: number;
  receivedOfferCount: number;
  sentOfferCount: number;
  unreadTotal: number;
  nextSchedule: NextScheduleCard | null;
  scheduleCount: number;
  formatScheduleDate: (ymd?: string | null) => string;
  fmtTime: (v?: string | null) => string;
  scheduleStatusLabel: (status?: ScheduleStatus | null) => string;
}) {
  const {
    openCount,
    receivedOfferCount,
    sentOfferCount,
    unreadTotal,
    nextSchedule,
    scheduleCount,
    formatScheduleDate,
    fmtTime,
    scheduleStatusLabel,
  } = props;

  return (
    <div style={dashboardGrid}>
      <div style={dashboardCard}>
        <div style={dashboardTitle}>⚽ あなたの試合状況</div>

        <div style={statusList}>
          <DashboardLinkRow
            href="/match/status/open"
            label="募集中の試合"
            value={openCount}
            helper={
              openCount === 0
                ? "まだ募集していません"
                : "現在公開中の募集です"
            }
          />
          <DashboardLinkRow
            href="/match/status/offers-received"
            label="届いたオファー"
            value={receivedOfferCount}
            helper={
              receivedOfferCount === 0
                ? "新しいオファーはありません"
                : "確認待ちのオファーがあります"
            }
          />
          <DashboardLinkRow
            href="/match/status/offers"
            label="送ったオファー"
            value={sentOfferCount}
            helper={
              sentOfferCount === 0
                ? "まだオファーを送っていません"
                : "返答待ちのオファーがあります"
            }
          />
        </div>
      </div>

      <div style={dashboardCard}>
        <div style={dashboardTitle}>💬 チャット</div>

        <div style={statusList}>
          <DashboardLinkRow
            href="/chat"
            label="未読メッセージ"
            value={unreadTotal}
            helper={
              unreadTotal === 0
                ? "新しいメッセージはありません"
                : "未読があります"
            }
          />
        </div>
      </div>

      <div style={dashboardCard}>
        <div style={dashboardTitle}>🗓 予定一覧</div>

        <div style={dashboardScheduleInner}>
          {nextSchedule ? (
            <>
              <div style={scheduleMainRow}>
                <div style={schedulePrimaryText}>
                  <span style={scheduleDateBadge}>
                    {formatScheduleDate(nextSchedule.date)}
                  </span>

                  <span style={scheduleTimeText}>
                    {fmtTime(nextSchedule.startTime)}
                    {nextSchedule.endTime
                      ? `–${fmtTime(nextSchedule.endTime)}`
                      : ""}
                  </span>

                  <span
                    style={
                      nextSchedule.status === "confirmed"
                        ? scheduleConfirmedBadge
                        : scheduleDraftBadge
                    }
                  >
                    {scheduleStatusLabel(nextSchedule.status)}
                  </span>
                </div>
              </div>

              <div style={scheduleMetaText}>
                {(nextSchedule.category || "カテゴリ未設定") +
                  " / " +
                  (nextSchedule.opponent || "対戦相手未設定")}
              </div>

              <div style={scheduleSubMetaText}>
                {nextSchedule.venueName || "会場名未設定"}
                {nextSchedule.address ? ` / ${nextSchedule.address}` : ""}
              </div>

              <div style={scheduleActionRowRight}>
                <Link href="/match/my-schedule/calendar" className="sh-btn">
                  カレンダー
                </Link>

                <Link
                  href="/match/my-schedule"
                  className="sh-btn sh-btn--primary"
                >
                  予定一覧
                </Link>
              </div>
            </>
          ) : (
            <>
              <div style={emptyScheduleText}>直近の予定はありません。</div>

              <div style={scheduleActionRowRight}>
                <Link href="/match/my-schedule/calendar" className="sh-btn">
                  カレンダー
                </Link>

                <Link
                  href="/match/my-schedule"
                  className="sh-btn sh-btn--primary"
                >
                  予定一覧
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountSection(props: {
  me: { id: string; email: string | null } | null;
  profile: ProfileRow | null;
}) {
  const { me, profile } = props;

  return (
    <div style={infoGrid}>
      <div style={infoRow}>
        <b>メール</b>
        <span>{me?.email ?? "未設定"}</span>
      </div>

      <div style={infoRow}>
        <b>代表者氏名</b>
        <span>{profile?.name ?? "未設定"}</span>
      </div>

      <div style={infoRow}>
        <b>電話番号</b>
        <span>{profile?.phone ?? "未設定"}</span>
      </div>

      <div style={infoRow}>
        <b>LINE ID</b>
        <span>{profile?.line_id ?? "未設定"}</span>
      </div>

      <div style={infoRow}>
        <b>通知</b>
        <span>アプリ内通知を使用</span>
      </div>
    </div>
  );
}

export function NotificationSection(props: {
  children: React.ReactNode;
}) {
  return (
    <div style={notifyWrap}>
      <div>
        チャットやオファーの通知を受け取るには、通知を許可してください。
      </div>
      {props.children}
    </div>
  );
}

export function TeamSection(props: {
  teams: TeamRow[];
  mainTeam: TeamRow | null;
  deletingTeamId: string;
  deleteTeam: (team: TeamRow) => void;
  areaText: (team?: TeamRow | null) => string;
  categoryText: (team?: TeamRow | null) => string;
  categoryMetaEntries: (
    team?: TeamRow | null
  ) => [string, { strength_rank?: string | null; member_count?: number | null }][];
  rankLabel: (level?: number | null) => string;
}) {
  const {
    teams,
    mainTeam,
    deletingTeamId,
    deleteTeam,
    areaText,
    categoryText,
    categoryMetaEntries,
    rankLabel,
  } = props;

  return (
    <>
      <div style={teamActionWrap}>
        <Link href="/teams/new" className="sh-btn">
          ＋チーム登録
        </Link>

        {mainTeam ? (
          <Link
            href={`/teams/${mainTeam.id}/edit`}
            className="sh-btn sh-btn--primary"
          >
            チーム編集
          </Link>
        ) : null}
      </div>

      {teams.length === 0 ? (
        <div style={{ color: "#666", marginTop: 12 }}>
          まだチーム登録がありません。
        </div>
      ) : (
        <div style={teamList}>
          {teams.map((team) => {
            const isDeleting = deletingTeamId === team.id;
            const metaEntries = categoryMetaEntries(team);

            return (
              <div key={team.id} style={card}>
                <div style={cardHead}>
                  <div style={cardTitleArea}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {team.name}
                    </div>
                    <div style={subText}>{categoryText(team)}</div>
                  </div>

                  <div style={cardActions}>
                    <Link href={`/teams/${team.id}?from=mypage`} className="sh-btn">
                      詳細
                    </Link>
                    <Link
                      href={`/teams/${team.id}/edit`}
                      className="sh-btn sh-btn--primary"
                    >
                      編集
                    </Link>
                    <button
                      type="button"
                      className="sh-btn"
                      onClick={() => deleteTeam(team)}
                      disabled={isDeleting}
                      style={deleteBtn}
                    >
                      {isDeleting ? "削除中…" : "削除"}
                    </button>
                  </div>
                </div>

                <div style={{ color: "#555", marginTop: 10, lineHeight: 1.8 }}>
                  エリア : {areaText(team)}
                  <br />
                  カテゴリ : {categoryText(team)}
                  <br />
                  グラウンド提供 : {team.has_ground ? "あり" : "なし"}
                  <br />
                  ユニフォーム : {team.uniform_main ?? "不明"} /{" "}
                  {team.uniform_sub ?? "不明"} / GK:{" "}
                  {team.uniform_gk ?? "不明"}
                </div>

                {metaEntries.length > 0 ? (
                  <div style={metaBox}>
                    <div style={noteTitle}>カテゴリ別設定</div>
                    <div style={categoryMetaList}>
                      {metaEntries.map(([cat, meta]) => (
                        <div key={cat} style={metaRow}>
                          <div style={{ fontWeight: 800 }}>
                            {categoryLabel(cat) || cat}
                          </div>
                          <div style={{ color: "#555", lineHeight: 1.7 }}>
                            強さ : {meta?.strength_rank || "未設定"}
                            <br />
                            所属人数 : {meta?.member_count ?? "未設定"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={metaBox}>
                    <div style={noteTitle}>カテゴリ別設定</div>
                    <div style={{ color: "#555", lineHeight: 1.7 }}>
                      強さ : {team.strength_rank || rankLabel(team.level)}
                      <br />
                      所属人数 : 未設定
                    </div>
                  </div>
                )}

                {team.note?.trim() ? (
                  <div style={noteBox}>
                    <div style={noteTitle}>メモ</div>
                    <div style={noteBody}>{team.note}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}