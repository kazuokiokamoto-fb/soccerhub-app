export function decodeHtml(s: string) {
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", `"`)
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

export function stripTags(html: string) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanText(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUrl(url: string, base?: string) {
  try {
    const u = new URL(url, base);
    u.hash = "";

    if (u.protocol !== "http:" && u.protocol !== "https:") return "";

    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("fbclid");

    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function sameHost(a: string, b: string) {
  return hostOf(a) === hostOf(b);
}

export function normalizeTeamName(name: string) {
  let t = cleanText(name);

  t = t
    .replace(/^順位\s*/g, "")
    .replace(/^\d+\s*/g, "")
    .replace(/^[①-⑳]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  t = t
    .replace(/\s+A$/i, "A")
    .replace(/\s+B$/i, "B")
    .replace(/\s+C$/i, "C")
    .replace(/\s+U-15$/i, "")
    .replace(/\s+U15$/i, "")
    .trim();

  return t;
}

export function normalizedKey(name: string) {
  return normalizeTeamName(name)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()【】\[\]・･.,，、。]/g, "")
    .trim();
}