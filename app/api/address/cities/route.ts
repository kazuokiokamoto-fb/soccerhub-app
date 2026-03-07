import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const collator = new Intl.Collator("ja", { sensitivity: "base" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeJa(text: string) {
  return (text || "")
    .trim()
    .replace(/\s+/g, "")
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0x60)
    );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const prefecture = (searchParams.get("prefecture") || "").trim();
    const qRaw = (searchParams.get("q") || "").trim();
    const q = normalizeJa(qRaw);

    if (!prefecture) {
      return NextResponse.json(
        { error: "prefecture required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("jp_municipalities")
      .select("prefecture, city, city_kana")
      .eq("prefecture", prefecture);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? [])
      .map((r) => ({
        prefecture: r.prefecture,
        city: r.city,
        cityKana: r.city_kana || "",
        cityNorm: normalizeJa(r.city),
        cityKanaNorm: normalizeJa(r.city_kana || ""),
      }))
      .filter((r) => {
        if (!q) return true;
        return (
          r.cityNorm.includes(q) ||
          r.cityKanaNorm.includes(q)
        );
      })
      .sort((a, b) => {
        const ak = a.cityKanaNorm || a.cityNorm || a.city;
        const bk = b.cityKanaNorm || b.cityNorm || b.city;

        const c1 = collator.compare(ak, bk);
        if (c1 !== 0) return c1;

        return collator.compare(a.city, b.city);
      })
      .slice(0, 300)
      .map((r) => ({
        prefecture: r.prefecture,
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