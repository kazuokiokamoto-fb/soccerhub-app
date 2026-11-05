const PERSONAL_MARKERS = ["選手", "学年", "保護者", "氏名", "背番号", "父母", "児童", "生徒"];

export function normalizeTeamName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\u3000・･\-‐−ー_.,、。]/g, "");
}

export function containsPersonalMarker(value: string): boolean {
  return PERSONAL_MARKERS.some((marker) => value.includes(marker));
}

export function cleanTeamText(value: string, max: number): string | null {
  const trimmed = value.normalize("NFKC").replace(/[\u0000-\u001f]/g, "").trim();
  if (!trimmed || trimmed.length > max) return null;
  if (containsPersonalMarker(trimmed)) return null;
  return trimmed;
}
