import { describe, expect, it } from 'vitest';

import {
  buildWasteManagementPublicConfig,
  findSelectedWasteManagementInterfaceRecord,
  isWasteManagementInterfaceSelected,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
} from './waste-management-settings-public-config.js';
import type { ExternalInterfaceRecord } from './external-interfaces-contract.js';

const createInterfaceRecord = (
  input: Partial<ExternalInterfaceRecord> & Pick<ExternalInterfaceRecord, 'id' | 'typeKey'>
): ExternalInterfaceRecord => ({
  id: input.id,
  instanceId: input.instanceId ?? 'tenant-a',
  typeKey: input.typeKey,
  ownerKind: input.ownerKind ?? 'host',
  ownerId: input.ownerId ?? 'host',
  displayName: input.displayName ?? input.id,
  alias: input.alias ?? input.id,
  enabled: input.enabled ?? true,
  isDefault: input.isDefault ?? false,
  category: input.category ?? 'database',
  statusCheckKind: input.statusCheckKind ?? 'supabase',
  visibleStatus: input.visibleStatus ?? 'ok',
  publicConfig: input.publicConfig ?? {},
  secretConfigCiphertext: input.secretConfigCiphertext,
});

describe('waste-management-settings-public-config', () => {
  it('prefers the selected waste interface and falls back to default or generic supabase records', () => {
    const selectedSupabase = createInterfaceRecord({
      id: 'supabase-selected',
      typeKey: 'supabase',
      publicConfig: { wasteManagementSelected: true },
    });
    const defaultSupabase = createInterfaceRecord({
      id: 'supabase-default',
      typeKey: 'supabase',
      isDefault: true,
    });
    const genericSupabase = createInterfaceRecord({
      id: 'supabase-generic',
      typeKey: 'supabase',
    });
    const objectStorage = createInterfaceRecord({
      id: 's3-1',
      typeKey: 's3',
      category: 'object_storage',
      statusCheckKind: 's3',
    });

    expect(isWasteManagementInterfaceSelected(selectedSupabase)).toBe(true);
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage, defaultSupabase, selectedSupabase])?.id).toBe(
      'supabase-selected'
    );
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage, defaultSupabase])?.id).toBe('supabase-default');
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage, genericSupabase])?.id).toBe('supabase-generic');
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage])).toBeNull();
  });

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

  it('reads and clears holiday sync metadata fields', () => {
    const next = buildWasteManagementPublicConfig(
      {},
      {
        selected: false,
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
        lastSuccessfulHolidaySyncAt: '2026-05-10T10:00:00.000Z',
      }
    );

    expect(readWasteManagementHolidayStateCode(next)).toBe('NW');
    expect(readWasteManagementHolidaySyncStatus(next)).toBe('success');
    expect(readWasteManagementLastSuccessfulHolidaySyncAt(next)).toBe('2026-05-10T10:00:00.000Z');

    const cleared = buildWasteManagementPublicConfig(next, {
      selected: false,
    });

    expect(readWasteManagementHolidayStateCode(cleared)).toBeUndefined();
    expect(readWasteManagementHolidaySyncStatus(cleared)).toBeUndefined();
    expect(readWasteManagementLastSuccessfulHolidaySyncAt(cleared)).toBeUndefined();
  });
});
