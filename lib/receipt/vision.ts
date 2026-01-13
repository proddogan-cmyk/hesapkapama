"use client";

type VisionResult = {
  ok: boolean;
  extracted?: any;
  error?: string;
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
  try {
    const res = await fetch("/api/receipt/vision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error ? String(data.error) : `HTTP ${res.status}` };
    }

    return { ok: true, extracted: data.extracted };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}
