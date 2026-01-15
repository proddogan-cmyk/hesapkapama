import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { consumeCreditsOrThrow, refundCredits } from "@/lib/server/fileDb";
import { randomUUID } from "node:crypto";

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
  s = s.replace(/[\|â€¢]+/g, " ").replace(/\s+/g, " ").trim();

  const stop = new Set([
    "LTD", "LTD.", "LTDÅTÄ°", "LTD.ÅTÄ°", "LTD. ÅTÄ°.", "ÅTÄ°", "ÅTÄ°.", "A.Å", "A.Å.", "AS",
    "SAN", "SAN.", "SANAYÄ°", "TÄ°C", "TÄ°C.", "TIC", "TIC.", "TÄ°CARET", "DIÅ", "DIS", "DIÅTÄ°C", "DÄ°Å",
    "VE", "Ä°NÅ", "INÅ", "INS", "Ä°NÅ.", "UR", "UR.", "TUR", "TUR.", "PAZ", "PAZ.", "HÄ°Z", "HIZ", "GIDA",
    "OTOMOTÄ°V", "PETROLÃœ", "PETROLU", "PETROL", "ÃœR", "ÃœR.", "LTDÅ", "LIMITED"
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
  let userId: string | null = null;
  let requestId: string | null = null;
  const { userId: clerkUserId } = await auth();

  try {
    const body = await req.json().catch(() => null);
    const localUserId = String(body?.localUserId || '').trim();
    const userId = clerkUserId || (localUserId.startsWith('local_') ? localUserId : '');
    if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    requestId = "";
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
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY .env.local iÃ§inde yok." }, { status: 500 });
    }

    const model = process.env.OPENAI_RECEIPT_MODEL || "gpt-4.1-mini";

    const schema = {
      type: "object",
      additionalProperties: true,
      properties: {
        category: { type: "string", description: "Kategori. Åunlardan biri: YEMEK, ULAÅIM, TAKSÄ°, Ä°LETÄ°ÅÄ°M, OFÄ°S-KIRTASÄ°YE, KONAKLAMA, MEKAN, SANAT, KOSTÃœM, DÄ°ÄER, FÄ°ÅSÄ°Z, AVANS" },
        amount: { type: "number", description: "Toplam tutar (sadece sayÄ±)" },
        receiptNo: { type: "string", description: "FiÅŸ no / belge no. Takside genelde 'SÄ±ra No' buraya yazÄ±lmalÄ±." },
        merchant: { type: "string", description: "Ä°ÅŸletme/Firma adÄ±. Takside damga/Ã¼nvan veya Ã¼stteki isim." },
        description: { type: "string", description: "KÄ±sa aÃ§Ä±klama. Genelde merchant. Taksi: 'Ä°sim | Plaka: XX' gibi. Benzin: 'Shell | Plaka: XX' gibi." },
        plate: { type: "string", description: "AraÃ§ plakasÄ± varsa." },
        receiptType: { type: "string", description: "taxi | fuel | general" },
        sequenceNo: { type: "string", description: "Taksi fiÅŸlerindeki SÄ±ra No (varsa). receiptNo alanÄ±na da yansÄ±tÄ±lacak." },
        dateISO: { type: "string", description: "YYYY-MM-DD" },
        timeHHMM: { type: "string", description: "HH:MM 24h" },
        taxId: { type: "string" },
        confidence: { type: "number", description: "0-1 arasÄ±" },
        rawText: { type: "string", description: "kÄ±sa metin dÃ¶kÃ¼mÃ¼; satÄ±rlarÄ± mÃ¼mkÃ¼nse koru" },
      },
    };

      const prompt = `Bu bir fiÅŸ/POS slip gÃ¶rseli. Sadece JSON dÃ¶ndÃ¼r.

Zorunlu alanlar:
- category: ÅŸu listeden biri: YEMEK, ULAÅIM, TAKSÄ°, Ä°LETÄ°ÅÄ°M, OFÄ°S-KIRTASÄ°YE, KONAKLAMA, MEKAN, SANAT, KOSTÃœM, DÄ°ÄER, FÄ°ÅSÄ°Z, AVANS
- amount: TOPLAM tutar (sayÄ±)
- receiptNo: belge/fiÅŸ no. Taksi fiÅŸinde varsa SÄ±ra No buraya.
- merchant: iÅŸletme adÄ± (taksi: damga/Ã¼nvan veya Ã¼stteki isim)
- receiptType: taxi | fuel | general
- plate: varsa plaka
- description: kÄ±sa aÃ§Ä±klama; genel: merchant. fuel: \"merchant | Plaka: XX\". taxi: \"merchant | Plaka: XX\" (varsa)

Kurallar:
- Taxi: SÄ±ra No varsa receiptNo'ya yaz.
- Fuel: plate varsa description mutlaka Plaka iÃ§ersin.
- rawText: en fazla 400 karakter kÄ±sa dÃ¶kÃ¼m.
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
          await refundCredits({ userId: (userId ?? ""), kind: "receipt", amount: 1, referenceId: requestId, idempotencyKey: `refund_receipt_${userId}_${requestId}_${resp.status}` });
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
        await refundCredits({ userId: (userId ?? ""), kind: "receipt", amount: 1, referenceId: requestId, idempotencyKey: `refund_receipt_${userId}_${requestId}_${Date.now()}` });
      }
    } catch {}

    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatasÄ±." }, { status: 500 });
  }
}



