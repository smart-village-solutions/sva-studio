import {
  getWasteManagementDataProfile,
  parseWasteManagementDataExchangeJson,
  wasteManagementDataProfiles,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataProfileId,
} from '@sva/core';
import { createHash } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';

const MEBIBYTE = 1024 * 1024;

export const wasteDataPackageLimits = {
  maxCompressedBytes: 16 * MEBIBYTE,
  maxEntries: 10,
  maxEntryBytes: 16 * MEBIBYTE,
  maxManifestBytes: 256 * 1024,
  maxUncompressedBytes: 64 * MEBIBYTE,
} as const;

export type ParsedWasteDataPackageProfile = Readonly<{
  manifest: Readonly<{
    profileId: WasteManagementDataProfileId;
    fileName: string;
    sha256: string;
  }>;
  records: readonly WasteManagementDataExchangeRecord[];
}>;

const parsePackageProfile = (
  raw: unknown,
  files: Record<string, Uint8Array>
): ParsedWasteDataPackageProfile => {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_waste_data_package_profile');
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.profileId !== 'string' || typeof candidate.fileName !== 'string' || typeof candidate.sha256 !== 'string') {
    throw new Error('invalid_waste_data_package_profile');
  }
  const profileId = candidate.profileId as WasteManagementDataProfileId;
  if (!getWasteManagementDataProfile(profileId)) throw new Error(`unknown_waste_data_profile:${profileId}`);
  const profileBytes = files[candidate.fileName];
  if (!profileBytes) throw new Error(`missing_waste_data_package_file:${candidate.fileName}`);
  const checksum = createHash('sha256').update(profileBytes).digest('hex');
  if (checksum !== candidate.sha256) throw new Error(`waste_data_package_checksum_mismatch:${candidate.fileName}`);
  const parsed = parseWasteManagementDataExchangeJson(strFromU8(profileBytes), { applyDefaults: false });
  if (!parsed.ok || parsed.envelope.profileId !== profileId) throw new Error(`invalid_waste_data_package_file:${candidate.fileName}`);
  return {
    manifest: { profileId, fileName: candidate.fileName, sha256: candidate.sha256 },
    records: parsed.envelope.records,
  };
};

export const readWasteDataPackage = (
  source: Uint8Array
): readonly ParsedWasteDataPackageProfile[] => {
  if (source.byteLength > wasteDataPackageLimits.maxCompressedBytes) {
    throw new Error('waste_data_package_compressed_size_limit_exceeded');
  }
  let entryCount = 0;
  let totalUncompressedBytes = 0;
  const entryNames = new Set<string>();
  const files = unzipSync(source, {
    filter: (entry) => {
      entryCount += 1;
      totalUncompressedBytes += entry.originalSize;
      if (entryCount > wasteDataPackageLimits.maxEntries) {
        throw new Error('waste_data_package_entry_count_limit_exceeded');
      }
      if (entry.originalSize > wasteDataPackageLimits.maxEntryBytes) {
        throw new Error(`waste_data_package_entry_size_limit_exceeded:${entry.name}`);
      }
      if (totalUncompressedBytes > wasteDataPackageLimits.maxUncompressedBytes) {
        throw new Error('waste_data_package_uncompressed_size_limit_exceeded');
      }
      if (!/^[A-Za-z0-9._-]+$/.test(entry.name) || entryNames.has(entry.name)) {
        throw new Error(`invalid_waste_data_package_entry:${entry.name}`);
      }
      entryNames.add(entry.name);
      return true;
    },
  });
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error('missing_waste_data_package_manifest');
  if (manifestBytes.byteLength > wasteDataPackageLimits.maxManifestBytes) {
    throw new Error('waste_data_package_manifest_size_limit_exceeded');
  }
  const manifest = JSON.parse(strFromU8(manifestBytes)) as {
    formatVersion?: unknown;
    pluginId?: unknown;
    profiles?: unknown;
  };
  if (manifest.formatVersion !== '1.0.0' || manifest.pluginId !== 'waste-management' || !Array.isArray(manifest.profiles)) {
    throw new Error('invalid_waste_data_package_manifest');
  }
  const profiles = manifest.profiles.map((raw) => parsePackageProfile(raw, files));
  if (new Set(profiles.map(({ manifest: profile }) => profile.profileId)).size !== profiles.length) {
    throw new Error('duplicate_waste_data_package_profile');
  }
  const profileOrder = new Map(wasteManagementDataProfiles.map((profile, index) => [profile.profileId, index]));
  return profiles.sort((left, right) =>
    (profileOrder.get(left.manifest.profileId) ?? Number.MAX_SAFE_INTEGER) -
    (profileOrder.get(right.manifest.profileId) ?? Number.MAX_SAFE_INTEGER)
  );
};

export const collectWasteDataPackageSourceIds = (
  profiles: readonly ParsedWasteDataPackageProfile[]
): ReadonlyMap<string, ReadonlySet<string>> => {
  const sourceIds = new Map<string, Set<string>>();
  for (const { records } of profiles) {
    for (const record of records) {
      if (typeof record.id !== 'string') continue;
      const ids = sourceIds.get(record.entityType) ?? new Set<string>();
      ids.add(record.id);
      sourceIds.set(record.entityType, ids);
    }
  }
  return sourceIds;
};
