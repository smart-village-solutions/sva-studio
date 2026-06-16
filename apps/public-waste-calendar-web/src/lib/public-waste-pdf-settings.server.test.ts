import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExternalInterfaceRecord } from '@sva/core';
import {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { loadPublicWastePdfStaticConfig } from './public-waste-pdf-settings.server.js';

vi.mock('@sva/data-repositories/server', () => ({
  listExternalInterfaceRecords: vi.fn(),
  loadDefaultExternalInterfaceRecord: vi.fn(),
}));

const listExternalInterfaceRecordsMock = vi.mocked(listExternalInterfaceRecords);
const loadDefaultExternalInterfaceRecordMock = vi.mocked(loadDefaultExternalInterfaceRecord);

const createExternalInterfaceRecord = (
  publicConfig: Readonly<Record<string, unknown>>
): ExternalInterfaceRecord => ({
  id: 'interface-1',
  instanceId: 'tenant-a',
  typeKey: 'supabase',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'Supabase',
  alias: 'default',
  enabled: true,
  isDefault: true,
  category: 'database',
  statusCheckKind: 'supabase',
  visibleStatus: 'ok',
  publicConfig,
});

describe('public waste pdf settings', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('falls back to PUBLIC_WASTE_DATABASE_URL when IAM_DATABASE_URL is missing', async () => {
    vi.stubEnv('PUBLIC_WASTE_DATABASE_URL', 'postgres://public-waste');
    listExternalInterfaceRecordsMock.mockResolvedValue([]);
    loadDefaultExternalInterfaceRecordMock.mockResolvedValue(
      createExternalInterfaceRecord({
        pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
        pdfContactBlock: 'Abfallberatung',
      })
    );

    const result = await loadPublicWastePdfStaticConfig('tenant-a');

    expect(result).toEqual({
      brandingAssetUrl: 'https://cdn.example/logo.svg',
      contactBlock: 'Abfallberatung',
    });
    expect(listExternalInterfaceRecordsMock).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        getDatabaseUrl: expect.any(Function),
      })
    );
    const [, options] = listExternalInterfaceRecordsMock.mock.calls[0]!;
    const getDatabaseUrl = options?.getDatabaseUrl;
    expect(getDatabaseUrl).toEqual(expect.any(Function));
    expect(getDatabaseUrl?.()).toBe('postgres://public-waste');
  });

  it('loads the default interface when no selected record exists', async () => {
    vi.stubEnv('PUBLIC_WASTE_PDF_BRANDING_ASSET_URL', '');
    vi.stubEnv('PUBLIC_WASTE_PDF_CONTACT_BLOCK', '');
    listExternalInterfaceRecordsMock.mockResolvedValue([]);
    loadDefaultExternalInterfaceRecordMock.mockResolvedValue(
      createExternalInterfaceRecord({
        pdfContactBlock: 'Default Contact',
      })
    );

    const result = await loadPublicWastePdfStaticConfig('tenant-a', {
      getDatabaseUrl: () => 'postgres://custom',
    });

    expect(loadDefaultExternalInterfaceRecordMock).toHaveBeenCalledWith(
      'tenant-a',
      'supabase',
      expect.objectContaining({
        getDatabaseUrl: expect.any(Function),
      })
    );
    expect(result).toEqual({
      contactBlock: 'Default Contact',
    });
  });

  it('falls back to PUBLIC_WASTE_PDF_* env values when no interface record can be loaded', async () => {
    vi.stubEnv(
      'PUBLIC_WASTE_PDF_BRANDING_ASSET_URL',
      'https://www.landkreis-prignitz.de/global/wGlobal/layout/images/logos/wappen-logo.png'
    );
    vi.stubEnv('PUBLIC_WASTE_PDF_CONTACT_BLOCK', 'Abfallberatung Prignitz');
    listExternalInterfaceRecordsMock.mockResolvedValue([]);
    loadDefaultExternalInterfaceRecordMock.mockResolvedValue(null);

    const result = await loadPublicWastePdfStaticConfig('bb-prignitz', {
      getDatabaseUrl: () => 'postgres://custom',
    });

    expect(result).toEqual({
      brandingAssetUrl: 'https://www.landkreis-prignitz.de/global/wGlobal/layout/images/logos/wappen-logo.png',
      contactBlock: 'Abfallberatung Prignitz',
    });
  });
});
