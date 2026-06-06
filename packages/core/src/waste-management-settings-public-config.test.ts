import { describe, expect, it } from 'vitest';

import {
  buildWasteManagementPublicConfig,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
} from './waste-management-settings-public-config.js';

describe('waste-management-settings-public-config', () => {
  it('reads and writes pdf-specific public config fields', () => {
    const current = {
      calendarWebUrl: 'https://calendar.example',
      pdfBrandingAssetUrl: 'https://old.example/logo.png',
      pdfContactBlock: 'old contact',
    } as const;

    const next = buildWasteManagementPublicConfig(current, {
      selected: true,
      calendarWebUrl: 'https://calendar.example',
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
    });

    expect(readWasteManagementPdfBrandingAssetUrl(next)).toBe('https://cdn.example/logo.svg');
    expect(readWasteManagementPdfContactBlock(next)).toBe('Abfallberatung 03395 / 1234');
  });

  it('removes pdf-specific keys when empty values are written', () => {
    const next = buildWasteManagementPublicConfig(
      {
        pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
        pdfContactBlock: 'Abfallberatung 03395 / 1234',
      },
      {
        selected: false,
      }
    );

    expect(readWasteManagementPdfBrandingAssetUrl(next)).toBeUndefined();
    expect(readWasteManagementPdfContactBlock(next)).toBeUndefined();
  });
});
