import type { PDFFont, PDFPage } from "pdf-lib";
import { formatMoney } from "@/domain/invoice";
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
  formatBusinessDateTime,
  formatLongDate,
  sanitizeFor,
  wrap,
} from "@/server/pdf-kit";
import type { AgentReport, ReportMetrics } from "@/server/reports";

const BOTTOM_LIMIT = 78;
const ROW_HEIGHT = 22;
function note(city: string): string {
  return `Las citas agendadas se cuentan por la fecha en que cada agente las creó, en horario de ${city}. El dinero excluye las citas canceladas.`;
}
const NUMERIC_EDGES = [192, 236, 280, 352, 424, 496];

export function formatPeriod(from: string, to: string): string {
  return from === to ? formatLongDate(from) : `${formatLongDate(from)} al ${formatLongDate(to)}`;
}

export function labelStep(total: number, maxLabels = 12): number {
  return Math.max(1, Math.ceil(total / maxLabels));
}

export function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = sanitizeFor(font, text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let shortened = clean;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}...`;
}

function dayLabel(isoDate: string): string {
  return `${Number(isoDate.slice(8, 10))}/${Number(isoDate.slice(5, 7))}`;
}

export function sortAgents<T extends { name: string; scheduled: number }>(agents: readonly T[]): T[] {
  return [...agents].sort((a, b) => b.scheduled - a.scheduled || a.name.localeCompare(b.name, "es"));
}

export async function renderReportPdf(report: AgentReport, generatedAt: Date, brand: PdfBrand): Promise<Uint8Array> {
  const palette = pdfPalette(brand);
  const { pdf, regular, bold, supported } = await createPdf(
    `Reporte por agente ${report.from} a ${report.to}`,
    generatedAt,
    brand,
  );
  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  const draw = createDrawer(() => page, regular, supported);

  drawBrandHeader(page, draw, bold, "REPORTE", "Citas agendadas por agente", brand);

  let y = PAGE.height - 130;
  const scope = report.agents.length === 1 ? report.agents[0].name : "Todos los agentes";
  const meta = [
    { label: "Período", value: formatPeriod(report.from, report.to) },
    { label: "Agente", value: scope },
    { label: "Generado", value: formatBusinessDateTime(generatedAt) },
  ];
  const metaWidth = CONTENT_WIDTH / 3;
  let metaBottom = y;
  meta.forEach((column, index) => {
    const x = MARGIN + index * metaWidth;
    draw(column.label.toUpperCase(), x, y, { size: 7.5, font: bold, color: COLORS.muted });
    const lines = wrap(column.value, regular, 10, metaWidth - 12);
    lines.forEach((line, lineIndex) => draw(line, x, y - 14 - lineIndex * 13));
    metaBottom = Math.min(metaBottom, y - 14 - (lines.length - 1) * 13);
  });

  let noteY = metaBottom - 24;
  for (const line of wrap(note(brand.location.city), regular, 8, CONTENT_WIDTH)) {
    draw(line, MARGIN, noteY, { size: 8, color: COLORS.muted });
    noteY -= 11;
  }

  y = noteY - 14;
  const tileGap = 12;
  const tileWidth = (CONTENT_WIDTH - tileGap * 2) / 3;
  const totals = report.totals;
  const tiles = [
    { label: "Agendadas", value: String(totals.scheduled) },
    { label: "Completadas", value: String(totals.completed) },
    { label: "Canceladas", value: String(totals.cancelled) },
    { label: "Agendado", value: formatMoney(totals.bookedCents) },
    { label: "Cobrado", value: formatMoney(totals.paidCents) },
    { label: "Pendiente de cobro", value: formatMoney(totals.unpaidCents) },
  ];
  tiles.forEach((tile, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = MARGIN + column * (tileWidth + tileGap);
    const top = y - row * (54 + tileGap);
    page.drawRectangle({ x, y: top - 54, width: tileWidth, height: 54, color: palette.brandSoft });
    draw(tile.label.toUpperCase(), x + 12, top - 18, { size: 7.5, font: bold, color: palette.brand });
    draw(tile.value, x + 12, top - 42, { size: 19, font: bold });
  });

  y -= 54 * 2 + tileGap + 34;
  draw("Citas agendadas por día", MARGIN, y, { size: 11, font: bold });

  const chartTop = y - 18;
  const chartHeight = 110;
  const chartBottom = chartTop - chartHeight;
  const daily = totals.daily;
  const maxValue = Math.max(1, ...daily);
  page.drawLine({
    start: { x: MARGIN, y: chartBottom },
    end: { x: MARGIN + CONTENT_WIDTH, y: chartBottom },
    thickness: 0.75,
    color: COLORS.hair,
  });
  draw(String(maxValue), MARGIN - 6, chartTop - 6, { size: 7.5, color: COLORS.muted, align: "right" });
  draw("0", MARGIN - 6, chartBottom - 2, { size: 7.5, color: COLORS.muted, align: "right" });

  const slot = CONTENT_WIDTH / report.dates.length;
  const barWidth = Math.min(28, Math.max(1.5, slot * 0.68));
  const step = labelStep(report.dates.length);
  report.dates.forEach((date, index) => {
    const value = daily[index];
    const x = MARGIN + index * slot + (slot - barWidth) / 2;
    if (value > 0) {
      const height = (value / maxValue) * (chartHeight - 12);
      page.drawRectangle({ x, y: chartBottom, width: barWidth, height, color: palette.brand });
      if (report.dates.length <= 16) {
        draw(String(value), x + barWidth / 2 - 2.5, chartBottom + height + 3, { size: 7.5, color: COLORS.muted });
      }
    }
    if (index % step === 0)
      draw(dayLabel(date), x + barWidth / 2 - 8, chartBottom - 12, { size: 7, color: COLORS.muted });
  });

  y = chartBottom - 44;
  const columns = ["AGEND.", "CANC.", "COMPL.", "AGENDADO", "COBRADO", "PENDIENTE"];

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT_WIDTH, height: 24, color: palette.brandSoft });
    draw("AGENTE", MARGIN + 8, y + 2, { size: 8, font: bold, color: palette.brand });
    columns.forEach((label, index) =>
      draw(label, MARGIN + NUMERIC_EDGES[index], y + 2, { size: 8, font: bold, color: palette.brand, align: "right" }),
    );
    y -= 26;
  };

  const startNewPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN - 10;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed >= BOTTOM_LIMIT) return;
    startNewPage();
    drawTableHeader();
  };

  const drawRow = (name: string, metrics: ReportMetrics, strong: boolean) => {
    ensureSpace(ROW_HEIGHT);
    const font = strong ? bold : regular;
    draw(fitText(name, font, 10, NUMERIC_EDGES[0] - 48), MARGIN + 8, y, { font });
    const values = [
      String(metrics.scheduled),
      String(metrics.cancelled),
      String(metrics.completed),
      formatMoney(metrics.bookedCents),
      formatMoney(metrics.paidCents),
      formatMoney(metrics.unpaidCents),
    ];
    values.forEach((value, index) => draw(value, MARGIN + NUMERIC_EDGES[index], y, { font, align: "right" }));
    page.drawLine({
      start: { x: MARGIN, y: y - 8 },
      end: { x: MARGIN + CONTENT_WIDTH, y: y - 8 },
      thickness: 0.5,
      color: COLORS.hair,
    });
    y -= ROW_HEIGHT;
  };

  ensureSpace(60);
  drawTableHeader();
  const sorted = sortAgents(report.agents);
  const showTotal = report.agents.length > 1;
  sorted.forEach((agent, index) => {
    if (showTotal && index === sorted.length - 1) ensureSpace(ROW_HEIGHT * 2);
    drawRow(agent.name, agent, false);
  });
  if (report.agents.length > 1) drawRow("Total", report.totals, true);

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    page = current;
    page.drawLine({
      start: { x: MARGIN, y: 62 },
      end: { x: MARGIN + CONTENT_WIDTH, y: 62 },
      thickness: 0.75,
      color: COLORS.hair,
    });
    draw(brand.shortName, MARGIN, 44, { size: 9, color: COLORS.muted });
    draw(`Página ${index + 1} de ${pages.length}`, MARGIN + CONTENT_WIDTH, 44, {
      size: 9,
      color: COLORS.muted,
      align: "right",
    });
  });

  return pdf.save();
}
