import type { MetadataRoute } from "next";
import { supabase } from "@/app/lib/supabase";

const BASE_URL = "https://www.sakamatch.com";
const PAGE_SIZE = 1000;

// 1時間ごとにサイトマップを再生成する
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/selection`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
  ];

  const selectionRoutes: MetadataRoute.Sitemap = [];

  let from = 0;

  // selection_events_public を1000件ずつページングして全件取得
  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("selection_events_public")
      .select("id, updated_at, fetched_at")
      .range(from, to);

    if (error) {
      console.error("sitemap: selection_events_public fetch error", error);
      break;
    }

    const rows = (data ?? []) as {
      id: string;
      updated_at?: string | null;
      fetched_at?: string | null;
    }[];

    for (const row of rows) {
      selectionRoutes.push({
        url: `${BASE_URL}/selection/${row.id}`,
        lastModified: row.updated_at || row.fetched_at || undefined,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...staticRoutes, ...selectionRoutes];
}
