"use client";

import Link from "next/link";
import { MorePanel } from "@/app/components/ui/MorePanel";
import { areaText } from "./mypage.helpers";
import type { TeamRow } from "./mypage.types";

function roleLabel(role?: string | null) {
  if (role === "owner") return "管理者";
  if (role === "coach") return "コーチ";
  if (role === "member") return "メンバー";
  return "未設定";
}

export function MyPageTeamCard({
  team,
  role,
  deleting = false,
  onDelete,
}: {
  team: TeamRow;
  role?: string | null;
  deleting?: boolean;
  onDelete?: () => void;
}) {
  const isOwner = role === "owner";
  const canEditAffiliation = role === "owner" || role === "coach";
  const categories =
    Array.isArray(team.categories) && team.categories.length > 0
      ? team.categories.map((category) => String(category)).join(" / ")
      : String(team.category ?? "未設定");

  return (
    <article className="sm-card sm-stack">
      <div className="sm-chip-row">
        <span className="status-chip status-chip--ok">{roleLabel(role)}</span>
        <span className="sm-chip sm-chip--static">{categories || "カテゴリ未設定"}</span>
        <span className="sm-chip sm-chip--static">
          {team.has_ground ? "グラウンドあり" : "グラウンドなし"}
        </span>
      </div>
      <h3 className="sm-key">{team.name || "名称未設定"}</h3>
      <p className="sm-stat" style={{ justifySelf: "start" }}>
        <strong>{team.strength_rank || "–"}</strong>
        <span>{areaText(team)}</span>
      </p>
      <Link href={`/teams/${team.id}?from=mypage`} className="sh-btn sh-btn--primary">
        詳細
      </Link>
      {canEditAffiliation ? (
        <Link href={`/teams/${team.id}/affiliation`} className="sh-btn">
          所属
        </Link>
      ) : null}
      <MorePanel label="その他">
        <p className="sm-meta">
          ユニフォーム {team.uniform_main || "未設定"} / {team.uniform_sub || "未設定"}
          {team.uniform_gk ? ` / GK ${team.uniform_gk}` : ""}
        </p>
        {canEditAffiliation ? (
          <Link href={`/results/${team.id}`} className="sh-btn">
            年次報告
          </Link>
        ) : null}
        {isOwner && onDelete ? (
          <button
            type="button"
            className="sh-btn sh-btn--danger"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? "削除中…" : "削除"}
          </button>
        ) : null}
      </MorePanel>
    </article>
  );
}
