import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import ExcelJS from "exceljs";

import type { Transaction, Category } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  fileName?: string;
  projectName?: string;
  profile?: { firstName?: string; lastName?: string };
  transactions?: Transaction[];
};

const TEMPLATE_RELATIVE_PATH = "public/templates/hesap-kapama-template.xlsx";

function cleanMerchantShort(s: string): string {
  // Keep a short human-friendly merchant label (avoid long legal titles).
  const raw = String(s || "").trim();
  if (!raw) return "";
  // take part before the first pipe
  const head = raw.split("|")[0].trim();
  let t = head
    .replace(/[()]/g, " ")
    .replace(/[.,;:_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const STOP = new Set([
    "UR",
    "TUR",
    "VE",
    "INŞ",
    "İNŞ",
    "INS",
    "SAN",
    "TIC",
    "TİC",
    "DIŞ",
    "DIS",
    "LTD",
    "ŞTİ",
    "STI",
    "AŞ",
    "AŞ.",
    "A.Ş",
    "ANONİM",
    "SIRKETI",
    "ŞİRKETİ",
    "LIMITED",
    "LIMITEDİ",
  ]);

  const words = t
    .toLocaleUpperCase("tr-TR")
    .split(" ")
    .filter(Boolean)
    .filter((w) => !STOP.has(w));

  // Prefer keeping BRAND + PETROL/ECZANE/LOKANTA style if present.
  const keyIdx = words.findIndex((w) => ["PETROL", "ECZANE", "LOKANTA", "MARKET", "OFİS", "OFIS"].includes(w));
  let keep: string[];
  if (keyIdx >= 1) keep = words.slice(0, Math.min(keyIdx + 1, 3));
  else keep = words.slice(0, 2);

  return keep.join(" ").trim();
}

function shortenDescription(desc: string): string {
  const s = String(desc || "").trim();
  if (!s) return "";
  const parts = s.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return s;
  const merchant = cleanMerchantShort(parts[0]);
  const platePart = parts.find((p) => p.toLocaleLowerCase("tr-TR").includes("plaka"));
  if (platePart) return `${merchant} | ${platePart}`;
  return merchant || s;
}

function formatMoneyCell(n: number) {
  // Keep as number; template cells already have money formats.
  const v = Number.isFinite(n) ? n : 0;
  return v;
}

function fillToplamAdvanceTable(wsToplam: ExcelJS.Worksheet, receivedAdv: Transaction[]) {
  // TOPLAM sheet has a fixed 5-row table: rows 28..32, columns A (Kimden) and B (Tutar).
  const grouped = new Map<string, number>();
  for (const t of receivedAdv) {
    const key = String(t.who || "Diğer").trim() || "Diğer";
    grouped.set(key, (grouped.get(key) || 0) + Number(t.amount || 0));
  }

  const items = Array.from(grouped.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);

  const MAX = 5;
  let rows = items;
  if (items.length > MAX) {
    const head = items.slice(0, MAX - 1);
    const restSum = items.slice(MAX - 1).reduce((acc, it) => acc + it.amount, 0);
    rows = [...head, { label: "Diğer", amount: restSum }];
  }

  for (let i = 0; i < 5; i++) {
    const r = 28 + i;
    const it = rows[i];
    wsToplam.getCell(`A${r}`).value = it ? it.label : "";
    wsToplam.getCell(`B${r}`).value = formatMoneyCell(it ? it.amount : 0);
  }
}

function toDateStr(ms: number) {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}.${mm}.${yy}`;
}

function toTimeStr(ms: number) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mn}`;
}

function sheetNameForCategory(category: Category): string {
  // Be tolerant: category values should already match template sheet names,
  // but defensive normalization prevents missing sheets -> missing totals/KDV.
  const raw = String(category || "").toLocaleUpperCase("tr-TR").trim();
  const key = raw
    .replace(/\s+/g, " ")
    .replace(/İ/g, "İ")
    .replace(/İ/g, "İ");

  const map: Record<string, string> = {
    "YEMEK": "YEMEK",
    "ULAŞIM": "ULAŞIM",
    "TAKSI": "TAKSİ",
    "TAKSİ": "TAKSİ",
    "ILETISIM": "İLETİŞİM",
    "İLETİŞİM": "İLETİŞİM",
    "OFIS KIRTASIYE": "OFİS-KIRTASİYE",
    "OFİS KIRTASİYE": "OFİS-KIRTASİYE",
    "OFİS-KIRTASİYE": "OFİS-KIRTASİYE",
    "KONAKLAMA": "KONAKLAMA",
    "MEKAN": "MEKAN",
    "SANAT": "SANAT",
    "KOSTÜM": "KOSTÜM",
    "DIGER": "DİĞER",
    "DİĞER": "DİĞER",
    "FİŞSİZ": "FİŞSİZ",
    "AVANS": "AVANS",
  };

  const normalized = key
    .replace(/\./g, "")
    .replace(/\-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return map[normalized] || category;
}



function findHeaderRow(worksheet: ExcelJS.Worksheet): number {
  // Locate the table header by scanning the first ~140 rows for a row that contains
  // either "GÜN" (template) or "TARİH", and also "FİŞ" or "TOPLAM/TUTAR".
  const maxScan = Math.min(worksheet.rowCount || 140, 140);
  for (let r = 1; r <= maxScan; r++) {
    const row = worksheet.getRow(r);
    const vals = (row.values as any[]).slice(1);
    const text = vals.map((v) => String(v ?? "").toLocaleLowerCase("tr-TR")).join(" | ");
    const hasDay = text.includes("gün") || text.includes("gun") || text.includes("tarih");
    const hasDoc = text.includes("fiş") || text.includes("fis") || text.includes("sıra") || text.includes("sira");
    const hasAmt = text.includes("toplam") || text.includes("tutar");
    if (hasDay && (hasDoc || hasAmt)) return r;
  }
  // Fallback: our template uses row 6 as header in category sheets
  return 6;
}


function copyRowStyle(src: ExcelJS.Row, dst: ExcelJS.Row) {
  // Copy row geometry + styles, and also copy *formula cells* so KDV/NET/TOPLAM computations keep working
  dst.height = src.height;
  dst.hidden = src.hidden;
  dst.outlineLevel = src.outlineLevel;
  dst.style = { ...src.style };

  src.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const d = dst.getCell(colNumber);

    // style
    d.style = { ...cell.style };
    d.numFmt = cell.numFmt;
    d.font = cell.font;
    d.alignment = cell.alignment;
    d.border = cell.border;
    d.fill = cell.fill;

    // preserve formulas from template rows
    const v: any = (cell as any).value;
    if (v && typeof v === "object" && typeof v.formula === "string") {
      d.value = { formula: v.formula, result: undefined as any };
    } else if (typeof v === "string" && v.startsWith("=")) {
      d.value = { formula: v.slice(1), result: undefined as any };
    }
  });
}



function normalizeHeader(v: any): string {
  const s = String(v ?? "").toLocaleUpperCase("tr-TR").trim();
  return s.replace(/\s+/g, " ");
}

function getColumnMap(worksheet: ExcelJS.Worksheet, headerRowIdx: number) {
  const row = worksheet.getRow(headerRowIdx);
  const vals = (row.values as any[]).slice(1);
  const map: Record<string, number> = {};
  for (let c = 1; c <= vals.length; c++) {
    const h = normalizeHeader(vals[c - 1]);
    if (!h) continue;
    // Date / day
    if (h.includes("GÜN") || h.includes("GUN") || h.includes("TARİH") || h.includes("TARIH")) map.date = c;
    // Receipt / document no
    if ((h.includes("FİŞ") || h.includes("FIS") || h.includes("SIRA")) && h.includes("NO")) map.receiptNo = c;
    // Amount
    // IMPORTANT: Some sheets include columns like "NET TUTAR" or "KDV SİZ TUTAR".
    // We must write the receipt TOTAL into the "TOPLAM" column (so TOPLAM tab formulas work),
    // and avoid accidentally mapping into "NET TUTAR".
    if (h === "TOPLAM" || h.includes("TOPLAM")) {
      // Prefer TOPLAM over any other inferred amount columns.
      map.amount = c;
    }
    // Description
    if (h.includes("AÇIKLAMA") || h.includes("ACIKLAMA")) map.desc = c;
  }
  return map;
}

function writeRows(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  rows: Array<{ date: string; receiptNo: string; amount: number; desc: string }>
) {
  // Fill the pre-formatted rows; append new rows only if needed.
  const headerRowIdx = startRow - 1;
  const colMap = getColumnMap(worksheet, headerRowIdx);

  const templateRowIdx = Math.min(worksheet.rowCount, startRow + 1);
  const templateRow = worksheet.getRow(templateRowIdx);

  let r = startRow;
  for (const item of rows) {
    let row = worksheet.getRow(r);
    if (r > worksheet.rowCount) {
      worksheet.addRow([]);
      row = worksheet.getRow(r);
      copyRowStyle(templateRow, row);
    }

    const dateCol = colMap.date || 1;
    const recCol = colMap.receiptNo; // optional (some sheets don't have it)
    const amtCol = colMap.amount || 3;
    const descCol = colMap.desc || 4;

    // Only set the intended cells; do not touch formula columns (KDV/NET etc).
    row.getCell(dateCol).value = item.date;
    if (recCol) row.getCell(recCol).value = item.receiptNo || "";
    row.getCell(amtCol).value = item.amount;
    row.getCell(descCol).value = item.desc || "";

    row.commit();
    r += 1;
  }
}


export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const transactions = Array.isArray(body?.transactions) ? body!.transactions : [];
    const fileName = String(body?.fileName || "HesapKapama.xlsx").replace(/[\\/\n\r\t]/g, "_");

    const templatePath = path.join(process.cwd(), TEMPLATE_RELATIVE_PATH);
    const buf = await fs.readFile(templatePath);

    const wb = new ExcelJS.Workbook();
    // Preserve as much template fidelity as possible
    wb.calcProperties.fullCalcOnLoad = true;
    await wb.xlsx.load(buf);

    
    // Fill TOPLAM sheet header fields without breaking template structure
    const wsToplam = wb.getWorksheet("TOPLAM");
    if (wsToplam) {
      const proj = String(body?.projectName || "").trim();
      if (proj) wsToplam.getCell("B3").value = proj;
      wsToplam.getCell("B4").value = toDateStr(Date.now());
      const fn = String(body?.profile?.firstName || "").trim();
      const ln = String(body?.profile?.lastName || "").trim();
      if (fn) wsToplam.getCell("B6").value = fn;
      if (ln) wsToplam.getCell("B7").value = ln;
    }

const expense = transactions.filter((t) => t.kind === "expense");
    const income = transactions.filter((t) => t.kind === "income");

    // Fill TOPLAM sheet "ALINAN AVANSLAR" table (A28:B32) using our data.
    
    // Fill TOPLAM sheet "ALINAN AVANSLAR" table starting at A28:B?? (auto-expands if >5 rows).
    if (wsToplam) {
      const receivedAdv = income.filter((t) => t.subtype === "advance_in");
      const byWho = new Map<string, number>();
      for (const t of receivedAdv) {
        const who = String((t as any).who || "").trim() || "Diğer";
        byWho.set(who, (byWho.get(who) || 0) + Number((t as any).amount || 0));
      }

      let rows = Array.from(byWho.entries())
        .map(([who, amt]) => ({ who, amt }))
        .filter((x) => x.amt !== 0)
        .sort((a, b) => b.amt - a.amt);

      const BASE = 5; // template has 5 visible lines (rows 28..32)
      const startRow = 28;
      const templateLastDetailRow = startRow + BASE - 1; // 32
      const templateTotalRow = 33; // "ALINAN AVNASLAR TOPLAMI"

      // If more than BASE entries, insert rows before the total row and extend formulas below.
      const extra = Math.max(0, rows.length - BASE);
      if (extra > 0) {
        // Insert extra rows at templateTotalRow (pushes total row + everything below downward)
        for (let i = 0; i < extra; i++) wsToplam.insertRow(templateTotalRow, []);

        // Copy style/borders from the last template detail row (32) into inserted rows
        const srcRow = wsToplam.getRow(templateLastDetailRow);
        for (let r = templateLastDetailRow + 1; r <= templateLastDetailRow + extra; r++) {
          const dstRow = wsToplam.getRow(r);
          dstRow.height = srcRow.height;
          for (const col of [1, 2]) {
            const srcCell = srcRow.getCell(col);
            const dstCell = dstRow.getCell(col);
            dstCell.style = { ...srcCell.style };
            dstCell.numFmt = srcCell.numFmt;
            dstCell.border = srcCell.border;
            dstCell.alignment = srcCell.alignment;
            dstCell.font = srcCell.font;
            dstCell.fill = srcCell.fill;
          }
        }

        const receivedTotalRow = templateTotalRow + extra;
        const givenTotalRow = 36 + extra;
        const kalanAvansRow = 38 + extra;
        const harcananRow = 41 + extra;

        // Update received advances total (B{receivedTotalRow}) to sum the expanded range.
        wsToplam.getCell(`B${receivedTotalRow}`).value = { formula: `SUM(B${startRow}:B${templateLastDetailRow + extra})` };

        // Ensure downstream formulas reference the moved rows.
        wsToplam.getCell(`B${kalanAvansRow}`).value = { formula: `(B${receivedTotalRow}-B${givenTotalRow})` };
        wsToplam.getCell(`A${harcananRow}`).value = { formula: `SUM(B21,B${givenTotalRow})` };
        wsToplam.getCell(`B${harcananRow}`).value = { formula: `(B${receivedTotalRow}-A${harcananRow})` };
      }

      // Write the rows into A{startRow}.. and clear any remaining template lines if fewer.
      const totalDetailRows = Math.max(BASE, rows.length);
      for (let i = 0; i < totalDetailRows; i++) {
        const r = startRow + i;
        const it = rows[i];
        wsToplam.getCell(`A${r}`).value = it ? it.who : "";
        wsToplam.getCell(`B${r}`).value = formatMoneyCell(it ? it.amt : 0);
      }
    }


    // Map expenses by category
    const byCat = new Map<string, Transaction[]>();
    for (const t of expense) {
      // Advances are written into their dedicated sheets so we do not double-write into AVANS.
      if (t.subtype === "advance_out") continue;
      const key = sheetNameForCategory(t.category);
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(t);
    }
    for (const [sheetName, txs] of byCat.entries()) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws) continue;
      const header = findHeaderRow(ws);
      const start = header + 1;
      const rows = txs
        .slice()
        .sort((a, b) => a.ts - b.ts)
        .map((t) => ({
          date: toDateStr(t.receipt?.dateISO ? Date.parse(t.receipt.dateISO) : t.ts),
          receiptNo: String(t.receipt?.receiptNo || "").trim(),
          amount: Number(t.amount || 0),
          desc: shortenDescription(String(t.description || "").trim()),
        }));
      writeRows(ws, start, rows);
    }

    
    // Advances given (expense subtype advance_out) -> sheet "VERİLEN AVANSLAR" (auto-expands if needed)
    const givenAdv = expense.filter((t) => t.subtype === "advance_out");
    const wsGiven = wb.getWorksheet("VERİLEN AVANSLAR");
    if (wsGiven && givenAdv.length) {
      const header = findHeaderRow(wsGiven); // should find row containing "GÜN | TOPLAM | AÇIKLAMA"
      const start = header + 1; // first data row

      // Locate TOTAL row (the row whose A cell is "TOPLAM")
      let totalRow = -1;
      for (let r = start; r <= Math.min(wsGiven.rowCount || 200, 200); r++) {
        const v = String(wsGiven.getCell(`A${r}`).value ?? "").toLocaleUpperCase("tr-TR").trim();
        if (v === "TOPLAM") {
          totalRow = r;
          break;
        }
      }
      if (totalRow < 0) totalRow = 49; // fallback to template default

      const capacity = totalRow - start; // rows available before TOTAL row
      const extra = Math.max(0, givenAdv.length - capacity);

      if (extra > 0) {
        // Insert rows before TOTAL row
        for (let i = 0; i < extra; i++) wsGiven.insertRow(totalRow, []);

        // Copy style from last detail row into inserted rows
        const srcRow = wsGiven.getRow(totalRow - 1);
        for (let r = totalRow; r <= totalRow + extra - 1; r++) {
          const dstRow = wsGiven.getRow(r);
          dstRow.height = srcRow.height;
          for (const col of [1, 2, 3]) {
            const srcCell = srcRow.getCell(col);
            const dstCell = dstRow.getCell(col);
            dstCell.style = { ...srcCell.style };
            dstCell.numFmt = srcCell.numFmt;
            dstCell.border = srcCell.border;
            dstCell.alignment = srcCell.alignment;
            dstCell.font = srcCell.font;
            dstCell.fill = srcCell.fill;
          }
        }

        totalRow = totalRow + extra; // TOTAL row moved down
      }

      // Write rows: A=date, B=amount, C=description (who / note)
      const rows = givenAdv
        .slice()
        .sort((a, b) => a.ts - b.ts)
        .map((t) => ({
          date: toDateStr(t.receipt?.dateISO ? Date.parse(t.receipt.dateISO) : t.ts),
          amount: Number(t.amount || 0),
          // In the "VERİLEN AVANSLAR" sheet, the description column must show *to whom* the advance was given.
          // Use the canonical transaction.who (recipient). If it's missing, fall back to the textual description.
          desc: (String(t.who || "").trim() || shortenDescription(String(t.description || "").trim())),
        }));

      for (let i = 0; i < rows.length; i++) {
        const r = start + i;
        wsGiven.getCell(`A${r}`).value = rows[i].date;
        wsGiven.getCell(`B${r}`).value = formatMoneyCell(rows[i].amount);
        wsGiven.getCell(`C${r}`).value = rows[i].desc;
      }

      // Update sums in this sheet (B{totalRow} and E2) to match expanded range.
      wsGiven.getCell(`B${totalRow}`).value = { formula: `SUM(B${start}:B${totalRow - 1})` };
      wsGiven.getCell("E2").value = { formula: `SUM(B${start}:B${totalRow - 1})` };
    }


    // Note: Template does not include a dedicated "ALINAN AVANSLAR" sheet.
    // Received advances are written into TOPLAM tab A28:B32 above.

    const out = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(out), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
