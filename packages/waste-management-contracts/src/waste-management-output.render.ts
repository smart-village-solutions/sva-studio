import type { WasteCalendarPdfDocument } from './waste-management-output.types.js';
import { PdfBuilder } from './waste-management-output.pdf-builder.js';
import { createBrandingImageResource } from './waste-management-output.render.helpers.js';
import { PAGE_WIDTH, PAGE_HEIGHT } from './waste-management-output.render.drawing.js';
import { renderPageCommands } from './waste-management-output.render.page.js';

export const renderWasteCalendarPdf = (document: WasteCalendarPdfDocument): Buffer => {
  const pdf = new PdfBuilder();
  const regularFontId = pdf.addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );
  const boldFontId = pdf.addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  );
  const pagesId = pdf.reserveObject();
  const brandingImageResource = createBrandingImageResource({
    document,
    addStreamObject: (streamContent, dictionary) => pdf.addStreamObject(streamContent, dictionary),
  });
  const pageIds = document.pages.map((page) => {
    const streamId = pdf.addStreamObject(
      renderPageCommands(page, brandingImageResource?.objectName)
    );
    const xObjectSection = brandingImageResource
      ? ` /XObject << /${brandingImageResource.objectName} ${brandingImageResource.id} 0 R >>`
      : '';
    return pdf.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
        2
      )}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >>${xObjectSection} >> /Contents ${streamId} 0 R >>`
    );
  });

  pdf.setReservedObject(
    pagesId,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  );
  return pdf.build(pdf.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
};
