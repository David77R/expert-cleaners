import { formatMinutes } from "@/domain/appointment-rules";
import { formatMoney, type InvoiceData } from "@/domain/invoice";
import {
  COLORS,
  CONTENT_WIDTH,
  MARGIN,
  PAGE,
  createDrawer,
  createPdf,
  drawBrandHeader,
  pdfPalette,
  type PdfBrand,
  drawFooter,
  formatBusinessDate,
  formatLongDate,
  wrap,
} from "@/server/pdf-kit";

export async function renderInvoicePdf(invoice: InvoiceData, brand: PdfBrand): Promise<Uint8Array> {
  const { pdf, regular, bold, supported } = await createPdf(`Factura ${invoice.number}`, invoice.issuedAt, brand);
  const palette = pdfPalette(brand);
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  const draw = createDrawer(() => page, regular, supported);

  drawBrandHeader(page, draw, bold, "FACTURA", invoice.number, brand);

  let y = PAGE.height - 130;
  const metaColumns = [
    { label: "Fecha de emisión", value: formatBusinessDate(invoice.issuedAt) },
    {
      label: "Fecha del servicio",
      value: `${formatLongDate(invoice.serviceDate)}, ${formatMinutes(invoice.startMin)}`,
    },
    { label: "Cita", value: invoice.appointmentCode },
  ];
  metaColumns.forEach((column, index) => {
    const x = MARGIN + index * (CONTENT_WIDTH / 3);
    draw(column.label.toUpperCase(), x, y, { size: 7.5, font: bold, color: COLORS.muted });
    const lines = wrap(column.value, regular, 10, CONTENT_WIDTH / 3 - 12);
    lines.forEach((line, lineIndex) => draw(line, x, y - 14 - lineIndex * 13));
  });

  y -= 62;
  draw("FACTURAR A", MARGIN, y, { size: 7.5, font: bold, color: COLORS.muted });
  draw(invoice.customerName, MARGIN, y - 16, { size: 13, font: bold });
  draw(`Cliente ${invoice.customerCode}`, MARGIN, y - 31, { size: 9, color: COLORS.muted });
  let billY = y - 46;
  for (const line of wrap(invoice.billTo, regular, 10, CONTENT_WIDTH * 0.6)) {
    draw(line, MARGIN, billY);
    billY -= 13;
  }

  y = billY - 22;
  page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT_WIDTH, height: 24, color: palette.brandSoft });
  draw("DESCRIPCIÓN", MARGIN + 10, y + 2, { size: 8, font: bold, color: palette.brand });
  draw("CANT.", MARGIN + CONTENT_WIDTH - 190, y + 2, { size: 8, font: bold, color: palette.brand, align: "right" });
  draw("PRECIO", MARGIN + CONTENT_WIDTH - 100, y + 2, { size: 8, font: bold, color: palette.brand, align: "right" });
  draw("IMPORTE", MARGIN + CONTENT_WIDTH - 10, y + 2, { size: 8, font: bold, color: palette.brand, align: "right" });

  for (const [index, line] of invoice.lines.entries()) {
    if (y < 220) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - 60;
    }
    y -= index === 0 ? 28 : 22;
    draw(line.name, MARGIN + 10, y, { size: 11, font: bold });
    draw("1", MARGIN + CONTENT_WIDTH - 190, y, { align: "right" });
    draw(formatMoney(line.priceCents), MARGIN + CONTENT_WIDTH - 100, y, { align: "right" });
    draw(formatMoney(line.priceCents), MARGIN + CONTENT_WIDTH - 10, y, { font: bold, align: "right" });
    y -= 6;
    for (const spec of line.specs) {
      for (const text of wrap(`${spec.label}: ${spec.value}`, regular, 9, CONTENT_WIDTH - 220)) {
        y -= 13;
        draw(text, MARGIN + 10, y, { size: 9, color: COLORS.muted });
      }
    }
  }

  const details = [`Dirección del servicio: ${invoice.serviceAddress}`];
  if (invoice.destinationAddress) details.push(`Dirección de entrega: ${invoice.destinationAddress}`);

  y -= 10;
  for (const detail of details) {
    for (const text of wrap(detail, regular, 9, CONTENT_WIDTH - 220)) {
      y -= 13;
      draw(text, MARGIN + 10, y, { size: 9, color: COLORS.muted });
    }
  }

  y -= 16;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.75,
    color: COLORS.hair,
  });

  y -= 34;
  draw("TOTAL", MARGIN + CONTENT_WIDTH - 150, y, { size: 9, font: bold, color: COLORS.muted, align: "right" });
  draw(formatMoney(invoice.priceCents), MARGIN + CONTENT_WIDTH - 10, y - 2, { size: 20, font: bold, align: "right" });

  y -= 30;
  const statusText = invoice.paid ? "PAGADA" : "PENDIENTE DE PAGO";
  const statusColor = invoice.paid ? COLORS.success : COLORS.attention;
  const statusWidth = bold.widthOfTextAtSize(statusText, 9) + 20;
  page.drawRectangle({
    x: MARGIN + CONTENT_WIDTH - statusWidth,
    y: y - 6,
    width: statusWidth,
    height: 22,
    borderColor: statusColor,
    borderWidth: 1,
    color: COLORS.white,
  });
  draw(statusText, MARGIN + CONTENT_WIDTH - statusWidth / 2 - bold.widthOfTextAtSize(statusText, 9) / 2, y + 1, {
    size: 9,
    font: bold,
    color: statusColor,
  });

  drawFooter(page, draw, `Gracias por confiar en ${brand.shortName}.`);

  return pdf.save();
}
