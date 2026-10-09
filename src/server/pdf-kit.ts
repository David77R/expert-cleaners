import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BUSINESS_TIMEZONE } from "@/domain/date-rules";

export const PAGE = { width: 612, height: 792 };
export const MARGIN = 54;
export const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

export const COLORS = {
  brand: rgb(13 / 255, 156 / 255, 142 / 255),
  brandSoft: rgb(223 / 255, 244 / 255, 240 / 255),
  ink: rgb(21 / 255, 26 / 255, 33 / 255),
  muted: rgb(110 / 255, 116 / 255, 124 / 255),
  hair: rgb(227 / 255, 225 / 255, 218 / 255),
  success: rgb(30 / 255, 130 / 255, 76 / 255),
  attention: rgb(190 / 255, 90 / 255, 20 / 255),
  white: rgb(1, 1, 1),
};

type Color = ReturnType<typeof rgb>;

const REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
};

export function toPdfText(text: string, supported: ReadonlySet<number>): string {
  let output = "";
  for (const char of text.normalize("NFC")) {
    const replaced = REPLACEMENTS[char] ?? char;
    for (const piece of replaced) {
      const code = piece.codePointAt(0)!;
      if (piece === "\n" || piece === "\t") output += " ";
      else output += supported.has(code) ? piece : "?";
    }
  }
  return output;
}

const supportedByFont = new WeakMap<PDFFont, Set<number>>();

export function sanitizeFor(font: PDFFont, text: string): string {
  let supported = supportedByFont.get(font);
  if (!supported) {
    supported = new Set(font.getCharacterSet());
    supportedByFont.set(font, supported);
  }
  return toPdfText(text, supported);
}

export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of sanitizeFor(font, text).split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat("es-US", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

export function formatBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("es-US", {
    timeZone: BUSINESS_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatBusinessDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-US", {
    timeZone: BUSINESS_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function createPdf(title: string, date: Date) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setTitle(title);
  pdf.setAuthor("Expert Cleaners");
  pdf.setCreator("Expert Cleaners");
  pdf.setProducer("Expert Cleaners");
  pdf.setCreationDate(date);
  pdf.setModificationDate(date);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  return { pdf, regular, bold, supported };
}

export type TextOptions = { size?: number; font?: PDFFont; color?: Color; align?: "left" | "right" };

export function createDrawer(getPage: () => PDFPage, regular: PDFFont, supported: ReadonlySet<number>) {
  return (text: string, x: number, y: number, options: TextOptions = {}) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    const content = toPdfText(text, supported);
    const width = font.widthOfTextAtSize(content, size);
    getPage().drawText(content, {
      x: options.align === "right" ? x - width : x,
      y,
      size,
      font,
      color: options.color ?? COLORS.ink,
    });
  };
}

export function drawBrandHeader(
  page: PDFPage,
  draw: ReturnType<typeof createDrawer>,
  bold: PDFFont,
  heading: string,
  sub: string,
) {
  page.drawRectangle({ x: 0, y: PAGE.height - 92, width: PAGE.width, height: 92, color: COLORS.brand });
  draw("Expert Cleaners", MARGIN, PAGE.height - 52, { size: 24, font: bold, color: COLORS.white });
  draw("Miami, FL", MARGIN, PAGE.height - 70, { size: 10, color: COLORS.white });
  draw(heading, PAGE.width - MARGIN, PAGE.height - 48, { size: 20, font: bold, color: COLORS.white, align: "right" });
  draw(sub, PAGE.width - MARGIN, PAGE.height - 68, { size: 12, color: COLORS.white, align: "right" });
}

export function drawFooter(page: PDFPage, draw: ReturnType<typeof createDrawer>, text: string) {
  page.drawLine({
    start: { x: MARGIN, y: 62 },
    end: { x: MARGIN + CONTENT_WIDTH, y: 62 },
    thickness: 0.75,
    color: COLORS.hair,
  });
  draw(text, MARGIN, 44, { size: 9, color: COLORS.muted });
}
