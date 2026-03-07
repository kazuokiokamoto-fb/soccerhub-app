import { NextRequest, NextResponse } from "next/server";
import kantoKana from "@/app/lib/kanto_municipalities_kana.json";

type KantoKanaRow = {
  pref: string;
  city: string;
  prefKana?: string;
  cityKana: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefecture = (searchParams.get("prefecture") || "").trim();
    const q = (searchParams.get("q") || "").trim();

    if (!prefecture) {
      return NextResponse.json(
        { error: "prefecture は必須です" },
        { status: 400 }
      );
    }

    const rows = (kantoKana as KantoKanaRow[])
      .filter((r) => r.pref === prefecture)
      .filter((r) => {
        if (!q) return true;
        return r.city.includes(q) || r.cityKana.includes(q);
      })
      .sort((a, b) => a.cityKana.localeCompare(b.cityKana, "ja"))
      .slice(0, 100)
      .map((r) => ({
        prefecture: r.pref,
        city: r.city,
        cityKana: r.cityKana,
      }));

    return NextResponse.json({ items: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}