export async function runOcr(
  imageDataUrl: string,
  onProgress?: (p: number, status: string) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");

  // Use CDN paths to avoid bundler/worker asset resolution issues in Next.js.
  const worker = await createWorker("tur", 1, {
    logger: (m: any) => {
      if (m?.progress != null && typeof m.progress === "number") {
        const pct = Math.round(m.progress * 100);
        onProgress?.(pct, String(m.status || "processing"));
      }
    },
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
  } as any);

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
    } as any);

    const res = await worker.recognize(imageDataUrl);
    return res?.data?.text ?? "";
  } finally {
    await worker.terminate();
  }
}
