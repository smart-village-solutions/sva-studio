import {
  getWasteManagementDataProfile,
  parseWasteManagementDataExchangeJson,
  wasteManagementDataProfiles,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataProfileId,
} from '@sva/core';
import { createHash } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';

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
  const files = unzipSync(source);
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error('missing_waste_data_package_manifest');
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
