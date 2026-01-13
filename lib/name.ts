export function normalizeSpaces(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export function toTitleCaseTR(input: string): string {
  const s = normalizeSpaces(input);
  if (!s) return "";
  return s
    .split(" ")
    .map((w) => {
      const lower = w.toLocaleLowerCase("tr-TR");
      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join(" ");
}

export function nameKey(input: string): string {
  return normalizeSpaces(input).toLocaleLowerCase("tr-TR");
}

export function canonicalName(input: string): string {
  return toTitleCaseTR(input);
}
