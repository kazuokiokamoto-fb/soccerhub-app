import { NextResponse } from "next/server";

export async function GET() {
  const v = process.env.YAHOO_APP_ID || "";
  return NextResponse.json({
    hasYahooAppId: !!v,
    head: v ? v.slice(0, 6) : "",
  });
}