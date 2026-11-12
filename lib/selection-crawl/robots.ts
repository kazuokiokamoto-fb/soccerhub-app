export const SELECTION_CRAWL_USER_AGENT =
  "SakamatchSelectionBot/1.0 (+https://www.sakamatch.com/)";

type Rule = { allow: boolean; path: string };
type Group = { agents: string[]; rules: Rule[] };

function parseGroups(robotsTxt: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      current = null;
      continue;
    }
    const split = line.indexOf(":");
    if (split < 0) continue;
    const field = line.slice(0, split).trim().toLowerCase();
    const value = line.slice(split + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    if (field !== "allow" && field !== "disallow") continue;
    current.rules.push({ allow: field === "allow", path: value });
  }
  return groups;
}

function agentMatches(agent: string, userAgent: string): boolean {
  if (agent === "*") return true;
  return userAgent.toLowerCase().startsWith(agent);
}

/**
 * RFC 9309 path match. `*` is any sequence of characters. A final `$` anchors
 * the end of the path. Without `$` the pattern is a prefix. Matching is
 * case-sensitive and uses the URL path, not the query.
 */
export function robotsPathMatches(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const endAnchor = pattern.endsWith("$");
  const body = endAnchor ? pattern.slice(0, -1) : pattern;
  const parts = body.split("*");
  let index = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === "") {
      if (i === parts.length - 1) index = path.length;
      continue;
    }
    if (i === 0) {
      if (!path.startsWith(part)) return false;
      index = part.length;
      continue;
    }
    const found = path.indexOf(part, index);
    if (found < 0) return false;
    index = found + part.length;
  }
  if (endAnchor) return index === path.length;
  return true;
}

/** Longest matching path wins. An equally long Allow beats Disallow. */
export function robotsAllows(
  robotsTxt: string,
  target: URL,
  userAgent: string = SELECTION_CRAWL_USER_AGENT,
): boolean {
  const groups = parseGroups(robotsTxt);
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && agentMatches(agent, userAgent)),
  );
  const chosen = specific.length > 0
    ? specific
    : groups.filter((group) => group.agents.includes("*"));
  const path = target.pathname || "/";
  let winner: Rule | null = null;
  for (const group of chosen) {
    for (const rule of group.rules) {
      if (!robotsPathMatches(rule.path, path)) continue;
      if (!winner || rule.path.length > winner.path.length) winner = rule;
      else if (rule.path.length === winner.path.length && rule.allow) winner = rule;
    }
  }
  if (!winner) return true;
  return winner.allow;
}

export function robotsDecision(
  status: number,
  body: string,
  target: URL,
  userAgent: string = SELECTION_CRAWL_USER_AGENT,
): "allow" | "deny" | "unavailable" {
  if (status === 404 || status === 410) return "allow";
  if (status < 200 || status >= 300) return "unavailable";
  return robotsAllows(body, target, userAgent) ? "allow" : "deny";
}
