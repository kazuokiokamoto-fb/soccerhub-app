import { CRAWL_USER_AGENT } from "./crawlUrl.ts";

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

/** Longest matching path wins. An equally long Allow beats Disallow. */
export function robotsAllows(
  robotsTxt: string,
  target: URL,
  userAgent: string = CRAWL_USER_AGENT,
): boolean {
  const groups = parseGroups(robotsTxt);
  const specific = groups.filter(
    (group) =>
      group.agents.some((agent) => agent !== "*" && agentMatches(agent, userAgent)),
  );
  const chosen = specific.length > 0
    ? specific
    : groups.filter((group) => group.agents.includes("*"));
  const path = `${target.pathname}${target.search}` || "/";
  let winner: Rule | null = null;
  for (const group of chosen) {
    for (const rule of group.rules) {
      if (!rule.path) continue;
      if (!path.startsWith(rule.path)) continue;
      if (!winner || rule.path.length > winner.path.length) winner = rule;
      else if (rule.path.length === winner.path.length && rule.allow) winner = rule;
    }
  }
  if (!winner) return true;
  return winner.allow;
}
