import type { SupabaseClient } from "@supabase/supabase-js";
import { CRON_BATCH, dueForWeeklyCrawl } from "@/lib/standings/plan";
import { createServiceClient } from "@/app/lib/server/serviceSupabase";
import { crawlSavedPage, discoverResultsPage } from "@/app/lib/server/resultsDiscovery";

type PageRow = {
  team_id: string;
  url: string | null;
  status: string;
  last_crawled_at: string | null;
};

export async function runStandingsCron(service: SupabaseClient) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const due = await service
    .from("team_result_pages")
    .select("team_id,url,status,last_crawled_at")
    .in("status", ["found", "manual"])
    .not("url", "is", null)
    .or(`last_crawled_at.is.null,last_crawled_at.lt."${cutoff}"`)
    .order("last_crawled_at", { ascending: true })
    .limit(CRON_BATCH);
  if (due.error) {
    console.error("standings cron list skipped:", due.error.code ?? "read_failed");
    return { checked: 0, failed: 0, more: false };
  }

  let checked = 0;
  let failed = 0;
  for (const row of (due.data ?? []) as PageRow[]) {
    if (!row.url || !dueForWeeklyCrawl(row.last_crawled_at ? new Date(row.last_crawled_at) : null, new Date())) {
      continue;
    }
    checked += 1;
    try {
      const team = await service.from("teams").select("id,name").eq("id", row.team_id).maybeSingle();
      const affiliation = await service
        .from("team_affiliations")
        .select("category,status")
        .eq("team_id", row.team_id)
        .maybeSingle();
      const teamName = typeof team.data?.name === "string" ? team.data.name : "";
      const category =
        affiliation.data?.status === "affiliated" && typeof affiliation.data.category === "string"
          ? affiliation.data.category
          : null;
      const crawled = await crawlSavedPage({
        service,
        teamId: row.team_id,
        teamName,
        categoryHint: category,
        url: row.url,
      });
      if (!crawled.ok) failed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "standings crawl skipped:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    const stamped = await service
      .from("team_result_pages")
      .update({ last_crawled_at: new Date().toISOString() })
      .eq("team_id", row.team_id);
    if (stamped.error) {
      console.error("standings stamp skipped:", stamped.error.code ?? "write_failed");
    }
  }

  const searching = await service
    .from("team_result_pages")
    .select("team_id,updated_at")
    .eq("status", "searching")
    .limit(1);
  if (!searching.error) {
    for (const row of searching.data ?? []) {
      try {
        const affiliation = await service
          .from("team_affiliations")
          .select("status,prefecture,category,organization_name")
          .eq("team_id", row.team_id)
          .maybeSingle();
        const team = await service.from("teams").select("name").eq("id", row.team_id).maybeSingle();
        if (
          affiliation.data?.status !== "affiliated" ||
          typeof affiliation.data.prefecture !== "string" ||
          typeof affiliation.data.category !== "string" ||
          typeof affiliation.data.organization_name !== "string"
        ) {
          continue;
        }
        const choice = await discoverResultsPage({
          service,
          teamId: String(row.team_id),
          teamName: typeof team.data?.name === "string" ? team.data.name : "",
          prefecture: affiliation.data.prefecture,
          category: affiliation.data.category,
          organizationName: affiliation.data.organization_name,
        });
        await service
          .from("team_result_pages")
          .update({
            status: choice.status,
            confidence: choice.confidence,
            url: choice.url,
            suggested_url: choice.suggestedUrl,
            last_crawled_at: choice.status === "found" ? new Date().toISOString() : null,
          })
          .eq("team_id", row.team_id);
      } catch (error) {
        console.error(
          "standing discovery retry skipped:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
  }

  return { checked, failed, more: (due.data ?? []).length >= CRON_BATCH };
}

export function standingsService() {
  return createServiceClient();
}
