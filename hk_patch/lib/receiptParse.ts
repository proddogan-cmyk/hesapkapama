import type { Category, ReceiptMeta } from "@/lib/types";

export type ParsedReceiptMeta = Omit<ReceiptMeta, "imageDataUrl">;

export type ParsedReceipt = {
  meta: ParsedReceiptMeta;
  amount?: number;
  category?: Category;
  merchantLabel?: string;
  note?: string;
  confidence: "high" | "medium" | "low";
};

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function toTitleCaseTR(s: string): string {
  const parts = normalizeSpaces(s).split(" ").filter(Boolean);
  return parts
    .map((p) => {
      const lower = p.toLocaleLowerCase("tr-TR");
      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join(" ");
}

function toNumberTR(raw: string): number | undefined {
  const cleaned = raw
    .replace(/₺/g, "")
    .replace(/TRY|TL/gi, "")
    .replace(/\s/g, "")
    .trim();
  if (!cleaned) return undefined;

  let normalized = cleaned;

  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = normalized.replace(/,/g, ".");
    const dots = (normalized.match(/\./g) ?? []).length;
    if (dots >= 2) normalized = normalized.replace(/\./g, "");
  }

  const v = Number(normalized);
  if (!Number.isFinite(v)) return undefined;
  return Math.round(v * 100) / 100;
}

function plausibilityAmount(v: number): boolean {
  if (!Number.isFinite(v) || v <= 0) return false;
  // free/browser OCR can hallucinate huge numbers; cap at realistic single-receipt totals
  if (v > 250_000) return false;
  return true;
}

// Words normalization for OCR confusions (for keyword matching only)
function normalizeForWords(upper: string): string {
  return upper
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/3/g, "E")
    .replace(/4/g, "A")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    .replace(/[“”‘’]/g, '"');
}

const EXCLUDE_AMOUNT_TOKENS = [
  "VERGI",
  "VERGİ",
  "DAIRESI",
  "DAİRESİ",
  "DAIRE",
  "DAİRE",
  "MALIYE",
  "MALİYE",
  "VKN",
  "TCKN",
  "MERSIS",
  "MERSİS",
  "IBAN",
  "HESAP",
  "BANKA",
  "POS",
  "TEL",
  "TELEFON",
  "FIS NO",
  "FİŞ NO",
  "FISNO",
  "FIŞNO",
  "KASA NO",
];

function isExcludedAmountLine(lineUpper: string): boolean {
  if (EXCLUDE_AMOUNT_TOKENS.some((k) => lineUpper.includes(k))) return true;

  // Exclude VAT-only lines unless they are also clearly totals
  const vatOnly =
    (lineUpper.includes("KDV") || lineUpper.includes("VAT")) &&
    !lineUpper.includes("GENEL TOPLAM") &&
    !lineUpper.includes("ÖDENECEK") &&
    !lineUpper.includes("ODENECEK") &&
    !/\bTOPLAM\b/.test(lineUpper);

  if (vatOnly) return true;

  return false;
}

function scoreTotalLine(upper: string): number {
  // Use normalized-for-words to tolerate OCR typos in keywords
  const u = normalizeForWords(upper);

  let score = 0;
  if (u.includes("GENEL TOPLAM")) score += 14;
  if (u.includes("ODENECEK") || u.includes("ÖDENECEK")) score += 14;
  if (/\bTOPLAM\b/.test(u)) score += 10;
  if (u.includes("TOPLAM TUTAR") || u.includes("GENEL TUTAR")) score += 10;
  if (/\bTUTAR\b/.test(u)) score += 3;

  if (upper.includes("₺") || upper.includes(" TL") || upper.includes(" TRY")) score += 2;

  // Penalize interim totals
  if (u.includes("ARA TOPLAM")) score -= 8;

  // Penalize VAT mention a bit
  if (u.includes("KDV") || u.includes("VAT")) score -= 4;

  return score;
}

function hasTotalHintStrict(line: string): boolean {
  const upper = ` ${line.toUpperCase()} `;
  const u = normalizeForWords(upper);

  // Accept common OCR variations of these words
  const reToplam = /\bT[O0]P[L1I][A4]M\b/; // TOPLAM with OCR confusions
  const reGenelToplam = /GENEL\s+T[O0]P[L1I][A4]M/;
  const reOdenecek = /(ÖDENECEK|ODENECEK|[O0]D[EI]N[EI]C[EI]K)/;
  const reToplamTutar = /(TOPLAM\s+TUTAR|GENEL\s+TUTAR|TUTAR\s+TOPLAM)/;

  return reGenelToplam.test(u) || reOdenecek.test(u) || reToplamTutar.test(u) || reToplam.test(u);
}

function pickTotalAmount(text: string): { amount?: number; confidence: "high" | "medium" | "low" } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => normalizeSpaces(l))
    .filter((l) => l.length >= 2);

  const moneyRe =
    /(?:₺\s*)?(\d{1,3}(?:[\.\s]\d{3})+(?:,\d{2})|\d{1,6}(?:,\d{2})|\d{1,6}(?:\.\d{2})|\d{1,6})/g;

  type Cand = { v: number; score: number; line: string };
  const cands: Cand[] = [];

  for (const line of lines) {
    const upper = ` ${line.toUpperCase()} `;
    if (isExcludedAmountLine(upper)) continue;

    // STRICT: only consider lines that look like totals/payables
    if (!hasTotalHintStrict(line)) continue;

    const matches = Array.from(line.matchAll(moneyRe));
    if (matches.length === 0) continue;

    // Prefer last money-like token on that line
    const last = matches[matches.length - 1];
    const raw = (last[1] ?? last[0] ?? "").toString();

    // Guard: ignore long plain integers (IDs)
    const digitCount = raw.replace(/\D/g, "").length;
    if (digitCount >= 8 && !/[\.,]/.test(raw)) continue;

    const v = toNumberTR(raw);
    if (v === undefined) continue;
    if (!plausibilityAmount(v)) continue;

    const score = scoreTotalLine(upper);
    if (score <= 0) continue;

    cands.push({ v, score, line });
  }

  if (cands.length === 0) return { amount: undefined, confidence: "low" };

  cands.sort((a, b) => b.score - a.score || b.v - a.v);
  const best = cands[0];

  const confidence: "high" | "medium" | "low" =
    best.score >= 14 ? "high" : best.score >= 10 ? "medium" : "low";

  // User requirement: if we are not confident, do NOT auto-fill amount
  if (confidence === "low") return { amount: undefined, confidence: "low" };

  return { amount: best.v, confidence };
}

function pickPlate(text: string): string | undefined {
  const upper = text.toUpperCase();
  const lines = upper.split(/\r?\n/).map((l) => normalizeSpaces(l));

  const plateRe = /\b([0-9O]{2})\s*([A-ZÇĞİÖŞÜ]{1,3})\s*([0-9O]{2,4})\b/;
  const normalizePlate = (p: string) =>
    p
      .replace(/\s+/g, " ")
      .replace(/O/g, "0")
      .trim();

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!/PLAKA|ARAÇ\s*PLAKA|ARAC\s*PLAKA/.test(l)) continue;

    const after = l.split(/PLAKA/)[1] ?? "";
    const m1 = (after + " ").match(plateRe);
    if (m1) return normalizePlate(`${m1[1]} ${m1[2]} ${m1[3]}`);

    const next = lines[i + 1] ?? "";
    const m2 = next.match(plateRe);
    if (m2) return normalizePlate(`${m2[1]} ${m2[2]} ${m2[3]}`);
  }

  const m = upper.match(/\b([0-9O]{2})\s*[A-ZÇĞİÖŞÜ]{1,3}\s*[0-9O]{2,4}\b/);
  return m ? normalizePlate(m[0]) : undefined;
}

function pickReceiptNo(text: string): string | undefined {
  const m = text.match(
    /(?:FİŞ\s*NO|FIS\s*NO|FİŞ\s*NO\.|FIS\s*NO\.|F\s*NO)\s*[:#-]?\s*([A-Z0-9-]{4,})/i
  );
  return m?.[1];
}

function pickDateISO(text: string): string | undefined {
  const m = text.match(/\b(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})\b/);
  if (!m) return undefined;
  let dd = Number(m[1]);
  let mm = Number(m[2]);
  let yy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return undefined;
  if (yy < 100) yy = 2000 + yy;
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yy < 2000 || yy > 2100) return undefined;
  const d = new Date();
  d.setFullYear(yy, mm - 1, dd);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

const KNOWN_BRANDS: Array<{ label: string; keywords: string[]; category?: Category }> = [
  { label: "Shell", keywords: ["SHELL"], category: "ULAŞIM" },
  { label: "Opet", keywords: ["OPET"], category: "ULAŞIM" },
  { label: "BP", keywords: [" BP ", "B.P", "BRITISH PETROLEUM"], category: "ULAŞIM" },
  { label: "TotalEnergies", keywords: ["TOTAL"], category: "ULAŞIM" },
  { label: "Petrol Ofisi", keywords: ["PETROL OFISI", "PETROL OFİSİ", "P.O"], category: "ULAŞIM" },
  { label: "Aytemiz", keywords: ["AYTEMIZ", "AYTEMİZ"], category: "ULAŞIM" },
  { label: "Migros", keywords: ["MIGROS", "MİGROS"], category: "DİĞER" },
  { label: "CarrefourSA", keywords: ["CARREFOUR"], category: "DİĞER" },
  { label: "A101", keywords: ["A101"], category: "DİĞER" },
  { label: "Şok", keywords: ["ŞOK", "SOK"], category: "DİĞER" },
];

function matchKnownBrand(textUpper: string): { label: string; category?: Category } | undefined {
  const u = normalizeForWords(` ${textUpper} `);
  for (const b of KNOWN_BRANDS) {
    if (b.keywords.some((k) => u.includes(normalizeForWords(k)))) return { label: b.label, category: b.category };
  }
  return undefined;
}

function pickDistrict(text: string): string | undefined {
  const u = text.toLocaleUpperCase("tr-TR");
  const m = u.match(/\b([A-ZÇĞİÖŞÜ]{3,})\s*(?:\/|-)\s*İSTANBUL\b/);
  if (m?.[1]) return toTitleCaseTR(m[1]);
  const m2 = u.match(/\b([A-ZÇĞİÖŞÜ]{3,})\s+İSTANBUL\b/);
  if (m2?.[1]) return toTitleCaseTR(m2[1]);
  return undefined;
}

function pickMerchantLabel(text: string): { merchant?: string; categoryHint?: Category } {
  const upper = text.toUpperCase();
  const known = matchKnownBrand(upper);
  if (known) {
    const district = pickDistrict(text);
    const merchant = district ? `${district} ${known.label}` : known.label;
    return { merchant, categoryHint: known.category };
  }

  // fallback: pick a line with high letter ratio, early in the text
  const lines = text
    .split(/\r?\n/)
    .map((l) => normalizeSpaces(l))
    .filter((l) => l.length >= 3)
    .slice(0, 14);

  const scored = lines
    .map((l) => {
      const letters = (l.match(/[A-ZÇĞİÖŞÜa-zçğıöşü]/g) ?? []).length;
      const digits = (l.match(/\d/g) ?? []).length;
      const ratio = letters / Math.max(1, letters + digits);
      return { l, letters, ratio };
    })
    .filter((x) => x.letters >= 4);

  scored.sort((a, b) => b.ratio - a.ratio || b.letters - a.letters);
  const best = scored[0]?.l;
  const merchant = best && scored[0].ratio >= 0.65 ? toTitleCaseTR(best).slice(0, 48) : undefined;
  return { merchant, categoryHint: undefined };
}

function inferCategory(text: string, merchant?: string, hint?: Category, plate?: string): Category | undefined {
  if (hint) return hint;
  const upper = normalizeForWords(text.toUpperCase());

  if (/(RESTORAN|RESTAURANT|LOKANTA|KAFE|CAFE|YEMEK|PIDE|KEBAP|DÖNER|DONER|BURGER|PIZZA|PİZZA)/i.test(upper)) return "YEMEK";
  if (/(AKARYAKIT|BENZIN|BENZİN|MOTORIN|MOTORİN|DIZEL|DİZEL|LPG|POMPA|OTO\s*GAZ|OTOGAZ)/i.test(upper)) return "ULAŞIM";
  if (/(TAKSI|TAKSİ|TAXI|UBER|BITAKSI|BİTAKSİ)/i.test(upper)) return "TAKSİ";
  if (/(TURKCELL|VODAFONE|TURK\s*TELEKOM|TÜRK\s*TELEKOM|TTNET|SUPERONLINE|SÜPERONLINE)/i.test(upper)) return "İLETİŞİM";
  if (/(OTEL|HOTEL|PANSIYON|KONAKLAMA)/i.test(upper)) return "KONAKLAMA";
  if (/(KIRTASIYE|KIRTASİYE|OFIS|OFİS|KARGO|ARAS|YURTICI|MNG|UPS|DHL)/i.test(upper)) return "OFİS-KIRTASİYE";
  if (/(BAR|MEYHANE|CLUB|KULUP|KULÜP)/i.test(upper)) return "MEKAN";
  if (/(KOSTUM|KOSTÜM)/i.test(upper)) return "KOSTÜM";
  if (/(SANAT|GALERI|GALERİ|MÜZE|MUZE)/i.test(upper)) return "SANAT";

  if (plate) return "ULAŞIM";

  if (merchant) {
    const mu = normalizeForWords(merchant.toUpperCase());
    if (/(SHELL|OPET|BP|PETROL|OFISI|OFİSİ|TOTAL|AYTEMIZ|AYTEMİZ)/i.test(mu)) return "ULAŞIM";
  }

  return undefined;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const { amount, confidence } = pickTotalAmount(text);
  const plate = pickPlate(text);
  const receiptNo = pickReceiptNo(text);
  const dateISO = pickDateISO(text);
  const { merchant, categoryHint } = pickMerchantLabel(text);
  const category = inferCategory(text, merchant, categoryHint, plate);

  const note = plate ? `Plaka: ${plate}` : undefined;

  const meta: ParsedReceiptMeta = {
    ocrText: text,
    merchant,
    receiptNo,
    plate,
    dateISO,
  };

  return {
    meta,
    amount,
    category,
    merchantLabel: merchant,
    note,
    confidence,
  };
}
