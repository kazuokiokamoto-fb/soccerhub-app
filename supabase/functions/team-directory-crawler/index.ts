// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_PAGES = 200;

const SEEDS = [
  "https://www.kanto-cy.com/",
  "https://tokyo-cy.jp/",
  "https://kanagawa-cy.com/",
  "https://saitama-cy.com/",
  "https://chiba-cy.com/",
  "https://ibaraki-cy.com/",
  "https://tochigi-cy.com/",
  "https://gunma-cy.com/",
];

function clean(text: string) {
  return String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function looksTeamName(text: string) {
  const t = clean(text);

  if (t.length < 3) return false;
  if (t.length > 60) return false;

  return (
    /FC/i.test(t) ||
    /SC/i.test(t) ||
    /U-?15/i.test(t) ||
    /JY/i.test(t) ||
    t.includes("サッカー") ||
    t.includes("フットボール") ||
    t.includes("クラブ") ||
    t.includes("ジュニアユース") ||
    t.includes("ユース") ||
    t.includes("アカデミー") ||
    t.includes("スクール")
  );
}

function inferCategory(name: string) {
  const t = name.toLowerCase();

  if (
    t.includes("school") ||
    name.includes("スクール") ||
    name.includes("アカデミー")
  ) {
    return "school";
  }

  if (
    name.includes("女子") ||
    name.includes("レディース")
  ) {
    return "ladies";
  }

  return "club_team";
}

function extractLinks(html: string, baseUrl: string) {
  const links: string[] = [];

  const re =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

  let match;

  while ((match = re.exec(html))) {
    try {
      const abs = new URL(match[1], baseUrl).toString();
      links.push(normalizeUrl(abs));
    } catch {}
  }

  return [...new Set(links)];
}

function extractTeamNames(html: string) {
  const teams = new Set<string>();

  const text = clean(html);

  const lines = text
    .split(/[|｜\/\n\r\t]/)
    .map((v) => clean(v))
    .filter(Boolean);

  for (const line of lines) {
    if (!looksTeamName(line)) continue;

    teams.add(line);
  }

  const re =
    /([A-Za-z0-9\- ]{2,40}(?:FC|SC|JY|Jr\.?ユース)|[^\s]{2,40}(?:FC|SC|サッカークラブ|ジュニアユース|ユース))/gi;

  let match;

  while ((match = re.exec(text))) {
    const name = clean(match[1]);

    if (looksTeamName(name)) {
      teams.add(name);
    }
  }

  return [...teams];
}

async function fetchHtml(url: string) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    10000,
  );

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 TeamDirectoryCrawler",
      },
    });

    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      html: await res.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async () => {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL")!;

  const serviceRole =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

  const supabase = createClient(
    supabaseUrl,
    serviceRole,
  );

  const queue = [...SEEDS];
  const visited = new Set<string>();

  let inserted = 0;
  let scanned = 0;

  while (
    queue.length &&
    scanned < MAX_PAGES
  ) {
    const url = queue.shift()!;

    if (visited.has(url)) continue;

    visited.add(url);
    scanned++;

    try {
      const page = await fetchHtml(url);

      if (!page.ok) continue;

      const teams = extractTeamNames(
        page.html,
      );

      for (const team of teams) {
        await supabase
          .from("team_directory")
          .upsert(
            {
              team_name: team,
              category:
                inferCategory(team),
              source_name:
                hostOf(url),
              source_url: url,
              status: "needs_url",
            },
            {
              onConflict:
                "team_name",
            },
          );

        inserted++;
      }

      const links = extractLinks(
        page.html,
        page.url,
      );

      for (const link of links) {
        if (
          hostOf(link) ===
          hostOf(page.url)
        ) {
          queue.push(link);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  return Response.json({
    ok: true,
    scanned,
    inserted,
    teamCountInserted:
      inserted,
  });
});