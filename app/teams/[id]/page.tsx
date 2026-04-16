"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import TeamProfileCard, {
  TeamProfileCardRow,
} from "@/app/teams/components/TeamProfileCard";

type TeamRow = TeamProfileCardRow;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

function toTeamRow(value: unknown): TeamRow | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;

  return {
    id: value.id,
    owner_id: toNullableString(value.owner_id),
    name: toNullableString(value.name),
    category: toNullableString(value.category),
    categories: toStringArrayOrNull(value.categories),
    level: toNullableNumber(value.level),
    strength_rank: toNullableString(value.strength_rank),
    area: toNullableString(value.area),
    prefecture: toNullableString(value.prefecture),
    city: toNullableString(value.city),
    town: toNullableString(value.town),
    address_detail: toNullableString(value.address_detail),
    member_count: toNullableNumber(value.member_count),
    uniform_main: toNullableString(value.uniform_main),
    uniform_sub: toNullableString(value.uniform_sub),
    note: toNullableString(value.note),
  };
}

function buildBackLink(params: {
  from: string | null;
  slotId: string | null;
  date: string | null;
}) {
  const { from, slotId, date } = params;

  if (from === "match-calendar") {
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    if (slotId) qs.set("slotId", slotId);

    return {
      href: qs.toString() ? `/match?${qs.toString()}` : "/match",
      label: "← カレンダーへ戻る",
      chatFrom: "match-calendar",
    };
  }

  if (from === "match_detail") {
    if (slotId) {
      return {
        href: `/match/${slotId}`,
        label: "← 試合詳細へ戻る",
        chatFrom: "match_detail",
      };
    }

    return {
      href: "/match/my-schedule",
      label: "← 予定一覧へ戻る",
      chatFrom: "match_detail",
    };
  }

  return {
    href: "/teams",
    label: "← チーム一覧へ戻る",
    chatFrom: "team-detail",
  };
}

export default function TeamDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const teamId = useMemo(() => {
    const raw = params?.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return "";
  }, [params]);

  const myUserId = user?.id ?? "";

  const from = searchParams.get("from");
  const slotId = searchParams.get("slotId");
  const date = searchParams.get("date");

  const backConfig = useMemo(() => {
    return buildBackLink({ from, slotId, date });
  }, [from, slotId, date]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [team, setTeam] = useState<TeamRow | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!teamId) {
        if (!active) return;
        setTeam(null);
        setLoadError("チームIDが不正です");
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const { data, error } = await supabase
          .from("teams")
          .select(
            [
              "id",
              "owner_id",
              "name",
              "category",
              "categories",
              "level",
              "strength_rank",
              "area",
              "prefecture",
              "city",
              "town",
              "address_detail",
              "member_count",
              "uniform_main",
              "uniform_sub",
              "note",
            ].join(",")
          )
          .eq("id", teamId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!active) return;

        if (!data) {
          setTeam(null);
          setLoadError("チームが見つかりません");
          return;
        }

        const nextTeam = toTeamRow(data);
        if (!nextTeam) {
          setTeam(null);
          setLoadError("チームデータの形式が不正です");
          return;
        }

        setTeam(nextTeam);
      } catch (e: any) {
        console.error("[team detail] load error:", e);
        if (!active) return;
        setTeam(null);
        setLoadError(e?.message ?? "チーム詳細の取得に失敗しました");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [teamId]);

  const mine = !!myUserId && !!team && team.owner_id === myUserId;

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="👥"
        title="チーム詳細"
        desc="登録チームのプロフィールを確認できます。"
      />

      {loading || authLoading ? (
        <div style={loadingBox}>読み込み中…</div>
      ) : loadError ? (
        <div style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{loadError}</div>

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : !team ? (
        <div style={emptyBox}>チームが見つかりませんでした。</div>
      ) : (
        <TeamProfileCard
          title="チーム詳細"
          team={team}
          myUserId={myUserId}
          backHref={backConfig.href}
          backLabel={backConfig.label}
          showBackButton
          editHref={`/teams/${team.id}/edit`}
          showEditButton
          showGeminiSection={!mine}
          showChatButton={!mine}
          showStrengthHelpButton
          showAddressDetail={false}
          chatFrom={backConfig.chatFrom}
        />
      )}
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

const loadingBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  lineHeight: 1.8,
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  lineHeight: 1.7,
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  lineHeight: 1.8,
  textAlign: "center",
};