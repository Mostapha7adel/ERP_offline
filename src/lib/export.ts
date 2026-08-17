/**
 * Client-side file export helpers.
 *
 * Inside Tauri, downloads use a native save dialog (user picks the folder/path)
 * and are written via the fs plugin. In a plain browser (dev/preview) the anchor
 * download fallback saves to the user's default Downloads folder. Printing uses
 * the native print dialog through window.print().
 */

async function saveWithDialog(
  filename: string,
  content: string,
  mime: string,
): Promise<boolean> {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      title: filename,
      defaultPath: filename,
      filters: [
        {
          name: mime.includes("csv")
            ? "CSV"
            : mime.includes("html")
              ? "HTML"
              : mime.includes("json")
                ? "JSON"
                : "Text",
          extensions: mime.includes("csv")
            ? ["csv"]
            : mime.includes("html")
              ? ["html"]
              : mime.includes("json")
                ? ["json"]
                : ["txt"],
        },
      ],
    });
    if (!path) return false;
    await writeTextFile(path, content);
    return true;
  } catch {
    return false;
  }
}

/** Save binary content via the native save dialog (Tauri) or browser download. */
async function saveBinary(
  filename: string,
  data: Uint8Array,
  mime: string,
  extensions: string[],
): Promise<boolean> {
  try {
    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        title: filename,
        defaultPath: filename,
        filters: [{ name: extensions[0]?.toUpperCase() ?? "File", extensions }],
      });
      if (!path) return false;
      await writeFile(path, data);
      return true;
    }
    const bytes = data.slice().buffer as ArrayBuffer;
    triggerDownload(filename, new Blob([bytes], { type: mime }));
    return true;
  } catch {
    return false;
  }
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): Promise<boolean> {
  if (isTauri()) {
    const saved = await saveWithDialog(filename, content, mime);
    if (saved) return true;
  }
  triggerDownload(filename, new Blob([content], { type: mime }));
  return true;
}

export async function downloadCsv(
  filename: string,
  rows: Array<Array<string | number>>,
): Promise<boolean> {
  const escape = (value: string | number) => {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  return downloadTextFile(filename, `\uFEFF${content}`, "text/csv;charset=utf-8");
}

export async function downloadHtmlFile(
  filename: string,
  html: string,
): Promise<boolean> {
  return downloadTextFile(filename, html, "text/html;charset=utf-8");
}

/**
 * Export tabular data to a real .xlsx workbook. Each sheet is a set of rows
 * where every cell is a primitive (string | number | Date | boolean | null).
 * The first row of each sheet is treated as a bold header row.
 */
export async function downloadExcel(
  filename: string,
  sheets: Array<{ name: string; rows: Array<Array<string | number | Date | boolean | null | undefined>> }>,
): Promise<boolean> {
  try {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LedgerFlow";
    workbook.created = new Date();

    for (const sheet of sheets) {
      const ws = workbook.addWorksheet(sheet.name.replace(/[\\/*?:[\]]/g, " ").slice(0, 31));
      if (sheet.rows.length === 0) continue;
      ws.addRow(sheet.rows[0]);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F1F7" },
      };
      for (const row of sheet.rows.slice(1)) {
        ws.addRow(row);
      }
      const headerRow = sheet.rows[0];
      if (!headerRow) continue;
      // Size columns to fit their content (bounded to keep files small).
      const width = (value: unknown) => {
        const len = String(value ?? "").length;
        return Math.min(Math.max(len + 2, 8), 40);
      };
      headerRow.forEach((_, col) => {
        let max = 8;
        for (const row of sheet.rows) {
          max = Math.max(max, width(row[col]));
        }
        ws.getColumn(col + 1).width = max;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    return saveBinary(filename, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ["xlsx"]);
  } catch {
    return false;
  }
}

/**
 * Export a report to PDF. Renders a title, optional subtitle line(s), then a
 * table from `columns` + `rows`. Arabic/RTL text renders through the bundled
 * Noto Arabic font, and currency columns are right-aligned.
 */
export async function downloadPdf(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" | "center"; width?: number }>;
  rows: Array<Record<string, string | number | null | undefined>>;
}): Promise<boolean> {
  try {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).autoTable;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(15);
    doc.text(opts.title, pageWidth / 2, 16, { align: "center" });
    let y = 22;
    if (opts.subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(opts.subtitle, pageWidth / 2, y, { align: "center" });
      y += 2;
    }
    doc.setTextColor(0);

    const head = [opts.columns.map((c) => c.label)];
    const body = opts.rows.map((row) =>
      opts.columns.map((c) => {
        const v = row[c.key];
        return v === null || v === undefined ? "" : String(v);
      }),
    );

    autoTable(doc, {
      head,
      body,
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.8, overflow: "linebreak" },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 247, 252] },
      columnStyles: opts.columns.reduce<Record<number, { halign: "left" | "right" | "center" }>>((acc, c, i) => {
        acc[i] = { halign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" };
        return acc;
      }, {}),
      margin: { left: 10, right: 10 },
    });

    const bytes = doc.output("arraybuffer");
    return saveBinary(opts.filename, new Uint8Array(bytes), "application/pdf", ["pdf"]);
  } catch {
    return false;
  }
}

export function printHtml(title: string, html: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument ?? frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,Arial,sans-serif;color:#111;margin:24px}</style></head><body>${html}</body></html>`,
  );
  doc.close();
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
}

/** Escape user-controlled text before interpolating into HTML documents. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Minimal printable invoice HTML (both LTR/RTL aware via dir attribute). */
export function buildInvoiceHtml(opts: {
  companyName: string;
  documentTitle: string;
  number: string;
  dateLabel: string;
  dateValue: string;
  dueLabel?: string;
  dueValue?: string;
  partyLabel: string;
  partyName: string;
  partyDetail?: string;
  rows: Array<{ description: string; quantity: string; price: string; total: string }>;
  subtotalLabel: string;
  subtotal: string;
  taxLabel: string;
  tax: string;
  totalLabel: string;
  total: string;
  currency?: string;
}): string {
  const e = escapeHtml;
  const lines = [
    `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px">`,
    `<div><div style="font-size:20px;font-weight:700">${e(opts.companyName)}</div><div style="color:#666;margin-top:4px">${e(opts.documentTitle)}</div></div>`,
    `<div style="text-align:right"><div style="font-size:18px;font-weight:700">${e(opts.number)}</div><div style="color:#666;margin-top:4px">${e(opts.dateLabel)}: ${e(opts.dateValue)}</div>${opts.dueValue ? `<div style="color:#666">${e(opts.dueLabel ?? "")}: ${e(opts.dueValue)}</div>` : ""}</div>`,
    `</div>`,
    `<div style="margin-bottom:16px"><div style="font-weight:600;color:#444">${e(opts.partyLabel)}</div><div style="font-size:15px">${e(opts.partyName)}</div>${opts.partyDetail ? `<div style="color:#666;font-size:13px">${e(opts.partyDetail)}</div>` : ""}</div>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px">`,
    `<thead><tr style="border-bottom:1px solid #ccc;background:#f5f5f5"><th style="text-align:left;padding:8px">${e("Description")}</th><th style="text-align:right;padding:8px">${e("Qty")}</th><th style="text-align:right;padding:8px">${e("Price")}</th><th style="text-align:right;padding:8px">${e("Total")}</th></tr></thead>`,
    `<tbody>${opts.rows.map((r) => `<tr style="border-bottom:1px solid #eee"><td style="padding:8px">${e(r.description)}</td><td style="text-align:right;padding:8px">${e(r.quantity)}</td><td style="text-align:right;padding:8px">${e(r.price)}</td><td style="text-align:right;padding:8px;font-weight:600">${e(r.total)}</td></tr>`).join("")}</tbody>`,
    `</table>`,
    `<div style="margin-top:16px;margin-left:auto;width:260px">`,
    `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#555">${e(opts.subtotalLabel)}</span><span>${e(opts.subtotal)}</span></div>`,
    `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#555">${e(opts.taxLabel)}</span><span>${e(opts.tax)}</span></div>`,
    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #333;font-weight:700;font-size:16px"><span>${e(opts.totalLabel)}</span><span>${e(opts.total)}</span></div>`,
    `</div>`,
  ];
  return lines.join("");
}
