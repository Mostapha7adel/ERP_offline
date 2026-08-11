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
