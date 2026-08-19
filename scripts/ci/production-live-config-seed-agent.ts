const revisionPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64}|[A-Za-z0-9._/-]+@sha256:[0-9a-f]{64})$/u;
const fieldPattern = /^[a-z][A-Za-z0-9_-]{0,63}$/u;
const requiredResultFields = [
  'bytes',
  'database',
  'deployImageDigest',
  'environment',
  'objectKey',
  'requestId',
  'sha256',
  'status',
  'steps',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isSafeStringList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === 'string' && fieldPattern.test(entry));

export const matchesProductionSeedBackupAgent = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      'agentRevision',
      'protocolVersions',
      'databaseTargets',
      'resultFields',
      'wasteInventory',
    ])
  )
    return false;
  const resultFields = value.resultFields;
  return (
    typeof value.agentRevision === 'string' &&
    revisionPattern.test(value.agentRevision) &&
    Array.isArray(value.protocolVersions) &&
    value.protocolVersions.every(
      (version) => Number.isSafeInteger(version) && Number(version) > 0
    ) &&
    value.protocolVersions.includes(2) &&
    isSafeStringList(value.databaseTargets) &&
    value.databaseTargets.includes('studio') &&
    isSafeStringList(resultFields) &&
    requiredResultFields.every((field) => resultFields.includes(field)) &&
    typeof value.wasteInventory === 'boolean'
  );
};
