import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PurchaseOrderPdfInput = {
  orderNumber: number;
  status: string;
  supplierName: string;
  supplierContact?: string | null;
  supplierPhone?: string | null;
  createdAt: Date;
  expectedDeliveryDate: Date;
  preparedBy: string;
  notes?: string | null;
  totalAmount: string;
  items: {
    name: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const BLUE = rgb(0.12, 0.31, 0.75);
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const LINE = rgb(0.86, 0.89, 0.93);
const PALE_BLUE = rgb(0.94, 0.97, 1);
const UTC_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function money(value: string) {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function date(value: Date) {
  return UTC_DATE_FORMATTER.format(value);
}

function fitText(value: string, font: PDFFont, size: number, width: number) {
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  let output = value;
  while (output.length > 1 && font.widthOfTextAtSize(`${output}...`, size) > width) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}

function drawRight(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size = 9,
) {
  page.drawText(value, {
    x: x + width - font.widthOfTextAtSize(value, size),
    y,
    font,
    size,
    color: INK,
  });
}

export async function generatePurchaseOrderPdf(input: PurchaseOrderPdfInput) {
  const document = await PDFDocument.create();
  const [regular, bold] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(StandardFonts.HelveticaBold),
  ]);
  const pages: PDFPage[] = [];
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const drawHeader = (continuation = false) => {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 112, width: PAGE_WIDTH, height: 112, color: PALE_BLUE });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 112, width: 8, height: 112, color: BLUE });
    page.drawText("MASH ALLAH CAFE", { x: MARGIN, y: PAGE_HEIGHT - 52, font: bold, size: 11, color: BLUE });
    page.drawText(continuation ? "PURCHASE ORDER - CONTINUED" : "PURCHASE ORDER", {
      x: MARGIN,
      y: PAGE_HEIGHT - 80,
      font: bold,
      size: 23,
      color: INK,
    });
    const po = `PO #${input.orderNumber}`;
    page.drawText(po, {
      x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(po, 16),
      y: PAGE_HEIGHT - 58,
      font: bold,
      size: 16,
      color: INK,
    });
    const status = input.status.toUpperCase();
    page.drawText(status, {
      x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(status, 9),
      y: PAGE_HEIGHT - 78,
      font: bold,
      size: 9,
      color: BLUE,
    });
    y = PAGE_HEIGHT - 142;
  };

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 22, width: PAGE_WIDTH - 2 * MARGIN, height: 26, color: INK });
    const labels = [
      ["ITEM", MARGIN + 8],
      ["UNIT", 288],
      ["QTY", 348],
      ["UNIT PRICE", 407],
      ["TOTAL", 501],
    ] as const;
    for (const [label, x] of labels) {
      page.drawText(label, { x, y: y - 13, font: bold, size: 8, color: rgb(1, 1, 1) });
    }
    y -= 28;
  };

  const nextPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    drawHeader(true);
    drawTableHeader();
  };

  drawHeader();
  page.drawText("SUPPLIER", { x: MARGIN, y, font: bold, size: 8, color: MUTED });
  page.drawText(fitText(input.supplierName, bold, 15, 225), { x: MARGIN, y: y - 23, font: bold, size: 15, color: INK });
  const contact = [input.supplierContact, input.supplierPhone].filter(Boolean).join(" | ");
  if (contact) page.drawText(fitText(contact, regular, 9, 225), { x: MARGIN, y: y - 40, font: regular, size: 9, color: MUTED });

  const detailX = 330;
  const details = [
    ["Created", date(input.createdAt)],
    ["Expected delivery", date(input.expectedDeliveryDate)],
    ["Prepared by", input.preparedBy],
  ];
  details.forEach(([label, value], index) => {
    const rowY = y - index * 22;
    page.drawText(label, { x: detailX, y: rowY, font: regular, size: 8, color: MUTED });
    drawRight(page, fitText(value, bold, 9, 135), detailX + 78, rowY, 135, bold, 9);
  });
  y -= 82;
  drawTableHeader();

  for (const item of input.items) {
    if (y < 92) nextPage();
    page.drawLine({ start: { x: MARGIN, y: y - 22 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 22 }, thickness: 0.6, color: LINE });
    page.drawText(fitText(item.name, bold, 9, 220), { x: MARGIN + 8, y: y - 9, font: bold, size: 9, color: INK });
    page.drawText(fitText(item.unit, regular, 9, 52), { x: 288, y: y - 9, font: regular, size: 9, color: INK });
    drawRight(page, item.quantity, 342, y - 9, 48, regular);
    drawRight(page, money(item.unitPrice), 397, y - 9, 69, regular);
    drawRight(page, money(item.lineTotal), 473, y - 9, 74, bold);
    y -= 26;
  }

  if (y < 145) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    drawHeader(true);
  }
  y -= 12;
  page.drawRectangle({ x: 365, y: y - 42, width: 182, height: 50, color: PALE_BLUE });
  page.drawText("ORDER TOTAL", { x: 378, y: y - 9, font: bold, size: 8, color: MUTED });
  drawRight(page, money(input.totalAmount), 374, y - 31, 160, bold, 18);
  y -= 70;

  if (input.notes) {
    page.drawText("ORDER NOTES", { x: MARGIN, y, font: bold, size: 8, color: MUTED });
    page.drawText(fitText(input.notes.replace(/\s+/g, " "), regular, 9, PAGE_WIDTH - 2 * MARGIN), {
      x: MARGIN,
      y: y - 18,
      font: regular,
      size: 9,
      color: INK,
    });
  }

  pages.forEach((current, index) => {
    const footer = `Mash Allah Cafe  |  PO #${input.orderNumber}  |  Page ${index + 1} of ${pages.length}`;
    current.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_WIDTH - MARGIN, y: 38 }, thickness: 0.6, color: LINE });
    current.drawText(footer, { x: MARGIN, y: 23, font: regular, size: 8, color: MUTED });
  });

  document.setTitle(`Purchase Order ${input.orderNumber}`);
  document.setAuthor("Mash Allah Cafe");
  document.setCreator("Cafe POS");
  return document.save();
}
