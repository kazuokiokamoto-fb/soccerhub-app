import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const appId = process.env.YAHOO_APP_ID; // ← .env.local の YAHOO_APP_ID
    if (!appId) {
      return NextResponse.json(
        { error: "YAHOO_APP_ID is missing (check .env.local)" },
        { status: 500 }
      );
    }

    // Yahoo: FuriganaService V2 (JSON-RPC)
    const endpoint = `https://jlp.yahooapis.jp/FuriganaService/V2/furigana?appid=${encodeURIComponent(
      appId
    )}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "1",
        jsonrpc: "2.0",
        method: "jlp.furiganaservice.furigana",
        params: {
          q: text,
          grade: 1,
        },
      }),
    });

    const data = await res.json();

    // Yahooがエラー返した時も分かりやすくする
    if (!res.ok) {
      return NextResponse.json(
        { error: "Yahoo API error", status: res.status, data },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}