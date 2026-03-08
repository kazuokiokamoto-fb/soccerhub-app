import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefecture = searchParams.get("prefecture");
    const q = searchParams.get("q") ?? "";

    if (!prefecture) {
      return NextResponse.json({ items: [] });
    }

    let query = supabase
      .from("jp_municipalities")
      .select("prefecture, city, city_kana")
      .eq("prefecture", prefecture)
      .limit(300);

    if (q) {
      query = query.or(
        `city.ilike.%${q}%,city_kana.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      items: (data ?? []).map((r) => ({
        prefecture: r.prefecture,
        city: r.city,
        cityKana: r.city_kana,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}