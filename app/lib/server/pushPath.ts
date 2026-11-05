const MAX_PUSH_PATH_LENGTH = 500;

/** Keep notification clicks on this site. External and protocol-relative URLs become "/". */
export function safePushPath(input: unknown): string {
  if (typeof input !== "string") return "/";

  const url = input.trim();
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) {
    return "/";
  }
  if (url.includes("://") || url.includes("\\") || url.includes("\n") || url.includes("\r")) {
    return "/";
  }

  return url.slice(0, MAX_PUSH_PATH_LENGTH);
}
