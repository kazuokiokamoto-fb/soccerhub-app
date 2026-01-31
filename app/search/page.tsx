"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Team = {
  id: string;
  name: string;
  area: string;
  category: string; // "U-12" など
  level: number; // 1-10
  hasGround: boolean; // グラウンド提供できる
  bikeParking: string; // "あり" | "なし" | "不明" など
  note: string;
  updatedAt: string;
};

type Venue = {
  id: string;
  name: string;
  area: string;
  address?: string;
  hasParking: boolean; // 駐車場あり
  hasBikeParking: boolean; // 駐輪場あり
  note: string;
  updatedAt: string;
};

type MatchRow = {
  id: string;
  team: Team;
  venue: Venue;
  score: number;
  reasons: string[];
};

// ===== demo =====
const DEMO_TEAMS_20: Team[] = [
  {
    id: "t01",
    name: "三宿イーグルス",
    area: "世田谷・三宿",
    category: "U-12",
    level: 4,
    hasGround: false,
    bikeParking: "あり",
    note: "土曜午前が多い",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t02",
    name: "下北沢ユナイテッド",
    area: "世田谷・下北沢",
    category: "U-12",
    level: 5,
    hasGround: true,
    bikeParking: "あり",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t03",
    name: "駒沢ファイターズ",
    area: "世田谷・駒沢",
    category: "U-12",
    level: 6,
    hasGround: true,
    bikeParking: "なし",
    note: "公式戦多め",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t04",
    name: "目黒スターズ",
    area: "目黒",
    category: "U-12",
    level: 5,
    hasGround: false,
    bikeParking: "不明",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t05",
    name: "碑文谷キッズ",
    area: "目黒・碑文谷",
    category: "U-12",
    level: 3,
    hasGround: false,
    bikeParking: "あり",
    note: "初心者多め",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t06",
    name: "中野セントラル",
    area: "中野",
    category: "U-12",
    level: 7,
    hasGround: true,
    bikeParking: "あり",
    note: "強度高め",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t07",
    name: "杉並グリーン",
    area: "杉並",
    category: "U-12",
    level: 4,
    hasGround: false,
    bikeParking: "あり",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t08",
    name: "高円寺レッズ",
    area: "杉並・高円寺",
    category: "U-12",
    level: 5,
    hasGround: false,
    bikeParking: "なし",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t09",
    name: "渋谷ジュニオール",
    area: "渋谷",
    category: "U-12",
    level: 6,
    hasGround: true,
    bikeParking: "あり",
    note: "遠征OK",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t10",
    name: "恵比寿SC",
    area: "渋谷・恵比寿",
    category: "U-12",
    level: 5,
    hasGround: false,
    bikeParking: "不明",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t11",
    name: "自由が丘FC",
    area: "目黒・自由が丘",
    category: "U-12",
    level: 6,
    hasGround: true,
    bikeParking: "あり",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t12",
    name: "用賀ブルー",
    area: "世田谷・用賀",
    category: "U-12",
    level: 4,
    hasGround: false,
    bikeParking: "あり",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t13",
    name: "二子玉川SC",
    area: "世田谷・二子玉川",
    category: "U-12",
    level: 5,
    hasGround: true,
    bikeParking: "あり",
    note: "河川敷利用",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t14",
    name: "池尻ユース",
    area: "世田谷・池尻",
    category: "U-12",
    level: 3,
    hasGround: false,
    bikeParking: "なし",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t15",
    name: "大崎ジュニア",
    area: "品川・大崎",
    category: "U-12",
    level: 6,
    hasGround: true,
    bikeParking: "あり",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t16",
    name: "五反田キッカーズ",
    area: "品川・五反田",
    category: "U-12",
    level: 5,
    hasGround: false,
    bikeParking: "不明",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t17",
    name: "代々木スピリッツ",
    area: "渋谷・代々木",
    category: "U-12",
    level: 7,
    hasGround: true,
    bikeParking: "あり",
    note: "上位志向",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t18",
    name: "初台ジュニア",
    area: "渋谷・初台",
    category: "U-12",
    level: 4,
    hasGround: false,
    bikeParking: "あり",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t19",
    name: "新宿ウィングス",
    area: "新宿",
    category: "U-12",
    level: 6,
    hasGround: true,
    bikeParking: "なし",
    note: "",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t20",
    name: "四谷キッズ",
    area: "新宿・四谷",
    category: "U-12",
    level: 5,
    hasGround: false,
    bikeParking: "あり",
    note: "",
    updatedAt: new Date().toISOString(),
  },
];

const TEAM_KEY = "soccerhub:teams:v1";
const VENUE_KEY = "soccerhub:venues:v1";

// ===== storage helpers =====
function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

// ✅ 初回だけ demo を投入（型安全）
function safeLoadWithDemo<T>(key: string, demo: T): T {
  try {
    const raw = localStorage.getItem(key);

    // 初回（まだ何も入ってない）
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(demo));
      return demo;
    }

    const parsed = JSON.parse(raw);
    return (parsed ?? demo) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(demo));
    return demo;
  }
}

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function includesLoose(hay: string, needle: string) {
  const h = norm(hay);
  const n = norm(needle);
  if (!n) return true;
  return h.includes(n);
}

// おすすめ：初期スコアリング（後でいくらでも調整できる）
function scoreMatch(team: Team, venue: Venue) {
  const reasons: string[] = [];
  let score = 0;

  // 1) エリア一致（部分一致）
  if (team.area && venue.area) {
    if (includesLoose(venue.area, team.area) || includesLoose(team.area, venue.area)) {
      score += 3;
      reasons.push("エリア一致 +3");
    }
  }

  // 2) グラウンド提供できるチーム優先（あなたの方針）
  if (team.hasGround) {
    score += 2;
    reasons.push("グラウンド提供あり +2");
  }

  // 3) 駐輪場（チーム側が「あり」ならグラウンドも「あり」だと加点）
  const teamBikeYes = String(team.bikeParking || "").includes("あり");
  if (teamBikeYes && venue.hasBikeParking) {
    score += 1;
    reasons.push("駐輪場OK +1");
  }

  // 4) 駐車場（グラウンドにあるなら加点）
  if (venue.hasParking) {
    score += 1;
    reasons.push("駐車場あり +1");
  }

  return { score, reasons };
}

export default function SearchPage() {
  // ===== data =====
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  useEffect(() => {
    // チーム：初回だけデモ20件を自動投入（既に入ってる場合はそのまま）
    setTeams(safeLoadWithDemo<Team[]>(TEAM_KEY, DEMO_TEAMS_20));

    // グラウンド：今まで通り（デモなし）
    const v = safeLoad<any>(VENUE_KEY, []);
    setVenues(Array.isArray(v) ? (v as Venue[]) : []);
  }, []);

  // ===== filters =====
  const [qArea, setQArea] = useState("");
  const [qCategory, setQCategory] = useState("U-12");
  const [qLevel, setQLevel] = useState(5);
  const [qRange, setQRange] = useState(2);
  const [onlyGroundTeams, setOnlyGroundTeams] = useState(false);
  const [needBikeParking, setNeedBikeParking] = useState(false);
  const [needCarParking, setNeedCarParking] = useState(false);

  const filteredTeams = useMemo(() => {
    const area = qArea.trim().toLowerCase();
    return teams.filter((t) => {
      if (qCategory && t.category !== qCategory) return false;
      if (onlyGroundTeams && !t.hasGround) return false;
      if (needBikeParking && String(t.bikeParking || "").indexOf("あり") === -1) return false;

      if (area) {
        const hay = `${t.area} ${t.name}`.toLowerCase();
        if (!hay.includes(area)) return false;
      }

      // 強さは目安：スライダー中心±range
      if (typeof t.level === "number") {
        if (t.level < qLevel - qRange || t.level > qLevel + qRange) return false;
      }
      return true;
    });
  }, [teams, qArea, qCategory, qLevel, qRange, onlyGroundTeams, needBikeParking]);

  const filteredVenues = useMemo(() => {
    const area = qArea.trim().toLowerCase();
    return venues.filter((v) => {
      if (needBikeParking && !v.hasBikeParking) return false;
      if (needCarParking && !v.hasParking) return false;

      if (area) {
        const hay = `${v.area} ${v.name} ${v.address ?? ""}`.toLowerCase();
        if (!hay.includes(area)) return false;
      }
      return true;
    });
  }, [venues, qArea, needBikeParking, needCarParking]);

  // ===== matching =====
  const topMatches = useMemo(() => {
    if (filteredTeams.length === 0 || filteredVenues.length === 0) return [];

    const rows: MatchRow[] = [];
    for (const t of filteredTeams) {
      for (const v of filteredVenues) {
        const { score, reasons } = scoreMatch(t, v);
        rows.push({
          id: `${t.id}__${v.id}`,
          team: t,
          venue: v,
          score,
          reasons,
        });
      }
    }

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      // 同点なら「グラウンド提供あり」を上に
      if (a.team.hasGround !== b.team.hasGround) return a.team.hasGround ? -1 : 1;

      // さらに同点なら更新日時が新しい方
      const at = a.team.updatedAt || "";
      const bt = b.team.updatedAt || "";
      return bt.localeCompare(at);
    });

    return rows.slice(0, 10);
  }, [filteredTeams, filteredVenues]);

  // ===== UI =====
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>検索</h1>
      <p style={{ marginTop: 6, color: "#555" }}>
        まずは localStorage の「チーム」「グラウンド」を条件で絞り込みます（マッチングは下に表示）。
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <button style={btnSecondary}>トップへ</button>
        </Link>
        <Link href="/teams" style={{ textDecoration: "none" }}>
          <button style={btnSecondary}>チーム一覧</button>
        </Link>
        <Link href="/venues" style={{ textDecoration: "none" }}>
          <button style={btnSecondary}>グラウンド一覧</button>
        </Link>

        {/* ✅ 本番と同じ状況でテストするための“投入/初期化”ボタン */}
        <button
          style={btnSecondary}
          onClick={() => {
            localStorage.setItem(TEAM_KEY, JSON.stringify(DEMO_TEAMS_20));
            location.reload();
          }}
        >
          デモ20チーム投入
        </button>
        <button
          style={btnSecondary}
          onClick={() => {
            localStorage.removeItem(TEAM_KEY);
            localStorage.removeItem(VENUE_KEY);
            location.reload();
          }}
        >
          データ初期化
        </button>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={h2}>絞り込み</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span>エリア（部分一致）</span>
            <input
              value={qArea}
              onChange={(e) => setQArea(e.target.value)}
              placeholder="例：世田谷 / 三宿 / 目黒"
              style={input}
            />
          </label>

          <label style={label}>
            <span>カテゴリ</span>
            <select value={qCategory} onChange={(e) => setQCategory(e.target.value)} style={input}>
              <option value="U-12">U-12</option>
              <option value="U-15">U-15</option>
              <option value="社会人">社会人</option>
            </select>
          </label>

          <label style={label}>
            <span>
              強さ（中心）：{qLevel}　許容±{qRange}
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={qLevel}
              onChange={(e) => setQLevel(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>

          <label style={label}>
            <span>強さの許容幅（±）</span>
            <select value={qRange} onChange={(e) => setQRange(Number(e.target.value))} style={input}>
              <option value={0}>±0（完全一致）</option>
              <option value={1}>±1</option>
              <option value={2}>±2（おすすめ）</option>
              <option value={3}>±3</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={onlyGroundTeams}
                onChange={(e) => setOnlyGroundTeams(e.target.checked)}
              />
              グラウンド提供できるチームのみ
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={needBikeParking}
                onChange={(e) => setNeedBikeParking(e.target.checked)}
              />
              🚲 駐輪場あり必須
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={needCarParking}
                onChange={(e) => setNeedCarParking(e.target.checked)}
              />
              🚗 駐車場あり必須（グラウンド）
            </label>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <section style={card}>
          <h2 style={h2}>チーム候補（{filteredTeams.length}）</h2>
          {filteredTeams.length === 0 ? (
            <p style={{ color: "#777" }}>条件に合うチームがありません。</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredTeams.map((t) => (
                <div key={t.id} style={itemCard}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</div>
                  <div style={sub}>
                    {t.area} / {t.category} / 強さ {t.level}
                    {" / "}
                    グラウンド {t.hasGround ? "あり" : "なし"}
                    {" / "}
                    🚲 {t.bikeParking || "不明"}
                  </div>
                  {t.note ? <div style={{ marginTop: 6, color: "#555" }}>{t.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={h2}>グラウンド候補（{filteredVenues.length}）</h2>
          {filteredVenues.length === 0 ? (
            <p style={{ color: "#777" }}>条件に合うグラウンドがありません。</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredVenues.map((v) => (
                <div key={v.id} style={itemCard}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{v.name}</div>
                  <div style={sub}>
                    {v.area}
                    {v.address ? ` / ${v.address}` : ""}
                    {" / "}
                    🚗 {v.hasParking ? "あり" : "なし"}
                    {" / "}
                    🚲 {v.hasBikeParking ? "あり" : "なし"}
                  </div>
                  {v.note ? <div style={{ marginTop: 6, color: "#555" }}>{v.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ★追加：おすすめマッチング */}
      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={h2}>おすすめマッチング（上位10）</h2>
        <p style={{ marginTop: 8, color: "#666" }}>
          「チーム候補 × グラウンド候補」をスコアリングして並べています（ルールは後で調整します）。
        </p>

        {topMatches.length === 0 ? (
          <p style={{ color: "#777", margin: 0 }}>候補が足りないため、マッチングが作れません。</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {topMatches.map((m) => (
              <div key={m.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>
                    {m.team.name} × {m.venue.name}
                  </div>
                  <div style={{ fontWeight: 800 }}>Score: {m.score}</div>
                </div>

                <div style={{ marginTop: 6, color: "#555" }}>
                  <div>
                    👥 {m.team.area} / {m.team.category} / 強さ {m.team.level} / グラウンド{" "}
                    {m.team.hasGround ? "あり" : "なし"} / 🚲 {m.team.bikeParking || "不明"}
                  </div>
                  <div>
                    📍 {m.venue.area}
                    {m.venue.address ? ` / ${m.venue.address}` : ""} / 🚗 {m.venue.hasParking ? "あり" : "なし"} /
                    🚲 {m.venue.hasBikeParking ? "あり" : "なし"}
                  </div>
                </div>

                <div style={{ marginTop: 8, color: "#777", fontSize: 13 }}>
                  理由：{m.reasons.join(" / ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={h2}>次の段階</h2>
        <p style={{ margin: 0, color: "#555", lineHeight: 1.7 }}>
          次は「マッチング結果」から
          <br />
          - 日程候補の提案
          <br />
          - 連絡テンプレ（LINE/メール）
          <br />
          - グラウンド提供チーム優先ロジックの強化（距離/最寄駅/使用料など）
          <br />
          を足します。
        </p>
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

const h2: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  border: "1px solid #eee",
  borderRadius: 10,
  background: "#fafafa",
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const itemCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fafafa",
};

const sub: React.CSSProperties = {
  color: "#666",
  fontSize: 13,
  marginTop: 4,
  lineHeight: 1.6,
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};