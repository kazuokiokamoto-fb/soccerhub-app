import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PrefectureRow = {
  prefecture: string;
  prefecture_kana: string | null;
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
    const q = normalizeJa(searchParams.get("q") || "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "supabase env missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from("jp_prefectures")
      .select("prefecture, prefecture_kana");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = ((data ?? []) as PrefectureRow[])
      .map((r) => {
        const prefecture = r.prefecture ?? "";
        const prefectureKana = r.prefecture_kana ?? "";
        return {
          prefecture,
          prefectureKana,
          prefectureNorm: normalizeJa(prefecture),
          prefectureKanaNorm: normalizeJa(prefectureKana),
        };
      })
      .filter((r) => {
        if (!q) return true;
        return r.prefectureNorm.includes(q) || r.prefectureKanaNorm.includes(q);
      })
      .sort((a, b) => {
        const ak = a.prefectureKanaNorm || a.prefectureNorm || a.prefecture;
        const bk = b.prefectureKanaNorm || b.prefectureNorm || b.prefecture;
        const c1 = collator.compare(ak, bk);
        if (c1 !== 0) return c1;
        return collator.compare(a.prefecture, b.prefecture);
      })
      .map((r) => ({
        prefecture: r.prefecture,
        prefectureKana: r.prefectureKana,
      }));

    return NextResponse.json({ items: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}