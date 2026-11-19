import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PdfReportTable {
  title: string;
  subtitle: string;
  facilityName: string;
  generatedAt: string;
  headers: string[];
  rows: string[][];
}

export async function buildPdfReportBuffer(report: PdfReportTable): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842; // A4 Landscape
  const pageHeight = 595;
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / Math.max(1, report.headers.length);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawText(report.facilityName, {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.06, 0.46, 0.43),
    });
    y -= 20;
    page.drawText(report.title, {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= 16;
    page.drawText(`${report.subtitle}  |  Generated: ${report.generatedAt}`, {
      x: margin,
      y,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.28, 0.33, 0.41),
    });
    y -= 22;

    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: usableWidth,
      height: 20,
      color: rgb(0.95, 0.96, 0.98),
    });

    report.headers.forEach((h, i) => {
      page.drawText(truncateText(h, 24), {
        x: margin + i * colWidth + 6,
        y: y + 2,
        size: 9,
        font: fontBold,
        color: rgb(0.06, 0.09, 0.16),
      });
    });
    y -= 22;
  };

  drawHeader();

  for (const row of report.rows) {
    if (y < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }

    row.forEach((cell, i) => {
      page.drawText(truncateText(cell || '—', 28), {
        x: margin + i * colWidth + 6,
        y,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.12, 0.16, 0.23),
      });
    });

    page.drawLine({
      start: { x: margin, y: y - 5 },
      end: { x: pageWidth - margin, y: y - 5 },
      thickness: 0.5,
      color: rgb(0.88, 0.9, 0.93),
    });

    y -= 18;
  }

  return pdfDoc.save();
}

function truncateText(text: string, maxLen: number): string {
  const safe = text.replace(/[^\x20-\x7E]/g, ' ');
  return safe.length > maxLen ? `${safe.slice(0, maxLen - 1)}...` : safe;
}
