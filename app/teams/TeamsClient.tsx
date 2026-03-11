"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "../lib/supabase";
import { Team } from "../lib/types";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import { StrengthRankPicker, type StrengthRank } from "@/app/components/StrengthRankPicker";

type DbTeam = {
  id: string;
  name: string;
  area: string | null;
  category: string | null;
  categories: string[] | null;

  prefecture: string | null;
  city: string | null;
  town: string | null;
  address_detail?: string | null;

  level: number | null;
  strength_rank?: string | null;

  has_ground: boolean | null;
  bike_parking: string | null;
  bike_parking_capacity?: string | null;

  member_count?: number | null;

  uniform_main: string | null;
  uniform_sub: string | null;
  roster_by_grade: Record<string, number> | null;
  desired_dates: string[] | null;
  note: string | null;
  updated_at: string;
  owner_id: string | null;
};

type TeamRow = Team & {
  categories?: string[] | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  addressDetail?: string | null;
  strengthRank?: string | null;
  bikeParkingCapacity?: string | null;
  memberCount?: number | null;
  ownerId?: string | null;
};

type Toast = { type: "success" | "error" | "info"; text: string };

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("bike_parking_capacity") ||
        msg.includes("member_count") ||
        msg.includes("strength_rank") ||
        msg.includes("address_detail")))
  );
}

function formatAvailability(desiredDates?: string[]) {
  const arr = Array.isArray(desiredDates) ? desiredDates.filter(Boolean) : [];
  if (arr.length === 0) return "未登録";

  const pretty = arr.map((s) => {
    const t = String(s).trim();
    if (!t) return "";
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return `${parts[0]}（時間帯問わず）`;
    const day = parts[0];
    const slot = parts.slice(1).join(" ");
    return `${day}（${slot}）`;
  });

  return pretty.filter(Boolean).join(" / ") || "未登録";
}

function norm(s?: string | null) {
  return (s ?? "").trim();
}

function compareStr(a: string, b: string) {
  return a.localeCompare(b, "ja");
}

function levelLabel(level: number) {
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function sumRoster(roster?: Record<string, number> | null) {
  if (!roster) return 0;
  return Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v || v === "不明") return null;
  if (v.includes("50")) return 50;
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toTeam(row: DbTeam): TeamRow {
  const roster = (row.roster_by_grade ??
    {
      G1: 0,
      G2: 0,
      G3: 0,
      G4: 0,
      G5: 0,
      G6: 0,
    }) as Record<string, number>;

  return {
    id: row.id,
    name: row.name,
    area: row.area ?? "",
    category: row.category ?? "",
    level: Number(row.level ?? 5),
    hasGround: !!row.has_ground,
    bikeParking: row.bike_parking ?? "不明",
    uniformMain: row.uniform_main ?? "不明",
    uniformSub: row.uniform_sub ?? "不明",
    rosterByGrade: roster as any,
    desiredDates: row.desired_dates ?? [],
    note: row.note ?? "",
    updatedAt: row.updated_at,

    categories: row.categories ?? (row.category ? [row.category] : []),
    prefecture: row.prefecture,
    city: row.city,
    town: row.town,
    addressDetail: row.address_detail ?? null,
    strengthRank: row.strength_rank ?? null,
    bikeParkingCapacity: row.bike_parking_capacity ?? null,
    memberCount:
      row.member_count != null ? Number(row.member_count) : sumRoster(row.roster_by_grade),
    ownerId: row.owner_id ?? null,
  };
}

export default function TeamsClient({ createdId }: { createdId?: string }) {
  const created = createdId ?? "";

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<string[]>([]);
  const [draftPrefectureFilter, setDraftPrefectureFilter] = useState<string>("");
  const [draftCityFilter, setDraftCityFilter] = useState<string>("");
  const [draftTownFilter, setDraftTownFilter] = useState<string>("");

  const [draftStrengthFilter, setDraftStrengthFilter] = useState<StrengthRank | "">("");
  const [draftGroundFilter, setDraftGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [draftBikeFilter, setDraftBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [draftBikeCapacityMin, setDraftBikeCapacityMin] = useState<string>("");
  const [draftMemberCountMin, setDraftMemberCountMin] = useState<string>("");
  const [draftHasNoteOnly, setDraftHasNoteOnly] = useState(false);

  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedCategoryFilter, setAppliedCategoryFilter] = useState<string[]>([]);
  const [appliedPrefectureFilter, setAppliedPrefectureFilter] = useState<string>("");
  const [appliedCityFilter, setAppliedCityFilter] = useState<string>("");
  const [appliedTownFilter, setAppliedTownFilter] = useState<string>("");

  const [appliedStrengthFilter, setAppliedStrengthFilter] = useState<StrengthRank | "">("");
  const [appliedGroundFilter, setAppliedGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [appliedBikeFilter, setAppliedBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [appliedBikeCapacityMin, setAppliedBikeCapacityMin] = useState<string>("");
  const [appliedMemberCountMin, setAppliedMemberCountMin] = useState<string>("");
  const [appliedHasNoteOnly, setAppliedHasNoteOnly] = useState(false);

  useEffect(() => {
    if (!created) return;
    setToast({ type: "success", text: "✅ チームを登録しました（検索結果に反映）" });
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [created]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const load = async () => {
    setLoading(true);

    let res = await supabase.from("teams").select(
      "id,name,area,category,categories,prefecture,city,town,address_detail,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,member_count,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at,owner_id"
    );

    if (res.error && isMissingColumnError(res.error)) {
      res = await supabase.from("teams").select(
        "id,name,area,category,categories,prefecture,city,town,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at,owner_id"
      );
    }

    if (res.error) {
      console.error(res.error);
      setToast({ type: "error", text: `読み込みに失敗しました: ${res.error.message}` });
      setTeams([]);
      setLoading(false);
      return;
    }

    const rows = (res.data ?? []) as DbTeam[];

    const sorted = [...rows].sort((a, b) => {
      const ap = norm(a.prefecture) || norm(a.area);
      const bp = norm(b.prefecture) || norm(b.area);
      if (ap !== bp) return compareStr(ap, bp);

      const ac = norm(a.city);
      const bc = norm(b.city);
      if (ac !== bc) return compareStr(ac, bc);

      const at = norm(a.town);
      const bt = norm(b.town);
      if (at !== bt) return compareStr(at, bt);

      return compareStr(norm(a.name), norm(b.name));
    });

    setTeams(sorted.map(toTeam));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setAppliedKeyword(draftKeyword);
    setAppliedCategoryFilter([...draftCategoryFilter]);
    setAppliedPrefectureFilter(draftPrefectureFilter);
    setAppliedCityFilter(draftCityFilter);
    setAppliedTownFilter(draftTownFilter);
    setAppliedStrengthFilter(draftStrengthFilter);
    setAppliedGroundFilter(draftGroundFilter);
    setAppliedBikeFilter(draftBikeFilter);
    setAppliedBikeCapacityMin(draftBikeCapacityMin);
    setAppliedMemberCountMin(draftMemberCountMin);
    setAppliedHasNoteOnly(draftHasNoteOnly);
  };

  const clearFilters = () => {
    setDraftKeyword("");
    setDraftCategoryFilter([]);
    setDraftPrefectureFilter("");
    setDraftCityFilter("");
    setDraftTownFilter("");
    setDraftStrengthFilter("");
    setDraftGroundFilter("all");
    setDraftBikeFilter("all");
    setDraftBikeCapacityMin("");
    setDraftMemberCountMin("");
    setDraftHasNoteOnly(false);

    setAppliedKeyword("");
    setAppliedCategoryFilter([]);
    setAppliedPrefectureFilter("");
    setAppliedCityFilter("");
    setAppliedTownFilter("");
    setAppliedStrengthFilter("");
    setAppliedGroundFilter("all");
    setAppliedBikeFilter("all");
    setAppliedBikeCapacityMin("");
    setAppliedMemberCountMin("");
    setAppliedHasNoteOnly(false);
  };

  const hasDraftChanges = useMemo(() => {
    return (
      draftKeyword !== appliedKeyword ||
      JSON.stringify(draftCategoryFilter) !== JSON.stringify(appliedCategoryFilter) ||
      draftPrefectureFilter !== appliedPrefectureFilter ||
      draftCityFilter !== appliedCityFilter ||
      draftTownFilter !== appliedTownFilter ||
      draftStrengthFilter !== appliedStrengthFilter ||
      draftGroundFilter !== appliedGroundFilter ||
      draftBikeFilter !== appliedBikeFilter ||
      draftBikeCapacityMin !== appliedBikeCapacityMin ||
      draftMemberCountMin !== appliedMemberCountMin ||
      draftHasNoteOnly !== appliedHasNoteOnly
    );
  }, [
    draftKeyword,
    appliedKeyword,
    draftCategoryFilter,
    appliedCategoryFilter,
    draftPrefectureFilter,
    appliedPrefectureFilter,
    draftCityFilter,
    appliedCityFilter,
    draftTownFilter,
    appliedTownFilter,
    draftStrengthFilter,
    appliedStrengthFilter,
    draftGroundFilter,
    appliedGroundFilter,
    draftBikeFilter,
    appliedBikeFilter,
    draftBikeCapacityMin,
    appliedBikeCapacityMin,
    draftMemberCountMin,
    appliedMemberCountMin,
    draftHasNoteOnly,
    appliedHasNoteOnly,
  ]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (appliedCategoryFilter.length > 0) {
        const cats =
          Array.isArray(t.categories) && t.categories.length > 0
            ? t.categories
            : t.category
            ? [t.category]
            : [];
        const ok = cats.some((c) => c && appliedCategoryFilter.includes(String(c).trim()));
        if (!ok) return false;
      }

      if (appliedPrefectureFilter && norm(t.prefecture) !== appliedPrefectureFilter) return false;
      if (appliedCityFilter && norm(t.city) !== appliedCityFilter) return false;
      if (appliedTownFilter && norm(t.town) !== appliedTownFilter) return false;

      if (appliedStrengthFilter && levelLabel(Number(t.level ?? 0)) !== appliedStrengthFilter) {
        return false;
      }

      if (appliedGroundFilter !== "all") {
        const ground = t.hasGround ? "あり" : "なし";
        if (ground !== appliedGroundFilter) return false;
      }

      if (appliedBikeFilter !== "all") {
        if ((t.bikeParking ?? "不明") !== appliedBikeFilter) return false;
      }

      if (appliedBikeCapacityMin) {
        const cap = parseBikeCapacity(t.bikeParkingCapacity);
        if (cap == null || cap < Number(appliedBikeCapacityMin)) return false;
      }

      if (appliedMemberCountMin) {
        const count = Number(t.memberCount ?? 0);
        if (count < Number(appliedMemberCountMin)) return false;
      }

      if (appliedHasNoteOnly && !norm(t.note)) return false;

      if (appliedKeyword.trim()) {
        const q = appliedKeyword.trim().toLowerCase();
        const hay = [
          t.name,
          t.area,
          t.prefecture,
          t.city,
          t.town,
          t.category,
          ...(t.categories ?? []),
          t.uniformMain,
          t.uniformSub,
          t.note,
          t.bikeParking,
          t.bikeParkingCapacity,
          String(t.memberCount ?? ""),
          levelLabel(Number(t.level ?? 0)),
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    teams,
    appliedKeyword,
    appliedCategoryFilter,
    appliedPrefectureFilter,
    appliedCityFilter,
    appliedTownFilter,
    appliedStrengthFilter,
    appliedGroundFilter,
    appliedBikeFilter,
    appliedBikeCapacityMin,
    appliedMemberCountMin,
    appliedHasNoteOnly,
  ]);

  const createdTeam = useMemo(
    () => filteredTeams.find((t) => t.id === created),
    [filteredTeams, created]
  );

  const hasAppliedFilters = useMemo(() => {
    return !!(
      appliedKeyword ||
      appliedCategoryFilter.length > 0 ||
      appliedPrefectureFilter ||
      appliedCityFilter ||
      appliedTownFilter ||
      appliedStrengthFilter ||
      appliedGroundFilter !== "all" ||
      appliedBikeFilter !== "all" ||
      appliedBikeCapacityMin ||
      appliedMemberCountMin ||
      appliedHasNoteOnly
    );
  }, [
    appliedKeyword,
    appliedCategoryFilter,
    appliedPrefectureFilter,
    appliedCityFilter,
    appliedTownFilter,
    appliedStrengthFilter,
    appliedGroundFilter,
    appliedBikeFilter,
    appliedBikeCapacityMin,
    appliedMemberCountMin,
    appliedHasNoteOnly,
  ]);

  const appliedSummary = useMemo(() => {
    const parts: string[] = [];
    if (appliedKeyword) parts.push(`キーワード: ${appliedKeyword}`);
    if (appliedPrefectureFilter) parts.push(`都県: ${appliedPrefectureFilter}`);
    if (appliedCityFilter) parts.push(`市区町村: ${appliedCityFilter}`);
    if (appliedTownFilter) parts.push(`町名: ${appliedTownFilter}`);
    if (appliedCategoryFilter.length > 0) parts.push(`カテゴリ: ${appliedCategoryFilter.join(" / ")}`);
    if (appliedStrengthFilter) parts.push(`強さ: ${appliedStrengthFilter}`);
    if (appliedGroundFilter !== "all") parts.push(`グラウンド提供: ${appliedGroundFilter}`);
    if (appliedBikeFilter !== "all") parts.push(`駐輪場: ${appliedBikeFilter}`);
    if (appliedBikeCapacityMin) parts.push(`駐輪場台数: ${appliedBikeCapacityMin}台以上`);
    if (appliedMemberCountMin) parts.push(`チーム所属人数: ${appliedMemberCountMin}人以上`);
    if (appliedHasNoteOnly) parts.push("メモありのみ");
    return parts;
  }, [
    appliedKeyword,
    appliedPrefectureFilter,
    appliedCityFilter,
    appliedTownFilter,
    appliedCategoryFilter,
    appliedStrengthFilter,
    appliedGroundFilter,
    appliedBikeFilter,
    appliedBikeCapacityMin,
    appliedMemberCountMin,
    appliedHasNoteOnly,
  ]);

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
              ? toastError
              : toastInfo),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{toast.text}</div>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={toastClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      ) : null}

      <section style={heroBox}>
        <h1 style={heroTitle}>🔍 チーム検索</h1>
        <p style={heroDesc}>
          エリア、カテゴリ、強さ、グラウンド、駐輪場、人数などで絞り込めます。
        </p>
      </section>

      <section style={filterWrap}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span style={labelTitle}>キーワード検索</span>
            <input
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              className="sh-input"
              placeholder="例：三宿 / 青 / 強度高め / 20台 / SS"
              disabled={loading}
            />
          </label>

          <AreaPickerKanto
            title="エリアで絞り込み（関東）"
            allowAll={true}
            allLabel="関東（すべて）"
            disabled={loading}
            prefecture={draftPrefectureFilter}
            setPrefecture={setDraftPrefectureFilter}
            city={draftCityFilter}
            setCity={setDraftCityFilter}
            town={draftTownFilter}
            setTown={setDraftTownFilter}
            townOptional={true}
            useChipUI={true}
          />

          <CheckboxGroup
            title="カテゴリで絞り込み（複数）"
            options={CATEGORY_OPTIONS}
            values={draftCategoryFilter}
            onChange={setDraftCategoryFilter}
            columns={3}
            disabled={loading}
            useChipUI={true}
          />

          <div style={strengthSection}>
            <StrengthRankPicker
              value={draftStrengthFilter}
              onChange={setDraftStrengthFilter}
              disabled={loading}
              title="強さ"
              allowEmpty={true}
              emptyLabel="指定なし"
            />
          </div>

          <div style={twoCols}>
            <label style={label}>
              <span style={labelTitle}>グラウンド提供</span>
              <select
                value={draftGroundFilter}
                onChange={(e) => setDraftGroundFilter(e.target.value as "all" | "あり" | "なし")}
                className="sh-select"
                disabled={loading}
              >
                <option value="all">指定なし</option>
                <option value="あり">あり</option>
                <option value="なし">なし</option>
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>駐輪場</span>
              <select
                value={draftBikeFilter}
                onChange={(e) =>
                  setDraftBikeFilter(e.target.value as "all" | "あり" | "なし" | "不明")
                }
                className="sh-select"
                disabled={loading}
              >
                <option value="all">指定なし</option>
                <option value="あり">あり</option>
                <option value="なし">なし</option>
                <option value="不明">不明</option>
              </select>
            </label>
          </div>

          <div style={threeCols}>
            <label style={label}>
              <span style={labelTitle}>駐輪場台数（以上）</span>
              <select
                value={draftBikeCapacityMin}
                onChange={(e) => setDraftBikeCapacityMin(e.target.value)}
                className="sh-select"
                disabled={loading}
              >
                <option value="">指定なし</option>
                <option value="5">5台以上</option>
                <option value="10">10台以上</option>
                <option value="15">15台以上</option>
                <option value="20">20台以上</option>
                <option value="25">25台以上</option>
                <option value="30">30台以上</option>
                <option value="40">40台以上</option>
                <option value="50">50台以上</option>
              </select>
            </label>

            <label style={label}>
              <span style={labelTitle}>チーム所属人数（以上）</span>
              <select
                value={draftMemberCountMin}
                onChange={(e) => setDraftMemberCountMin(e.target.value)}
                className="sh-select"
                disabled={loading}
              >
                <option value="">指定なし</option>
                <option value="5">5人以上</option>
                <option value="10">10人以上</option>
                <option value="15">15人以上</option>
                <option value="20">20人以上</option>
                <option value="25">25人以上</option>
                <option value="30">30人以上</option>
              </select>
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={draftHasNoteOnly}
                onChange={(e) => setDraftHasNoteOnly(e.target.checked)}
                disabled={loading}
              />
              メモ入力があるチームのみ
            </label>
          </div>

          <div style={actionRow}>
            <button
              className="sh-btn sh-btn--primary"
              type="button"
              onClick={applyFilters}
              disabled={loading || !hasDraftChanges}
            >
              {loading ? "更新中…" : "この条件で検索"}
            </button>

            <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
              条件クリア
            </button>

            <button className="sh-btn" type="button" onClick={load} disabled={loading}>
              {loading ? "更新中…" : "再読み込み"}
            </button>

            <div style={{ color: "#666", fontSize: 12 }}>
              ヒット件数：{filteredTeams.length}
            </div>
          </div>

          {hasAppliedFilters ? (
            <div style={appliedBox}>
              <div style={appliedTitle}>現在の検索条件</div>
              <div style={appliedText}>{appliedSummary.join(" / ")}</div>
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>
              ※ 条件を入力して「この条件で検索」を押すと結果が更新されます
            </div>
          )}
        </div>
      </section>

      {created && createdTeam ? (
        <div style={{ ...miniInfo, marginTop: 12 }}>
          ✨ さっき登録したチーム： <b>{createdTeam.name}</b>（検索結果内でハイライト）
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#777", marginTop: 16 }}>読み込み中...</p>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {filteredTeams.length === 0 ? (
            <p style={{ color: "#777" }}>条件に一致するチームがありません。</p>
          ) : (
            filteredTeams.map((t) => {
              const isCreated = created && t.id === created;
              const rank =
                (t.strengthRank as StrengthRank | null) ?? levelLabel(Number(t.level ?? 0));
              const bikeText =
                t.bikeParking === "あり" && t.bikeParkingCapacity
                  ? `あり（${t.bikeParkingCapacity === "50+" ? "50台以上" : `${t.bikeParkingCapacity}台`}）`
                  : t.bikeParking;

              return (
                <div
                  key={t.id}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: isCreated ? "2px solid #86efac" : "1px solid #eee",
                    background: isCreated ? "#f0fdf4" : "#fafafa",
                    boxShadow: isCreated ? "0 0 0 4px rgba(34,197,94,0.10)" : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>
                        {t.name} {isCreated ? "✅" : ""}
                      </div>
                      <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
                        📍 {t.area}
                        <br />
                        🏷 {t.category} / 💪 強さ {rank} / 🏟 グラウンド{" "}
                        {t.hasGround ? "あり" : "なし"} / 🚲 {bikeText}
                        <br />
                        👥 チーム所属人数 {t.memberCount ?? 0}人
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <Link className="sh-btn" href={`/teams/${t.id}/edit`}>
                        編集
                      </Link>
                    </div>
                  </div>

                  <div style={infoGrid}>
                    <div style={infoBox}>
                      <div style={infoLabel}>ユニフォーム</div>
                      <div style={infoValue}>
                        {t.uniformMain}（メイン） / {t.uniformSub}（サブ）
                      </div>
                    </div>

                    <div style={infoBox}>
                      <div style={infoLabel}>希望枠</div>
                      <div style={infoValue}>{formatAvailability(t.desiredDates)}</div>
                    </div>

                    {t.note ? (
                      <div style={infoBox}>
                        <div style={infoLabel}>メモ</div>
                        <div style={infoValue}>{t.note}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 18,
  boxShadow: "0 10px 28px rgba(20,92,42,0.16)",
  marginBottom: 12,
};

const heroTitle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.3,
};

const heroDesc: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.7,
};

const miniInfo: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
  color: "#444",
};

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 12px",
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fafafa",
  minHeight: 48,
};

const strengthSection: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 12,
  overflow: "hidden",
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  alignItems: "start",
};

const threeCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  alignItems: "start",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const appliedBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fafafa",
  padding: "10px 12px",
};

const appliedTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const appliedText: React.CSSProperties = {
  fontSize: 13,
  color: "#444",
  lineHeight: 1.7,
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 12,
};

const infoBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fff",
  padding: "10px 12px",
};

const infoLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const infoValue: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
};

const toastBox: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 12,
};

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const toastError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};