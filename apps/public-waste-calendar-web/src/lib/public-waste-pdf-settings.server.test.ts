import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExternalInterfaceRecord } from '@sva/core';
import { createWasteMasterDataRepository } from '@sva/data-repositories';
import {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { loadPublicWastePdfStaticConfig } from './public-waste-pdf-settings.server.js';

const repositoryMock = vi.hoisted(() => ({
  getWastePdfStaticSettings: vi.fn(),
}));
const poolConnectMock = vi.hoisted(() => vi.fn());
const poolEndMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@sva/data-repositories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/data-repositories')>();
  return {
    ...actual,
    createWasteMasterDataRepository: vi.fn(() => repositoryMock),
  };
});

vi.mock('@sva/data-repositories/server', () => ({
  listExternalInterfaceRecords: vi.fn(),
  loadDefaultExternalInterfaceRecord: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect: poolConnectMock,
      end: poolEndMock,
    };
  }),
}));

const createWasteMasterDataRepositoryMock = vi.mocked(createWasteMasterDataRepository);
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

  it('loads pdf settings from the waste database first', async () => {
    vi.stubEnv('PUBLIC_WASTE_DATABASE_URL', 'postgres://public-waste');
    poolConnectMock.mockResolvedValue({
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
      release: vi.fn(),
    });
    repositoryMock.getWastePdfStaticSettings.mockResolvedValue({
      pdfBrandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
      pdfContactBlock: 'Abfallberatung aus Waste-DB',
    });

    const result = await loadPublicWastePdfStaticConfig('tenant-a');

    expect(result).toEqual({
      brandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
      contactBlock: 'Abfallberatung aus Waste-DB',
    });
    expect(createWasteMasterDataRepositoryMock).toHaveBeenCalledTimes(1);
    expect(repositoryMock.getWastePdfStaticSettings).toHaveBeenCalledTimes(1);
    expect(listExternalInterfaceRecordsMock).not.toHaveBeenCalled();
  });

  it('merges partial waste pdf settings with legacy or env fallbacks per field', async () => {
    vi.stubEnv('PUBLIC_WASTE_PDF_CONTACT_BLOCK', 'Env Contact');
    poolConnectMock.mockResolvedValue({
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
      release: vi.fn(),
    });
    repositoryMock.getWastePdfStaticSettings.mockResolvedValue({
      pdfBrandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
      pdfContactBlock: undefined,
    });
    listExternalInterfaceRecordsMock.mockResolvedValue([]);
    loadDefaultExternalInterfaceRecordMock.mockResolvedValue(
      createExternalInterfaceRecord({
        pdfContactBlock: 'Legacy Contact',
      })
    );

    const result = await loadPublicWastePdfStaticConfig('tenant-a', {
      getDatabaseUrl: () => 'postgres://custom',
    });

    expect(result).toEqual({
      brandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
      contactBlock: 'Legacy Contact',
    });
  });

  it('falls through to legacy or env values when waste settings exist but are empty', async () => {
    poolConnectMock.mockResolvedValue({
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
      release: vi.fn(),
    });
    repositoryMock.getWastePdfStaticSettings.mockResolvedValue({
      pdfBrandingAssetUrl: undefined,
      pdfContactBlock: undefined,
    });
    listExternalInterfaceRecordsMock.mockResolvedValue([]);
    loadDefaultExternalInterfaceRecordMock.mockResolvedValue(
      createExternalInterfaceRecord({
        pdfBrandingAssetUrl: 'https://cdn.example/legacy-logo.svg',
      })
    );

    const result = await loadPublicWastePdfStaticConfig('tenant-a', {
      getDatabaseUrl: () => 'postgres://custom',
    });

    expect(result).toEqual({
      brandingAssetUrl: 'https://cdn.example/legacy-logo.svg',
    });
  });

  it('falls back to interface public config when no waste pdf settings exist yet', async () => {
    vi.stubEnv('PUBLIC_WASTE_PDF_BRANDING_ASSET_URL', '');
    vi.stubEnv('PUBLIC_WASTE_PDF_CONTACT_BLOCK', '');
    poolConnectMock.mockResolvedValue({
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
      release: vi.fn(),
    });
    repositoryMock.getWastePdfStaticSettings.mockResolvedValue(null);
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

  it('falls back to PUBLIC_WASTE_PDF_* env values when no waste or interface settings can be loaded', async () => {
    vi.stubEnv(
      'PUBLIC_WASTE_PDF_BRANDING_ASSET_URL',
      'https://www.landkreis-prignitz.de/global/wGlobal/layout/images/logos/wappen-logo.png'
    );
    vi.stubEnv('PUBLIC_WASTE_PDF_CONTACT_BLOCK', 'Abfallberatung Prignitz');
    poolConnectMock.mockResolvedValue({
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
      release: vi.fn(),
    });
    repositoryMock.getWastePdfStaticSettings.mockResolvedValue(null);
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
