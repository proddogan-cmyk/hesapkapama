import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toNumberOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const imageDataUrl = String(body?.imageDataUrl || "").trim();

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ ok: false, error: "imageDataUrl gerekli." }, { status: 400 });
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
        merchant: { type: "string" },
        taxId: { type: "string" },
        receiptNo: { type: "string" },
        dateISO: { type: "string", description: "YYYY-MM-DD" },
        timeHHMM: { type: "string", description: "HH:MM 24h" },
        total: { type: "number" },
        currency: { type: "string" },
        vatTotal: { type: "number" },
        note: { type: "string" },
        confidence: { type: "number" },
        rawText: { type: "string" },
      },
    };

    const prompt =
      "Bu bir fiş / pos slip görseli. Şu alanları çıkar: merchant (firma adı), taxId (VKN/TCKN), receiptNo (fiş no), dateISO (YYYY-MM-DD), timeHHMM (HH:MM), total (toplam), currency (TRY vs), vatTotal (varsa KDV toplamı), note (kısa not), confidence (0-1). Eğer emin değilsen boş string veya null kullan. Ek olarak mümkünse rawText'e kısa bir metin dökümü koy.";

    const payload = {
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl },
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
      const msg = json?.error?.message ? String(json.error.message) : `OpenAI HTTP ${resp.status}`;
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
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

    if (extracted.total != null) {
      const n = toNumberOrNull(extracted.total);
      extracted.total = n == null ? null : n;
    }
    if (extracted.vatTotal != null) {
      const n = toNumberOrNull(extracted.vatTotal);
      extracted.vatTotal = n == null ? null : n;
    }
    if (extracted.confidence != null) {
      const n = toNumberOrNull(extracted.confidence);
      extracted.confidence = n == null ? null : Math.max(0, Math.min(1, n));
    }

    return NextResponse.json({ ok: true, extracted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
