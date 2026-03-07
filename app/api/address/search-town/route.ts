import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const prefecture = (searchParams.get("prefecture") || "").trim();
    const city = (searchParams.get("city") || "").trim();
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 20), 50);

    if (!prefecture || !city) {
      return NextResponse.json(
        { error: "prefecture と city は必須です" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("jp_towns")
      .select("prefecture, city, town, town_kana")
      .eq("prefecture", prefecture)
      .eq("city", city)
      .order("town_kana", { ascending: true })
      .limit(limit);

    if (q) {
      const q2 = q.replace(/\s+/g, "");
      query = query.or(`town.ilike.%${q2}%,town_kana.ilike.%${q2}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      items: (data || []).map((row) => ({
        prefecture: row.prefecture,
        city: row.city,
        town: row.town,
        townKana: row.town_kana,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}