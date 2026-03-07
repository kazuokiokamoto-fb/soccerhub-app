import { NextRequest, NextResponse } from "next/server";

const collator = new Intl.Collator("ja", { sensitivity: "base" });

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

    const url =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/jp_municipalities` +
      `?prefecture=eq.${encodeURIComponent(prefecture)}` +
      `&select=prefecture,city,city_kana`;

    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization:
          `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
    });

    const data = await res.json();

    const rows = (data ?? [])
      .map((r: any) => ({
        prefecture: r.prefecture,
        city: r.city,
        cityKana: r.city_kana || "",
        cityNorm: normalizeJa(r.city),
        cityKanaNorm: normalizeJa(r.city_kana || ""),
      }))
      .filter((r: any) => {
        if (!q) return true;
        return (
          r.cityNorm.includes(q) ||
          r.cityKanaNorm.includes(q)
        );
      })
      .sort((a: any, b: any) => {
        const ak = a.cityKanaNorm || a.cityNorm || a.city;
        const bk = b.cityKanaNorm || b.cityNorm || b.city;

        const c1 = collator.compare(ak, bk);
        if (c1 !== 0) return c1;

        return collator.compare(a.city, b.city);
      })
      .slice(0, 300)
      .map((r: any) => ({
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