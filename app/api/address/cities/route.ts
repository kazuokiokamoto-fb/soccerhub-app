import { NextRequest, NextResponse } from "next/server";

const collator = new Intl.Collator("ja", { sensitivity: "base" });

function normalizeJa(text: string) {
  return (text || "")
    .trim()
    .replace(/\s+/g, "")
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0x60));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const prefecture = (searchParams.get("prefecture") || "").trim();
    const qRaw = (searchParams.get("q") || "").trim();
    const q = normalizeJa(qRaw);

    if (!prefecture) {
      return NextResponse.json({ items: [] }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const url =
      `${supabaseUrl}/rest/v1/jp_municipalities` +
      `?prefecture=eq.${encodeURIComponent(prefecture)}` +
      `&select=prefecture,city,city_kana`;

    const res = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Supabase REST error: ${text}` },
        { status: 500 }
      );
    }

    const data = await res.json();

    const rows = (Array.isArray(data) ? data : [])
      .map((r: any) => ({
        prefecture: r.prefecture,
        city: r.city,
        cityKana: r.city_kana || "",
        cityNorm: normalizeJa(r.city || ""),
        cityKanaNorm: normalizeJa(r.city_kana || ""),
      }))
      .filter((r) => {
        if (!q) return true;
        return r.cityNorm.includes(q) || r.cityKanaNorm.includes(q);
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