import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

function cleanText(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = cleanText(searchParams.get("teamId"));
    const category = cleanText(searchParams.get("category"));

    if (!teamId || !category) {
      return NextResponse.json(
        { summary: "", error: "teamId または category が不足しています" },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    if (!apiKey) {
      return NextResponse.json({
        summary:
          "Gemini APIキーが未設定のため、チーム情報をまだ取得できません。",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
あなたは日本の少年少女サッカーの対戦マッチングアプリ向けの補助AIです。
以下の条件で、一般公開情報から推測できる範囲のチーム紹介文を日本語で簡潔に作成してください。

【対象チームID】
${teamId}

【対象カテゴリ】
${category}

要件:
- 120〜220文字程度
- 断定しすぎず、確認できない情報は「可能性があります」「見られます」などの慎重表現にする
- 試合相手として知りたい観点を優先する
  - 活動カテゴリ
  - チームの雰囲気
  - 育成方針
  - 地域性
  - 対戦時に参考になりそうな特徴
- 個人情報は出さない
- 見つからない場合は「公開情報が少ないため、詳細は事前確認がおすすめです。」を自然に含める
- Markdownは使わず、プレーンテキストのみ
`.trim();

    const result = await model.generateContent(prompt);
    const text = cleanText(result.response.text());

    return NextResponse.json({
      summary:
        text || "公開情報が少ないため、詳細は事前確認がおすすめです。",
    });
  } catch (e) {
    console.error("[team-category-summary] error:", e);

    return NextResponse.json({
      summary: "チーム情報の取得に失敗しました。時間をおいて再度お試しください。",
    });
  }
}