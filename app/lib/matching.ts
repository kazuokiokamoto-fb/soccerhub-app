import { MatchRow, Team } from "./types";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function areaClose(a: string, b: string) {
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return false;
  return A.includes(B) || B.includes(A);
}

export function buildTeamMatches(teams: Team[], targetDate: string): MatchRow[] {
  if (!targetDate) return [];

  const candidates = teams.filter((t) => (t.desiredDates || []).includes(targetDate));

  const rows: MatchRow[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];

      let score = 0;
      const reasons: string[] = [];

      // 同カテゴリ優先
      if (a.category === b.category) {
        score += 3;
        reasons.push("カテゴリ一致 +3");
      }

      // 強さ差が小さいほど加点
      const diff = Math.abs((a.level ?? 5) - (b.level ?? 5));
      const levelPoint = Math.max(0, 3 - diff); // diff 0=>+3, 1=>+2, 2=>+1, 3以上=>0
      score += levelPoint;
      reasons.push(`強さ差 ${diff} → +${levelPoint}`);

      // エリア近い
      if (areaClose(a.area, b.area)) {
        score += 2;
        reasons.push("エリア近い +2");
      }

      // グラウンド提供できるチームがいる（あなたの方針）
      if (a.hasGround || b.hasGround) {
        score += 2;
        reasons.push("グラウンド提供チームあり +2");
      }

      // ユニフォーム衝突回避（同じ色だと減点）
      if (norm(a.uniformMain) === norm(b.uniformMain)) {
        score -= 1;
        reasons.push("ユニ同色 -1");
      }

      rows.push({
        id: `${a.id}__${b.id}__${targetDate}`,
        teamA: a,
        teamB: b,
        date: targetDate,
        score,
        reasons,
      });
    }
  }

  rows.sort((x, y) => y.score - x.score);
  return rows;
}