function selectionSecretMatches(provided: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const actual = encoder.encode(provided);
  const wanted = encoder.encode(expected);
  const length = Math.max(actual.length, wanted.length);
  let diff = actual.length === wanted.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    diff |= (actual[i] ?? 0) ^ (wanted[i] ?? 0);
  }
  return diff === 0;
}

/** Returns a 401 response when x-selection-secret does not match SELECTION_SECRET. */
export function requireSelectionSecret(req: Request): Response | null {
  const expected = Deno.env.get("SELECTION_SECRET") ?? "";
  const provided = req.headers.get("x-selection-secret") ?? "";
  if (!expected || !selectionSecretMatches(provided, expected)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
