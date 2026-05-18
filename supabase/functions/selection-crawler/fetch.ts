import { isPdfUrl } from "./url.ts";

export async function fetchHtml(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "SakaMatchBot/1.0 (+https://www.sakamatch.com/; public selection info crawler)",
      accept:
        "text/html,application/xhtml+xml,application/xml,text/xml,application/pdf",
    },
  });

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/pdf") || isPdfUrl(url)) {
    const arrayBuffer = await res.arrayBuffer();

    return {
      status: res.status,
      html: "",
      contentType,
      finalUrl: res.url || url,
      pdfBuffer: arrayBuffer,
    };
  }

  const html = await res.text();

  return {
    status: res.status,
    html,
    contentType,
    finalUrl: res.url || url,
    pdfBuffer: null,
  };
}