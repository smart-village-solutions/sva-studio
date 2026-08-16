import { describe, expect, it } from 'vitest';

import {
  parseWasteManagementDataExchangeJson,
  serializeWasteManagementDataExchangeJson,
} from './waste-management-data-exchange-json.js';
import {
  wasteManagementDataProfileIds,
  type WasteManagementDataFieldValueType,
} from './waste-management-data-exchange.js';
import { wasteManagementDataProfiles } from './waste-management-data-profiles.js';

const exportedAt = '2026-08-16T09:00:00.000Z';

const exampleValue = (valueType: WasteManagementDataFieldValueType, key: string): unknown => {
  switch (valueType) {
    case 'boolean':
      return true;
    case 'date':
      return '2026-08-16';
    case 'integer':
      return 7;
    case 'number':
      return 7.5;
    case 'object':
      return {};
    case 'string':
      return `${key}-value`;
    case 'string-array':
      return [`${key}-value`];
  }
};

describe('Waste data exchange JSON', () => {
  it('roundtrips an individual profile with deterministic defaults and nulls', () => {
    const serialized = serializeWasteManagementDataExchangeJson({
      profileId: wasteManagementDataProfileIds.fractions,
      exportedAt,
      records: [
        {
          entityType: 'fraction',
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#112233',
          createdAt: 'sensitive-target-metadata',
        },
      ],
    });

    expect(serialized).not.toContain('createdAt');
    expect(JSON.parse(serialized)).toMatchObject({
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: wasteManagementDataProfileIds.fractions,
      records: [
        {
          entityType: 'fraction',
          id: 'fraction-1',
          active: true,
          pdfShortLabel: null,
          reminderConfig: {
            reminderCount: 'none',
            channels: { push: false, email: false, calendar: false },
          },
        },
      ],
    });
    expect(parseWasteManagementDataExchangeJson(serialized)).toMatchObject({ ok: true });
  });

  it('applies defaults on create but preserves missing values on update', () => {
    const envelope = {
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: wasteManagementDataProfileIds.fractions,
      exportedAt,
      records: [{ entityType: 'fraction', id: 'fraction-1', name: 'Bio', color: '#00aa00' }],
    };

    const createResult = parseWasteManagementDataExchangeJson(envelope);
    expect(createResult).toMatchObject({
      ok: true,
      envelope: { records: [{ active: true }] },
    });
    expect(createResult.ok && createResult.defaultedFields).toEqual([
      'records[0].active',
      'records[0].reminderConfig',
    ]);

    const updateResult = parseWasteManagementDataExchangeJson(envelope, { applyDefaults: false });
    expect(updateResult.ok && updateResult.envelope.records[0]).not.toHaveProperty('active');
  });

  it('rejects excluded subscriber-style and technical fields', () => {
    const result = parseWasteManagementDataExchangeJson({
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: wasteManagementDataProfileIds.fractions,
      exportedAt,
      records: [
        {
          entityType: 'fraction',
          id: 'fraction-1',
          name: 'Bio',
          color: '#00aa00',
          createdAt: '2026-08-16T09:00:00.000Z',
          consentAcceptedAt: '2026-08-16T09:00:00.000Z',
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: 'excluded_field', path: 'records[0].createdAt' },
        { code: 'unknown_field', path: 'records[0].consentAcceptedAt' },
      ],
    });
  });

  it('rejects a wrong profile version and duplicate stable ids', () => {
    expect(
      parseWasteManagementDataExchangeJson({
        formatVersion: '2.0.0',
        pluginId: 'waste-management',
        profileId: wasteManagementDataProfileIds.fractions,
        exportedAt,
        records: [],
      })
    ).toMatchObject({ ok: false, issues: [{ code: 'unsupported_format_version' }] });

    const record = { entityType: 'region', id: 'region-1', name: 'Nord' };
    expect(
      parseWasteManagementDataExchangeJson({
        formatVersion: '1.0.0',
        pluginId: 'waste-management',
        profileId: wasteManagementDataProfileIds.geographyCollectionLocations,
        exportedAt,
        records: [record, record],
      })
    ).toMatchObject({ ok: false, issues: [{ code: 'duplicate_record' }] });
  });

  it('rejects malformed, incomplete, and unsupported envelopes deterministically', () => {
    expect(parseWasteManagementDataExchangeJson('{')).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid_envelope', path: '$', message: 'Ungültiges JSON.' }],
    });
    expect(parseWasteManagementDataExchangeJson(null)).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid_envelope', message: 'JSON-Envelope fehlt.' }],
    });
    expect(parseWasteManagementDataExchangeJson({ formatVersion: '1.0.0' })).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid_envelope', message: 'JSON-Envelope ist unvollständig.' }],
    });
    expect(
      parseWasteManagementDataExchangeJson({
        formatVersion: '1.0.0',
        pluginId: 'waste-management',
        profileId: 'waste-management.unknown',
        exportedAt,
        records: [],
      })
    ).toMatchObject({ ok: false, issues: [{ code: 'unsupported_profile' }] });
  });

  it('rejects unsupported serializer profiles, entities, and incomplete required data', () => {
    expect(() =>
      serializeWasteManagementDataExchangeJson({
        profileId: 'waste-management.unknown' as never,
        exportedAt,
        records: [],
      })
    ).toThrow('unknown_waste_data_profile:waste-management.unknown');
    expect(() =>
      serializeWasteManagementDataExchangeJson({
        profileId: wasteManagementDataProfileIds.fractions,
        exportedAt,
        records: [{ entityType: 'unknown' } as never],
      })
    ).toThrow('unknown_waste_entity:unknown');
    expect(() =>
      serializeWasteManagementDataExchangeJson({
        profileId: wasteManagementDataProfileIds.fractions,
        exportedAt,
        records: [{ entityType: 'fraction', id: 'fraction-1' }],
      })
    ).toThrow('invalid_waste_data_exchange:records[0].name');
  });

  it.each(wasteManagementDataProfiles)(
    'roundtrips every offered JSON profile: $profileId',
    (profile) => {
      const records = profile.entities.flatMap((entity) => {
        if (entity.fields.some((field) => field.key === '*')) return [];
        return [
          Object.fromEntries([
            ['entityType', entity.entityType],
            ...entity.fields.flatMap((field) =>
              field.transfer === 'included' && field.input.kind === 'required'
                ? [[field.key, exampleValue(field.valueType, field.key)] as const]
                : []
            ),
          ]),
        ];
      });

      const serialized = serializeWasteManagementDataExchangeJson({
        profileId: profile.profileId,
        exportedAt,
        records,
      });
      const parsed = parseWasteManagementDataExchangeJson(serialized);

      expect(parsed).toMatchObject({ ok: true });
      if (!parsed.ok) return;
      expect(
        serializeWasteManagementDataExchangeJson({
          profileId: profile.profileId,
          exportedAt,
          records: parsed.envelope.records,
        })
      ).toBe(serialized);
    }
  );
});
