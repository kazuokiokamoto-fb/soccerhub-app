import { NextResponse } from "next/server";
import { createUserClient } from "@/app/lib/server/routeSupabase";

export function jsonResult(result: { ok: false; status: number; error: string } | object) {
  if ("status" in result && "ok" in result && result.ok === false) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}

export async function authed() {
  const session = await createUserClient();
  if (!session) {
    return {
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}

export async function readBody(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function yearFrom(value: unknown): number | null {
  const year = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(year)) return null;
  return year;
}
