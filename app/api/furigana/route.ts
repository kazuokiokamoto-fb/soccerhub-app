import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const appId = process.env.YAHOO_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: "YAHOO_APP_ID missing" }, { status: 500 });
    }

    const params = new URLSearchParams({
      appid: appId,
      sentence: text,
      output: "reading",
    });

    const res = await fetch(
      `https://jlp.yahooapis.jp/FuriganaService/V2/furigana`,
      {
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
      }
    );

    const data = await res.json();

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}