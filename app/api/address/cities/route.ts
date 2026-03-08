import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type MunicipalityRow = {
  prefecture: string;
  city: string;
  city_kana: string | null;
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

function jsonUtf8(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefecture = (searchParams.get("prefecture") || "").trim();
    const q = normalizeJa(searchParams.get("q") || "");

    if (!prefecture) {
      return jsonUtf8({ error: "prefecture は必須です" }, 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonUtf8({ error: "supabase env missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from("jp_municipalities")
      .select("prefecture, city, city_kana")
      .eq("prefecture", prefecture);

    if (error) {
      return jsonUtf8({ error: error.message }, 500);
    }

    const rows = ((data ?? []) as MunicipalityRow[])
      .map((r) => {
        const city = r.city ?? "";
        const cityKana = r.city_kana ?? "";
        return {
          prefecture: r.prefecture,
          city,
          cityKana,
          cityNorm: normalizeJa(city),
          cityKanaNorm: normalizeJa(cityKana),
        };
      })
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

    return jsonUtf8({ items: rows });
  } catch (e) {
    return jsonUtf8(
      { error: e instanceof Error ? e.message : "unknown error" },
      500
    );
  }
}