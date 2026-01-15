import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { consumeCreditsOrThrow, refundCredits } from "@/lib/server/fileDb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: true, route: "receipt/vision" });
}

function toNumberOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


function normalizeMerchantName(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  // Collapse spaces and remove common legal suffixes / corporate terms
  s = s.replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");

  // Remove pipes and trailing punctuation
  s = s.replace(/[\|•]+/g, " ").replace(/\s+/g, " ").trim();

  const stop = new Set([
    "LTD", "LTD.", "LTDŞTİ", "LTD.ŞTİ", "LTD. ŞTİ.", "ŞTİ", "ŞTİ.", "A.Ş", "A.Ş.", "AS",
    "SAN", "SAN.", "SANAYİ", "TİC", "TİC.", "TIC", "TIC.", "TİCARET", "DIŞ", "DIS", "DIŞTİC", "DİŞ",
    "VE", "İNŞ", "INŞ", "INS", "İNŞ.", "UR", "UR.", "TUR", "TUR.", "PAZ", "PAZ.", "HİZ", "HIZ", "GIDA",
    "OTOMOTİV", "PETROLÜ", "PETROLU", "PETROL", "ÜR", "ÜR.", "LTDŞ", "LIMITED"
  ]);

  const tokens = s.split(" ").filter(Boolean);

  // Keep meaningful tokens, drop corporate noise
  const cleaned: string[] = [];
  for (const t of tokens) {
    const tt = t.replace(/[\.,]/g, "");
    if (stop.has(tt)) continue;
    // Skip very short generic tokens
    if (tt.length <= 1) continue;
    cleaned.push(tt);
  }

  // Heuristic: prefer 2-3 tokens max
  const short = cleaned.slice(0, 3).join(" ").trim();
  // Title case
  return short
    .toLocaleLowerCase("tr-TR")
    .replace(/\b\p{L}/gu, (m) => m.toLocaleUpperCase("tr-TR"));
}

function buildShortDescription(extracted: any) {
  const merchant = extracted?.merchant ? normalizeMerchantName(extracted.merchant) : "";
  const plate = extracted?.plate ? String(extracted.plate).trim() : "";
  const type = extracted?.receiptType ? String(extracted.receiptType).trim() : "general";
  if (type === "fuel" || type === "taxi") {
    if (plate) return merchant ? `${merchant} | Plaka: ${plate}` : `Plaka: ${plate}`;
    return merchant;
  }
  return merchant;
}


export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  try {
    const body = await req.json().catch(() => null);
    const localUserId = String(body?.localUserId || '').trim();
    const userId = clerkUserId || (localUserId.startsWith('local_') ? localUserId : '');
    if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    let requestId = "";
    const imageDataUrl = String(body?.imageDataUrl || "").trim();

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ ok: false, error: "imageDataUrl gerekli." }, { status: 400 });
    }

requestId = String(body?.requestId || "").trim() || `receipt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

// 1 receipt = 1 credit
try {
  await consumeCreditsOrThrow({
    userId,
    kind: "receipt",
    amount: 1,
    referenceId: requestId,
    idempotencyKey: `consume_receipt_${userId}_${requestId}`,
  });
} catch (e: any) {
  if (e?.code === "insufficient_credits") {
    return NextResponse.json(
      { ok: false, error: "insufficient_credits", balance: e.balance, required: e.required },
      { status: 402 }
    );
  }
  return NextResponse.json({ ok: false, error: "credit_check_failed" }, { status: 500 });
}

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY .env.local içinde yok." }, { status: 500 });
    }

    const model = process.env.OPENAI_RECEIPT_MODEL || "gpt-4.1-mini";

    const schema = {
      type: "object",
      additionalProperties: true,
      properties: {
        category: { type: "string", description: "Kategori. Şunlardan biri: YEMEK, ULAŞIM, TAKSİ, İLETİŞİM, OFİS-KIRTASİYE, KONAKLAMA, MEKAN, SANAT, KOSTÜM, DİĞER, FİŞSİZ, AVANS" },
        amount: { type: "number", description: "Toplam tutar (sadece sayı)" },
        receiptNo: { type: "string", description: "Fiş no / belge no. Takside genelde 'Sıra No' buraya yazılmalı." },
        merchant: { type: "string", description: "İşletme/Firma adı. Takside damga/ünvan veya üstteki isim." },
        description: { type: "string", description: "Kısa açıklama. Genelde merchant. Taksi: 'İsim | Plaka: XX' gibi. Benzin: 'Shell | Plaka: XX' gibi." },
        plate: { type: "string", description: "Araç plakası varsa." },
        receiptType: { type: "string", description: "taxi | fuel | general" },
        sequenceNo: { type: "string", description: "Taksi fişlerindeki Sıra No (varsa). receiptNo alanına da yansıtılacak." },
        dateISO: { type: "string", description: "YYYY-MM-DD" },
        timeHHMM: { type: "string", description: "HH:MM 24h" },
        taxId: { type: "string" },
        confidence: { type: "number", description: "0-1 arası" },
        rawText: { type: "string", description: "kısa metin dökümü; satırları mümkünse koru" },
      },
    };

      const prompt = `Bu bir fiş/POS slip görseli. Sadece JSON döndür.

Zorunlu alanlar:
- category: şu listeden biri: YEMEK, ULAŞIM, TAKSİ, İLETİŞİM, OFİS-KIRTASİYE, KONAKLAMA, MEKAN, SANAT, KOSTÜM, DİĞER, FİŞSİZ, AVANS
- amount: TOPLAM tutar (sayı)
- receiptNo: belge/fiş no. Taksi fişinde varsa Sıra No buraya.
- merchant: işletme adı (taksi: damga/ünvan veya üstteki isim)
- receiptType: taxi | fuel | general
- plate: varsa plaka
- description: kısa açıklama; genel: merchant. fuel: \"merchant | Plaka: XX\". taxi: \"merchant | Plaka: XX\" (varsa)

Kurallar:
- Taxi: Sıra No varsa receiptNo'ya yaz.
- Fuel: plate varsa description mutlaka Plaka içersin.
- rawText: en fazla 400 karakter kısa döküm.
`; 
const payload = {
      model,
      temperature: 0,
      max_output_tokens: 380,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl, detail: "low" },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "receipt_extraction", schema, strict: false } },
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok) {
      try {
        if (requestId) {
          await refundCredits({ userId, kind: "receipt", amount: 1, referenceId: requestId, idempotencyKey: `refund_receipt_${userId}_${requestId}_${resp.status}` });
        }
      } catch {}
      const msg = json?.error?.message ? String(json.error.message) : `OpenAI HTTP ${resp.status}`;
      const status = resp.status === 429 ? 429 : 500;
      const ra = resp.headers.get("retry-after");
      const headers: Record<string, string> = {};
      if (ra) headers["retry-after"] = ra;
      return NextResponse.json({ ok: false, error: msg }, { status, headers });
    }

    let extracted: any = null;

    if (json?.output_text) {
      try {
        extracted = JSON.parse(String(json.output_text));
      } catch {
        extracted = { rawText: String(json.output_text) };
      }
    } else if (Array.isArray(json?.output)) {
      const msg = json.output.find((o: any) => o?.type === "message") || json.output[0];
      const content = msg?.content;
      const txt = Array.isArray(content) ? content.find((c: any) => c?.type === "output_text")?.text : null;
      if (txt) {
        try {
          extracted = JSON.parse(String(txt));
        } catch {
          extracted = { rawText: String(txt) };
        }
      }
    }

    if (!extracted || typeof extracted !== "object") extracted = {};

        if (extracted.amount != null) {
      const n = toNumberOrNull(extracted.amount);
      extracted.amount = n == null ? null : n;
    }
        if (extracted.vatTotal != null) {
      const n = toNumberOrNull(extracted.vatTotal);
      extracted.vatTotal = n == null ? null : n;
    }
    if (extracted.confidence != null) {
      const n = toNumberOrNull(extracted.confidence);
      extracted.confidence = n == null ? null : Math.max(0, Math.min(1, n));
    }

    
    // Normalize merchant/description to avoid long legal titles
    if (extracted?.merchant) {
      extracted.merchant = normalizeMerchantName(extracted.merchant);
    }
    // Always provide a short description (merchant + optional plate) for UI
    extracted.description = buildShortDescription(extracted) || String(extracted?.description || "").trim();

return NextResponse.json({ ok: true, extracted });
  } catch (e: any) {
    try {
      if (requestId) {
        await refundCredits({ userId, kind: "receipt", amount: 1, referenceId: requestId, idempotencyKey: `refund_receipt_${userId}_${requestId}_${Date.now()}` });
      }
    } catch {}

    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
