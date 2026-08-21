import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import type { ReportQuery } from "@/lib/reports/validation";
import { getSalesReport } from "@/lib/reports/services/sales-report-service";
import { getCustomerReport, getFinanceReport, getInventoryReport, getKitchenReport, getOperationsReport, getStaffReport, getSupplierReport } from "@/lib/reports/services/advanced-report-service";

export type ExportReport = "sales" | "inventory" | "staff" | "kitchen" | "customers" | "suppliers" | "finance" | "operations";
export type ExportFormat = "csv" | "xlsx" | "pdf" | "print";

export async function getExportData(report: ExportReport, range: ReportRange, query: ReportQuery) {
  if (report === "sales") return getSalesReport(range, query);
  if (report === "finance") return getFinanceReport(range, query);
  return ({ inventory: getInventoryReport, staff: getStaffReport, kitchen: getKitchenReport, customers: getCustomerReport, suppliers: getSupplierReport, operations: getOperationsReport } as const)[report](range);
}

function scalar(value: unknown): string { if (value == null) return ""; if (value instanceof Prisma.Decimal) return value.toFixed(2); if (value instanceof Date) return value.toISOString(); if (typeof value === "object") return JSON.stringify(value); return String(value); }
export function flattenReport(data: unknown) { const rows: Array<Record<string, string>> = []; const walk = (value: unknown, prefix = "") => { if (Array.isArray(value)) { value.forEach((item, index) => walk(item, `${prefix}${prefix ? "." : ""}${index}`)); return; } if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof Prisma.Decimal)) { Object.entries(value as Record<string, unknown>).forEach(([key, child]) => walk(child, `${prefix}${prefix ? "." : ""}${key}`)); return; } rows.push({ field: prefix, value: scalar(value) }); }; walk(data); return rows; }
export function toCsv(rows: Array<Record<string, string>>) { const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]; const quote = (v: string) => `"${v.replaceAll('"', '""')}"`; return [headers.join(","), ...rows.map((row) => headers.map((key) => quote(row[key] ?? "")).join(","))].join("\n"); }
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export function toPrintHtml(title: string, rows: Array<Record<string, string>>) { return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body><button onclick="print()">Print</button><h1>${escapeHtml(title)}</h1><table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.field)}</td><td>${escapeHtml(r.value)}</td></tr>`).join("")}</tbody></table></body></html>`; }

export async function toXlsx(title: string, rows: Array<Record<string, string>>) {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet(title.slice(0, 31));
  sheet.columns = [{ header: "Field", key: "field", width: 38 }, { header: "Value", key: "value", width: 80 }];
  rows.forEach((row) => sheet.addRow(row)); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function toPdf(title: string, rows: Array<Record<string, string>>) {
  return new Promise<Buffer>((resolve, reject) => { const document = new PDFDocument({ margin: 36 }); const chunks: Buffer[] = []; document.on("data", (chunk: Buffer) => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks))); document.on("error", reject); document.fontSize(18).text(title); document.moveDown(); document.fontSize(9); rows.forEach((row) => document.text(`${row.field}: ${row.value}`, { width: 520 })); document.end(); });
}
