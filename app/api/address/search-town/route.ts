import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TownRow = {
  prefecture: string;
  city: string;
  town: string;
  town_kana: string | null;
};

const collator = new Intl.Collator("ja", { sensitivity: "base" });

function normalizeJa(text: string) {
  return (text || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/　+/g, "")
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0x60));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const prefecture = (searchParams.get("prefecture") || "").trim();
    const city = (searchParams.get("city") || "").trim();
    const q = normalizeJa(searchParams.get("q") || "");

    const rawLimit = Number(searchParams.get("limit") || 20);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 300)
      : 20;

    if (!prefecture || !city) {
      return NextResponse.json(
        { error: "prefecture と city は必須です" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "supabase env missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from("jp_towns")
      .select("prefecture, city, town, town_kana")
      .eq("prefecture", prefecture)
      .eq("city", city)
      .limit(300);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const rows = ((data ?? []) as TownRow[])
      .map((r) => {
        const town = r.town ?? "";
        const townKana = r.town_kana ?? "";
        return {
          prefecture: r.prefecture,
          city: r.city,
          town,
          townKana,
          townNorm: normalizeJa(town),
          townKanaNorm: normalizeJa(townKana),
        };
      })
      .filter((r) => {
        if (!q) return true;
        return r.townNorm.includes(q) || r.townKanaNorm.includes(q);
      })
      .sort((a, b) => {
        const ak = a.townKanaNorm || a.townNorm || a.town;
        const bk = b.townKanaNorm || b.townNorm || b.town;
        const c1 = collator.compare(ak, bk);
        if (c1 !== 0) return c1;
        return collator.compare(a.town, b.town);
      })
      .slice(0, limit)
      .map((r) => ({
        prefecture: r.prefecture,
        city: r.city,
        town: r.town,
        townKana: r.townKana,
      }));

    return NextResponse.json({ items: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}