export function extractFuriganaText(yahooJson: any): string {
  const words = yahooJson?.result?.word;
  if (!Array.isArray(words)) return "";

  return words
    .map((w: any) => String(w?.furigana ?? w?.surface ?? ""))
    .join("");
}