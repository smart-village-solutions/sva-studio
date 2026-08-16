import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  serializeWasteManagementDataExchangeJson,
  wasteManagementDataProfileIds,
} from '@sva/core';

import {
  collectWasteDataPackageSourceIds,
  readWasteDataPackage,
  type ParsedWasteDataPackageProfile,
} from './waste-management-data-exchange-package.server.js';

const profileId = wasteManagementDataProfileIds.fractions;
const fileName = 'fractions.json';
const profileBody = strToU8(
  serializeWasteManagementDataExchangeJson({
    profileId,
    exportedAt: '2026-08-16T09:00:00.000Z',
    records: [{ entityType: 'fraction', id: 'fraction-1', name: 'Bio', color: '#00aa00' }],
  })
);
const checksum = (body: Uint8Array): string =>
  createHash('sha256').update(body).digest('hex');
const manifestProfile = (overrides: Record<string, unknown> = {}) => ({
  profileId,
  fileName,
  sha256: checksum(profileBody),
  ...overrides,
});
const archive = (
  manifest: unknown,
  files: Record<string, Uint8Array> = { [fileName]: profileBody }
): Uint8Array =>
  zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    ...files,
  });
const packageManifest = (profiles: unknown = [manifestProfile()]) => ({
  formatVersion: '1.0.0',
  pluginId: 'waste-management',
  profiles,
});

describe('Waste data exchange package helpers', () => {
  it('reads a valid package and collects only stable string ids', () => {
    expect(readWasteDataPackage(archive(packageManifest()))).toMatchObject([
      { manifest: { profileId, fileName }, records: [{ entityType: 'fraction', id: 'fraction-1' }] },
    ]);

    const ids = collectWasteDataPackageSourceIds([
      {
        manifest: manifestProfile(),
        records: [
          { entityType: 'fraction', id: 'fraction-1' },
          { entityType: 'fraction', id: 'fraction-2' },
          { entityType: 'fraction', id: 42 },
        ],
      } as ParsedWasteDataPackageProfile,
    ]);
    expect(ids.get('fraction')).toEqual(new Set(['fraction-1', 'fraction-2']));
  });

  it('rejects missing and malformed manifests', () => {
    expect(() => readWasteDataPackage(zipSync({}))).toThrow(
      'missing_waste_data_package_manifest'
    );
    expect(() =>
      readWasteDataPackage(archive({ ...packageManifest(), formatVersion: '2.0.0' }))
    ).toThrow('invalid_waste_data_package_manifest');
    expect(() =>
      readWasteDataPackage(archive({ ...packageManifest(), pluginId: 'other' }))
    ).toThrow('invalid_waste_data_package_manifest');
    expect(() => readWasteDataPackage(archive(packageManifest(null)))).toThrow(
      'invalid_waste_data_package_manifest'
    );
  });

  it.each([
    null,
    manifestProfile({ profileId: 42 }),
    manifestProfile({ fileName: 42 }),
    manifestProfile({ sha256: 42 }),
  ])('rejects malformed profile metadata: %s', (candidate) => {
    expect(() => readWasteDataPackage(archive(packageManifest([candidate])))).toThrow(
      'invalid_waste_data_package_profile'
    );
  });

  it('rejects unknown profiles, missing files, and checksum mismatches', () => {
    expect(() =>
      readWasteDataPackage(
        archive(packageManifest([manifestProfile({ profileId: 'waste-management.unknown' })]))
      )
    ).toThrow('unknown_waste_data_profile:waste-management.unknown');
    expect(() =>
      readWasteDataPackage(archive(packageManifest(), {}))
    ).toThrow(`missing_waste_data_package_file:${fileName}`);
    expect(() =>
      readWasteDataPackage(
        archive(packageManifest([manifestProfile({ sha256: 'wrong' })]))
      )
    ).toThrow(`waste_data_package_checksum_mismatch:${fileName}`);
  });

  it('rejects invalid profile contents and duplicate profiles', () => {
    const invalidBody = strToU8('{}');
    expect(() =>
      readWasteDataPackage(
        archive(
          packageManifest([manifestProfile({ sha256: checksum(invalidBody) })]),
          { [fileName]: invalidBody }
        )
      )
    ).toThrow(`invalid_waste_data_package_file:${fileName}`);
    expect(() =>
      readWasteDataPackage(archive(packageManifest([manifestProfile(), manifestProfile()])))
    ).toThrow('duplicate_waste_data_package_profile');
  });
});
