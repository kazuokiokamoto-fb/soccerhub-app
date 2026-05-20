import { isPdfUrl } from "./url.ts";

const TIMEOUT_MS = 15000;

export async function fetchHtml(url: string) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SakaMatchBot/1.0; +https://www.sakamatch.com/)",
        accept:
          "text/html,application/xhtml+xml,application/xml,text/xml,application/pdf,*/*",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const finalUrl = res.url || url;

    if (contentType.includes("application/pdf") || isPdfUrl(finalUrl)) {
      const arrayBuffer = await res.arrayBuffer();

      return {
        status: res.status,
        html: "",
        contentType,
        finalUrl,
        pdfBuffer: arrayBuffer,
      };
    }

    const html = await res.text();

    return {
      status: res.status,
      html,
      contentType,
      finalUrl,
      pdfBuffer: null,
    };
  } catch {
    return {
      status: 0,
      html: "",
      contentType: "",
      finalUrl: url,
      pdfBuffer: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}