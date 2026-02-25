import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasYahooAppId: !!process.env.YAHOO_APP_ID,
    head: (process.env.YAHOO_APP_ID ?? "").slice(0, 6),
  });
}