const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchHtml(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        referer: new URL(url).origin + "/",
      },
    });

    if (!res.ok) {
      throw new Error(`fetch failed ${res.status}: ${url}`);
    }

    const contentType = res.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("text/plain") &&
      contentType !== ""
    ) {
      throw new Error(`not html: ${contentType}: ${url}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function canFetchUrl(url: string) {
  try {
    const u = new URL(url);

    if (u.protocol !== "http:" && u.protocol !== "https:") return false;

    const lower = u.toString().toLowerCase();

    const badExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".zip",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".mp4",
      ".mov",
      ".avi",
    ];

    return !badExtensions.some((ext) => lower.split("?")[0].endsWith(ext));
  } catch {
    return false;
  }
}