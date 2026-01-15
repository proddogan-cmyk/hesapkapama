import type { Category, Transaction } from "@/lib/types";
import * as XLSX from "xlsx";

const SHEET_FOR_CATEGORY: Record<Category, string> = {
  YEMEK: "YEMEK",
  ULAŞIM: "ULAŞIM",
  "TAKSİ": "TAKSİ",
  "İLETİŞİM": "İLETİŞİM",
  "OFİS-KIRTASİYE": "OFİS-KIRTASİYE",
  KONAKLAMA: "KONAKLAMA",
  MEKAN: "MEKAN",
  SANAT: "SANAT",
  KOSTÜM: "KOSTÜM",
  DİĞER: "DİĞER",
  "FİŞSİZ": "FİŞSİZ",
  AVANS: "TOPLAM",
};

function fmtDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function findHeaderRow(rows: any[][]) {
  // find row that contains "Tarih" as a cell
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const row = rows[r] || [];
    const joined = row.map((c) => String(c ?? "").toLocaleUpperCase("tr-TR")).join(" | ");
    if (joined.includes("TARİH") || joined.includes("TARIH")) return r;
  }
  return 0;
}

export async function exportToTemplateXlsx(templateUrl: string, txs: Transaction[], filename: string) {
  const res = await fetch(templateUrl);
  const ab = await res.arrayBuffer();

  const wb = XLSX.read(ab, { type: "array" });

  const expenseTxs = txs.filter((t) => t.kind === "expense" && t.category !== "AVANS");
  const advanceOut = txs.filter((t) => t.subtype === "advance_out");
  const advanceIn = txs.filter((t) => t.subtype === "advance_in");

  // Write category sheets
  const categories: Category[] = ["YEMEK","ULAŞIM","TAKSİ","İLETİŞİM","OFİS-KIRTASİYE","KONAKLAMA","MEKAN","SANAT","KOSTÜM","DİĞER","FİŞSİZ"];
  for (const cat of categories) {
    const sheetName = SHEET_FOR_CATEGORY[cat];
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];
    const headerRow = findHeaderRow(rows);
    const startRow = headerRow + 1;

    const items = expenseTxs.filter((t) => t.category === cat).sort((a,b) => a.ts - b.ts);

    // write rows with a simple column map: A: Tarih, B: Tür, C: Kim, D: Kategori, E: Açıklama, F: Tutar
    let r = startRow;
    for (const t of items) {
      XLSX.utils.sheet_add_aoa(ws, [[
        fmtDate(t.ts),
        "Harcama",
        t.who,
        t.category,
        t.description,
        t.amount
      ]], { origin: { r, c: 0 } });
      r++;
    }
  }

  // VERİLEN AVANSLAR
  {
    const ws = wb.Sheets["VERİLEN AVANSLAR"];
    if (ws) {
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];
      const headerRow = findHeaderRow(rows);
      const startRow = headerRow + 1;
      const items = advanceOut.sort((a,b) => a.ts - b.ts);
      let r = startRow;
      for (const t of items) {
        XLSX.utils.sheet_add_aoa(ws, [[
          fmtDate(t.ts),
          "Avans",
          t.who,
          "AVANS",
          t.description,
          t.amount
        ]], { origin: { r, c: 0 } });
        r++;
      }
    }
  }

  // TOPLAM: append a small summary table at bottom (non-destructive)
  {
    const ws = wb.Sheets["TOPLAM"];
    if (ws) {
      const base = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];
      const r0 = Math.max(base.length + 2, 5);
      const totalIn = advanceIn.reduce((a,t)=>a+(t.amount||0),0) + txs.filter(t=>t.kind==="income" && t.subtype==="generic").reduce((a,t)=>a+(t.amount||0),0);
      const totalOut = txs.filter(t=>t.kind==="expense").reduce((a,t)=>a+(t.amount||0),0);
      const bal = totalIn - totalOut;

      XLSX.utils.sheet_add_aoa(ws, [
        ["", "", "", "", "", ""],
        ["ÖZET", "", "", "", "", ""],
        ["Toplam Giriş", totalIn, "", "Toplam Çıkış", totalOut, ""],
        ["Kalan Bakiye", bal, "", "", "", ""],
      ], { origin: { r: r0, c: 0 } });
    }
  }

  XLSX.writeFile(wb, filename, { compression: true });
}
