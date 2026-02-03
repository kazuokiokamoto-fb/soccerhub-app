// app/teams/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/app/lib/supabase";

// あなたの既存表示に合わせて GradeKey は固定で使う
type GradeKey = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";
const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];

type PageProps = { params: { id: string } };

// teams テーブルの最小型（必要カラムだけ）
type DbTeamRow = {
  id: string;
  owner_id: string;
  name: string;
  area: string | null;
  category: string | null;
  categories: string[] | null;
  level: number | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  roster_by_grade: Record<string, number> | null;
  desired_dates: string[] | null;
  note: string | null;
  updated_at: string | null;

  prefecture: string | null;
  city: string | null;
  town: string | null;
};

export default function TeamPage({ params }: PageProps) {
  const router = useRouter();
  const otherTeamId = params.id;

  const [meId, setMeId] = useState<string>("");

  const [team, setTeam] = useState<DbTeamRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errText, setErrText] = useState<string>("");

  // 自分のチーム（DM送信元として選択）
  const [myTeams, setMyTeams] = useState<DbTeamRow[]>([]);
  const [myTeamId, setMyTeamId] = useState<string>("");

  // 簡易編集（自分のチームだけ）
  const [name, setName] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const isOwner = useMemo(() => {
    return !!meId && !!team && team.owner_id === meId;
  }, [meId, team]);

  const rosterText = useMemo(() => {
    if (!team) return "";
    const r = team.roster_by_grade || {};
    return gradeKeys.map((g) => `${g}:${Number((r as any)[g] ?? 0)}`).join(" / ");
  }, [team]);

  const areaPretty = useMemo(() => {
    if (!team) return "";
    const p = (team.prefecture ?? "").trim();
    const c = (team.city ?? "").trim();
    const t = (team.town ?? "").trim();

    // DBの prefecture/city/town があれば優先して表示
    const fromParts = `${p} ${c}${t ? "・" + t : ""}`.trim();
    if (fromParts && fromParts !== "") return fromParts;

    // 互換の area
    return (team.area ?? "").trim();
  }, [team]);

  // ------- load auth + team + myTeams -------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrText("");

      // auth
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || "";
      setMeId(uid);

      // viewed team
      const { data: tRow, error: tErr } = await supabase
        .from("teams")
        .select(
          "id,owner_id,name,area,category,categories,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at,prefecture,city,town"
        )
        .eq("id", otherTeamId)
        .single();

      if (tErr) {
        setTeam(null);
        setErrText(`チーム読み込みに失敗: ${tErr.message}`);
        setLoading(false);
        return;
      }

      const teamRow = (tRow ?? null) as DbTeamRow | null;
      setTeam(teamRow);
      setName(teamRow?.name ?? "");

      // my teams（ログインしていれば）
      if (uid) {
        const { data: myRows, error: myErr } = await supabase
          .from("teams")
          .select("id,owner_id,name,area,category,categories,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at,prefecture,city,town")
          .eq("owner_id", uid)
          .order("updated_at", { ascending: false });

        if (!myErr) {
          const arr = (myRows ?? []) as DbTeamRow[];
          setMyTeams(arr);

          // デフォルト選択：先頭
          if (!myTeamId && arr[0]?.id) setMyTeamId(arr[0].id);
        }
      } else {
        setMyTeams([]);
        setMyTeamId("");
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherTeamId]);

  // ------- DM open -------
  const openDm = async (myTeamId_: string, otherTeamId_: string) => {
    const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
      my_team_id: myTeamId_,
      other_team_id: otherTeamId_,
    });
    if (error) throw error;
    return data as string; // threadId
  };

  const onClickChat = async () => {
    if (!meId) {
      alert("ログインが必要です");
      router.push("/login");
      return;
    }
    if (!team) return;

    if (!myTeamId) {
      alert("先に自分のチームを選んでください");
      return;
    }
    if (myTeamId === team.id) {
      alert("自分のチームにはチャットできません");
      return;
    }

    try {
      const threadId = await openDm(myTeamId, team.id);
      router.push(`/chat/${threadId}`);
    } catch (e: any) {
      console.error(e);
      alert(`チャット開始に失敗: ${e?.message || "unknown error"}`);
    }
  };

  // ------- save name (owner only) -------
  const saveName = async () => {
    if (!team) return;
    if (!isOwner) return;

    const nextName = name.trim();
    if (!nextName) return alert("チーム名が空です");

    setSaving(true);
    try {
      const { error } = await supabase.from("teams").update({ name: nextName }).eq("id", team.id);
      if (error) throw error;

      setTeam({ ...team, name: nextName, updated_at: new Date().toISOString() });
      alert("保存しました");
    } catch (e: any) {
      console.error(e);
      alert(`保存に失敗: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  // ------- render -------
  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>チーム詳細</h1>
        <p style={{ color: "#555", marginTop: 8 }}>読み込み中…</p>
      </main>
    );
  }

  if (!team) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>チームが見つかりません</h1>
        <p style={{ color: "#555", marginTop: 8 }}>ID: {otherTeamId}</p>
        {errText ? <p style={{ color: "#b91c1c" }}>{errText}</p> : null}
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
      <h1 style={{ margin: 0 }}>チーム詳細</h1>
      <p style={{ color: "#555", marginTop: 6 }}>
        {isOwner ? "（あなたのチーム）" : "（相手チーム）"} / DBの teams を表示します
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/teams" className="sh-btn">
          一覧へ
        </Link>
        <Link href="/" className="sh-btn">
          トップへ
        </Link>
        <Link href="/chat" className="sh-btn">
          チャット一覧
        </Link>
      </div>

      {/* 詳細カード */}
      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{team.name}</div>

        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          {areaPretty || "エリア未設定"} / {team.category || "カテゴリ未設定"} / 強さ {team.level ?? "未設定"}
        </div>

        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          グラウンド：{team.has_ground ? "あり" : "なし"} / 🚲 {team.bike_parking || "不明"}
        </div>

        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          ユニ：メイン {team.uniform_main || "不明"} / サブ {team.uniform_sub || "不明"}
        </div>

        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>人数：{rosterText || "未設定"}</div>

        <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
          希望日：{(team.desired_dates || []).join(", ") || "未登録"}
        </div>

        {team.note ? <div style={{ color: "#666", marginTop: 6 }}>メモ：{team.note}</div> : null}

        <div style={{ color: "#999", marginTop: 10, fontSize: 12 }}>更新：{team.updated_at || "—"}</div>
      </section>

      {/* ✅ 相手チームからチャット（導線②） */}
      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>💬 このチームに連絡（チャット）</h2>

        {!meId ? (
          <p style={{ marginTop: 10, color: "#666" }}>
            チャットするにはログインが必要です。{" "}
            <button className="sh-btn" type="button" onClick={() => router.push("/login")}>
              ログイン
            </button>
          </p>
        ) : isOwner ? (
          <p style={{ marginTop: 10, color: "#666" }}>自分のチームです（ここからはDMできません）</p>
        ) : myTeams.length === 0 ? (
          <p style={{ marginTop: 10, color: "#666" }}>
            先に自分のチームを作ってください。{" "}
            <Link href="/teams/new" className="sh-btn">
              チーム作成
            </Link>
          </p>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#555" }}>どのチームとして連絡しますか？</span>
              <select value={myTeamId} onChange={(e) => setMyTeamId(e.target.value)} style={input}>
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <button className="sh-btn" type="button" onClick={onClickChat}>
              💬 チャットを開く
            </button>

            <div style={{ fontSize: 12, color: "#777" }}>
              ※ このボタンは「チームA↔チームBの常設DM（1スレッド共有）」を開きます
            </div>
          </div>
        )}
      </section>

      {/* 自分のチームなら編集 */}
      {isOwner ? (
        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>（試し）チーム名だけ編集</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} disabled={saving} />
            <button className="sh-btn" onClick={saveName} type="button" disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </section>
      ) : null}
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