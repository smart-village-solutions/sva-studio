import { describe, expect, it } from 'vitest';

import { PdfBuilder } from './waste-management-output.pdf-builder.js';

describe('PdfBuilder', () => {
  it('marks never-populated reserved objects as free in the xref table', () => {
    const builder = new PdfBuilder();
    const rootId = builder.reserveObject();
    builder.reserveObject();
    const pageId = builder.addObject('<< /Type /Page >>');
    builder.setReservedObject(rootId, `<< /Type /Catalog /Pages ${pageId} 0 R >>`);

    const pdfText = builder.build(rootId).toString('latin1');

    expect(pdfText).toContain('xref\n0 4\n0000000000 65535 f \n');
    expect(pdfText).toMatch(
      /xref\n0 4\n0000000000 65535 f \n\d{10} 00000 n \n0000000000 65535 f \n\d{10} 00000 n \n/
    );
  });
});
