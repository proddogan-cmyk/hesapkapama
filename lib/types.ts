export type BizType = "freelance" | "company";

export type Profile = {
  firstName: string;
  lastName: string;
  title: string;
  bizType: BizType;
  companyName?: string;
};

export type Category =
  | "YEMEK"
  | "ULAŞIM"
  | "TAKSİ"
  | "İLETİŞİM"
  | "OFİS-KIRTASİYE"
  | "KONAKLAMA"
  | "MEKAN"
  | "SANAT"
  | "KOSTÜM"
  | "DİĞER"
  | "FİŞSİZ"
  | "AVANS";

export type TxKind = "income" | "expense";
export type TxSubtype = "advance_in" | "advance_out" | "generic";

export type ReceiptMeta = {
  /** Base64 data URL (stored locally). */
  imageDataUrl?: string;
  /** Raw OCR output (optional; can be large). */
  ocrText?: string;

  /** Merchant / brand detected from receipt text (optional). */
  merchant?: string;
  /** Tax ID (VKN/TCKN) if detected (optional). */
  taxId?: string;
  /** Receipt number if detected (optional). */
  receiptNo?: string;
  /** License plate if detected (optional). */
  plate?: string;
  /** Receipt date ISO if detected (optional). */
  dateISO?: string;

  /** Category inferred from receipt text (optional). */
  inferredCategory?: Category;
  /** Confidence for parsed amount/category (optional). */
  confidence?: "high" | "medium" | "low";
  /** Raw AI extraction (optional). */
  ai?: { extracted?: unknown };
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
};

export type Transaction = {
  id: string;
  projectId: string;
  ts: number;
  kind: TxKind;
  subtype: TxSubtype;
  category: Category;
  who: string; // brand/person
  description: string;
  amount: number;
  receipt?: ReceiptMeta;
};

export type AppState = {
  profile?: Profile;
  projects: Project[];
  selectedProjectId?: string;
  transactions: Transaction[];
  nameTags: string[]; // canonical names for advance counterparties
};
