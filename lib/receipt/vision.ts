"use client";

type VisionResult = {
  ok: boolean;
  extracted?: any;
  error?: string;
  status?: number;
  retryAfterMs?: number;
};

export async function resizeDataUrlForVision(dataUrl: string, maxSide = 1280, quality = 0.82): Promise<string> {
  try {
    if (!dataUrl.startsWith("data:image/")) return dataUrl;

    const img = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = dataUrl;
    });
    if (!loaded) return dataUrl;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return dataUrl;

    const scale = Math.min(1, maxSide / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, tw, th);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

export async function runVisionReceipt(imageDataUrl: string): Promise<VisionResult> {
  const maxRetries = 5;
  let attempt = 0;

  const localUserId = (() => {
    try {
      return window.localStorage.getItem("hk_local_user_id_v1") || "";
    } catch {
      return "";
    }
  })();

  while (true) {
    try {
      const requestId = `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const res = await fetch("/api/receipt/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl, localUserId, requestId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (res.status === 402 || data?.error === "insufficient_credits") {
          return { ok: false, error: "insufficient_credits", status: 402 };
        }
        const err = data?.error ? String(data.error) : `HTTP ${res.status}`;
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;

        attempt += 1;
        if (attempt > maxRetries) return { ok: false, error: err };

        // Exponential backoff with server hint
        const waitMs = Math.max(retryAfterMs, Math.min(8000, 600 * attempt));
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      return data as VisionResult;
    } catch (e: any) {
      attempt += 1;
      if (attempt > maxRetries) return { ok: false, error: e?.message || "Vision hatası" };
      await new Promise((r) => setTimeout(r, Math.min(8000, 600 * attempt)));
    }
  }
}


