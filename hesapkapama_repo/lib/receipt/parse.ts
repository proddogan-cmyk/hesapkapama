import type { Category } from "@/lib/types";

export type ParsedReceipt = {
  brand?: string;
  amount?: number;
  category?: Category;
  plate?: string;
  dateMs?: number;
};

const BRAND_MAP: Array<{ key: string; brand: string; category: Category }> = [
  { key: "SHELL", brand: "Shell", category: "ULAŞIM" },
  { key: "OPET", brand: "Opet", category: "ULAŞIM" },
  { key: "BP", brand: "BP", category: "ULAŞIM" },
  { key: "PETROL OFISI", brand: "Petrol Ofisi", category: "ULAŞIM" },
  { key: "PO", brand: "Petrol Ofisi", category: "ULAŞIM" },
  { key: "TOTAL", brand: "TotalEnergies", category: "ULAŞIM" },
  { key: "MIGROS", brand: "Migros", category: "DİĞER" },
  { key: "CARREFOUR", brand: "CarrefourSA", category: "DİĞER" },
  { key: "A101", brand: "A101", category: "DİĞER" },
  { key: "BIM", brand: "BİM", category: "DİĞER" },
  { key: "ŞOK", brand: "Şok", category: "DİĞER" },
  { key: "SOK", brand: "Şok", category: "DİĞER" },
];

const TOTAL_KEYWORDS = [
  "TOPLAM",
  "GENEL TOPLAM",
  "TOPLAM TUTAR",
  "ÖDENECEK",
  "ODENECEK",
  "KREDI KARTI",
  "KREDİ KARTI",
];

const IGNORE_AMOUNT_HINTS = [
  "VERGI",
  "VERGİ",
  "DAIRESI",
  "DAİRESİ",
  "VKN",
  "TCKN",
  "IBAN",
  "BANKA",
  "FIS NO",
  "FİŞ NO",
  "FATURA",
  "NO:",
  "NO ",
];

export function parseReceiptText(raw: string): ParsedReceipt {
  const text = (raw || "").replace(/\r/g, "");
  const upper = text.toLocaleUpperCase("tr-TR");
  const lines = upper.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const out: ParsedReceipt = {};

  // Brand detection (prefer known brands)
  for (const b of BRAND_MAP) {
    if (upper.includes(b.key)) {
      out.brand = b.brand;
      out.category = b.category;
      break;
    }
  }

  // If looks like restaurant (contains "MASA" or "ADISYON" etc.)
  if (!out.category) {
    const restaurantHints = ["ADİSYON", "ADISYON", "MASA", "GARSON", "KAPALI", "SERVİS"];
    if (restaurantHints.some((h) => upper.includes(h))) out.category = "YEMEK";
  }

  // Plate detection: Turkish plate pattern
  const plateMatch = upper.match(/\b(0[1-9]|[1-7][0-9]|8[01])\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b/);
  if (plateMatch) out.plate = plateMatch[0].replace(/\s+/g, "");

  // Amount extraction: only from total-like lines; ignore suspicious lines
  const moneyRegex = /(?:₺|TL)?\s*(\d{1,3}(?:[\.\s]\d{3})*(?:[\,\.]\d{2})|\d+(?:[\,\.]\d{2}))/g;

  const candidateAmounts: number[] = [];

  for (const line of lines) {
    const hasTotalHint = TOTAL_KEYWORDS.some((k) => line.includes(k));
    if (!hasTotalHint) continue;

    if (IGNORE_AMOUNT_HINTS.some((h) => line.includes(h))) continue;

    let m;
    while ((m = moneyRegex.exec(line)) !== null) {
      const rawNum = m[1];
      const normalized = rawNum.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
      const val = Number(normalized);
      if (!Number.isFinite(val)) continue;

      // sanity (single receipt)
      if (val <= 0) continue;
      if (val > 500000) continue; // prevent absurd billion values
      candidateAmounts.push(val);
    }
  }

  // Fallback: if no total lines found, do NOT guess.
  if (candidateAmounts.length > 0) {
    // choose the maximum among total candidates
    out.amount = Math.max(...candidateAmounts);
  }

  // Date extraction (basic): dd.mm.yyyy and optional hh:mm
  const dateLine = lines.find((l) => /\b\d{2}[\.\-/]\d{2}[\.\-/]\d{4}\b/.test(l));
  if (dateLine) {
    const dm = dateLine.match(/(\d{2})[\.\-/](\d{2})[\.\-/](\d{4})(?:\s+(\d{2})[:\.](\d{2}))?/);
    if (dm) {
      const dd = Number(dm[1]), mm = Number(dm[2]), yyyy = Number(dm[3]);
      const hh = dm[4] ? Number(dm[4]) : 12;
      const mi = dm[5] ? Number(dm[5]) : 0;
      const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
      out.dateMs = d.getTime();
    }
  }

  // Brand location prefix (very light heuristic): if line contains BAYRAMPAŞA etc.
  if (out.brand) {
    const locLine = lines.find((l) => l.includes("BAYRAMPAŞA") || l.includes("BAYRAMPASA"));
    if (locLine) out.brand = `Bayrampaşa ${out.brand}`;
  }

  return out;
}
