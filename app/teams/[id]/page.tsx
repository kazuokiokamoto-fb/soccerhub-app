"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { TEAM_KEY } from "../../lib/keys";
import { safeLoad, safeSave } from "../../lib/storage";
import { GradeKey, Team } from "../../lib/types";

type PageProps = { params: { id: string } };

const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];

export default function TeamMyPage({ params }: PageProps) {
  const id = params.id;

  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState<Team | null>(null);

  // 簡易編集用（名前だけ・後で増やせる）
  const [name, setName] = useState("");

  useEffect(() => {
    const t = safeLoad<Team[]>(TEAM_KEY, []);
    const arr = Array.isArray(t) ? t : [];
    setTeams(arr);

    const found = arr.find((x) => x.id === id) || null;
    setTeam(found);
    setName(found?.name ?? "");
  }, [id]);

  const rosterText = useMemo(() => {
    if (!team) return "";
    const r = team.rosterByGrade || ({} as any);
    return gradeKeys.map((g) => `${g}:${Number(r[g] ?? 0)}`).join(" / ");
  }, [team]);

  const saveName = () => {
    if (!team) return;
    const next = teams.map((t) =>
      t.id === team.id ? { ...t, name: name.trim(), updatedAt: new Date().toISOString() } : t
    );
    setTeams(next);
    safeSave(TEAM_KEY, next);
    setTeam({ ...team, name: name.trim(), updatedAt: new Date().toISOString() });
    alert("保存しました");
  };

  if (!team) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>チームが見つかりません</h1>
        <p style={{ color: "#555", marginTop: 8 }}>ID: {id}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <Link href="/teams" className="sh-btn">
            チーム一覧へ
          </Link>
          <Link href="/" className="sh-btn">
            トップへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>マイページ（チーム詳細）</h1>
      <p style={{ color: "#555", marginTop: 6 }}>localStorage のチームデータを表示・一部編集します。</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/teams" className="sh-btn">
          一覧へ
        </Link>
        <Link href="/" className="sh-btn">
          トップへ
        </Link>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{team.name}</div>
        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          {team.area} / {team.category} / 強さ {team.level}
        </div>
        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          グラウンド：{team.hasGround ? "あり" : "なし"} / 🚲 {team.bikeParking || "不明"}
        </div>
        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          ユニ：メイン {team.uniformMain} / サブ {team.uniformSub}
        </div>
        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>人数：{rosterText}</div>
        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          希望日：{(team.desiredDates || []).join(", ") || "未登録"}
        </div>
        {team.note ? <div style={{ color: "#666", marginTop: 6 }}>メモ：{team.note}</div> : null}
        <div style={{ color: "#999", marginTop: 10, fontSize: 12 }}>更新：{team.updatedAt}</div>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>（試し）チーム名だけ編集</h2>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <button className="sh-btn" onClick={saveName} type="button">
            保存
          </button>
        </div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};