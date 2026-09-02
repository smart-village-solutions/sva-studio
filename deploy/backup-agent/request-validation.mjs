const maxRequestLifetimeMs = 10 * 60_000;
const requestIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/u;
const maintenanceWindowPattern = /^[A-Za-z0-9][A-Za-z0-9._:/# -]{2,159}$/u;
const imageDigestPattern = /^sha256:[a-f0-9]{64}$/u;
const sourceSha256Pattern = /^[a-f0-9]{64}$/u;
const tenantInstanceIdPattern = /^[a-z0-9][a-z0-9-]{1,62}$/u;
const dumpObjectKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{7,511}\.dump$/u;
const sqlObjectKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{7,511}\.sql$/u;

/** @typedef {'shape' | 'keys' | 'version-action' | 'environment' | 'database-tenant' | 'request-id' | 'maintenance-window' | 'digest' | 'waste-import' | 'object-key' | 'expiry'} ValidationBoundary */
/** @typedef {{ readonly ok: true }} ValidationSuccess */
/** @typedef {{ readonly ok: false, readonly boundary: ValidationBoundary }} ValidationFailure */
/** @typedef {ValidationSuccess | ValidationFailure} ValidationResult */

/** @type {ValidationSuccess} */
const validationSuccess = Object.freeze({ ok: true });

/** @param {ValidationBoundary} boundary @returns {ValidationFailure} */
const validationFailure = (boundary) => ({ ok: false, boundary });

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRequestObject = (value) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** @param {Record<string, unknown>} request @param {ReadonlySet<string>} allowedKeys */
const hasOnlyAllowedKeys = (request, allowedKeys) =>
  !Object.keys(request).some((key) => !allowedKeys.has(key));

/** @param {unknown} value */
export const validTenantInstanceId = (value) =>
  typeof value === 'string' && tenantInstanceIdPattern.test(value);

/** @param {unknown} value @param {RegExp} pattern */
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);

/** @param {unknown} value */
const parseExpiry = (value) => (typeof value === 'string' ? Date.parse(value) : Number.NaN);

/** @param {unknown} expiresAtValue @param {number} now @returns {ValidationResult} */
const validateExpiry = (expiresAtValue, now) => {
  const expiresAt = parseExpiry(expiresAtValue);
  const withinLifetime = [
    Number.isFinite(expiresAt),
    expiresAt > now,
    expiresAt <= now + maxRequestLifetimeMs,
  ].every(Boolean);
  return withinLifetime ? validationSuccess : validationFailure('expiry');
};

/** @param {Array<() => ValidationResult>} validations @returns {ValidationResult} */
const firstFailure = (validations) => {
  for (const validate of validations) {
    const result = validate();
    if (!result.ok) return result;
  }
  return validationSuccess;
};

const backupKeys = new Set([
  'action',
  'database',
  'deployImageDigest',
  'environment',
  'expiresAt',
  'tenantInstanceId',
  'requestId',
  'version',
]);
const backupV1Keys = new Set([...backupKeys, 'maintenanceWindowReference']);

/** @param {Record<string, unknown>} request @returns {ValidationResult} */
const validateBackupVersionAndAction = (request) =>
  (request.version === 1 || request.version === 2) && request.action === 'backup-and-verify'
    ? validationSuccess
    : validationFailure('version-action');

/** @param {Record<string, unknown>} request @returns {ValidationResult} */
const validateEnvironment = (request) =>
  request.environment === 'staging' || request.environment === 'prod'
    ? validationSuccess
    : validationFailure('environment');

/** @param {unknown} database */
const validDatabase = (database) => [undefined, 'ssf', 'studio', 'waste'].includes(database);

/** @param {unknown} tenantInstanceId @param {boolean} tenantRequired */
const validateWasteTenant = (tenantInstanceId, tenantRequired) => {
  if (tenantInstanceId === undefined) {
    return tenantRequired ? validationFailure('database-tenant') : validationSuccess;
  }
  return validTenantInstanceId(tenantInstanceId)
    ? validationSuccess
    : validationFailure('database-tenant');
};

/** @param {Record<string, unknown>} request @param {boolean} tenantRequiredForWaste */
const validateDatabaseTenantBinding = (request, tenantRequiredForWaste) => {
  if (request.database === 'waste') {
    return validateWasteTenant(request.tenantInstanceId, tenantRequiredForWaste);
  }
  return request.tenantInstanceId === undefined
    ? validationSuccess
    : validationFailure('database-tenant');
};

/** @param {Record<string, unknown>} request @param {boolean} tenantRequiredForWaste @returns {ValidationResult} */
const validateDatabaseAndTenant = (request, tenantRequiredForWaste) => {
  if (!validDatabase(request.database)) return validationFailure('database-tenant');
  return validateDatabaseTenantBinding(request, tenantRequiredForWaste);
};

/**
 * @param {unknown} candidate
 * @param {number} [now]
 * @returns {ValidationResult}
 */
export const validateBackupRequest = (candidate, now = Date.now()) => {
  if (!isRequestObject(candidate)) return validationFailure('shape');
  const allowedKeys = candidate.version === 1 ? backupV1Keys : backupKeys;
  return firstFailure([
    () =>
      hasOnlyAllowedKeys(candidate, allowedKeys) ? validationSuccess : validationFailure('keys'),
    () => validateBackupVersionAndAction(candidate),
    () => validateEnvironment(candidate),
    () => validateDatabaseAndTenant(candidate, false),
    () =>
      matches(candidate.requestId, requestIdPattern)
        ? validationSuccess
        : validationFailure('request-id'),
    () =>
      matches(candidate.deployImageDigest, imageDigestPattern)
        ? validationSuccess
        : validationFailure('digest'),
    () => validateExpiry(candidate.expiresAt, now),
    () =>
      candidate.version === 2 ||
      candidate.environment !== 'prod' ||
      matches(candidate.maintenanceWindowReference, maintenanceWindowPattern)
        ? validationSuccess
        : validationFailure('maintenance-window'),
  ]);
};

const restoreKeys = new Set([
  'action',
  'database',
  'environment',
  'expiresAt',
  'maintenanceWindowReference',
  'requestId',
  'sourceObjectKey',
  'sourceSha256',
  'tenantInstanceId',
  'version',
]);

/**
 * @typedef {{
 *   readonly objectKey: string,
 *   readonly sha256: string,
 *   readonly environment: 'prod',
 *   readonly database: 'waste',
 *   readonly tenantInstanceId: string
 * }} WasteImportContract
 */

/**
 * @typedef {{
 *   readonly environmentPrefixes: Readonly<Record<'staging' | 'prod', string>>,
 *   readonly wasteImport: WasteImportContract
 * }} RestoreValidationContract
 */

/** @param {Record<string, unknown>} request @returns {ValidationResult} */
const validateRestoreVersionAndAction = (request) =>
  request.version === 1 &&
  (request.action === 'restore-and-verify-v1' || request.action === 'import-waste-data-v1')
    ? validationSuccess
    : validationFailure('version-action');

/** @param {Record<string, unknown>} request @param {WasteImportContract} contract @returns {ValidationResult} */
const validateWasteImportContract = (request, contract) => {
  if (request.action !== 'import-waste-data-v1') return validationSuccess;
  const expectedValues = {
    environment: contract.environment,
    database: contract.database,
    tenantInstanceId: contract.tenantInstanceId,
    sourceObjectKey: contract.objectKey,
    sourceSha256: contract.sha256,
  };
  return Object.entries(expectedValues).every(([key, value]) => request[key] === value)
    ? validationSuccess
    : validationFailure('waste-import');
};

/** @param {Record<string, unknown>} request @param {RestoreValidationContract} contract */
const restoreObjectPrefix = (request, contract) => {
  const environment = /** @type {'staging' | 'prod'} */ (request.environment);
  const environmentPrefix = contract.environmentPrefixes[environment];
  if (request.database === 'ssf') return `${environmentPrefix}/ssf/`;
  if (request.database !== 'waste') return `${environmentPrefix}/`;
  const importPrefix = request.action === 'import-waste-data-v1' ? 'import/' : '';
  return `${environmentPrefix}/waste/${request.tenantInstanceId}/${importPrefix}`;
};

/**
 * @param {Record<string, unknown>} request
 * @param {RestoreValidationContract} contract
 * @returns {ValidationResult}
 */
const validateRestoreObjectKey = (request, contract) => {
  const isWasteImport = request.action === 'import-waste-data-v1';
  const prefix = restoreObjectPrefix(request, contract);
  const pattern = isWasteImport ? sqlObjectKeyPattern : dumpObjectKeyPattern;
  if (typeof request.sourceObjectKey !== 'string') return validationFailure('object-key');
  const allowed = [
    request.sourceObjectKey.startsWith(prefix),
    pattern.test(request.sourceObjectKey),
    !request.sourceObjectKey.includes('..'),
  ].every(Boolean);
  return allowed ? validationSuccess : validationFailure('object-key');
};

/**
 * @param {unknown} candidate
 * @param {RestoreValidationContract} contract
 * @param {number} [now]
 * @returns {ValidationResult}
 */
export const validateRestoreRequest = (candidate, contract, now = Date.now()) => {
  if (!isRequestObject(candidate)) return validationFailure('shape');
  return firstFailure([
    () =>
      hasOnlyAllowedKeys(candidate, restoreKeys) ? validationSuccess : validationFailure('keys'),
    () => validateRestoreVersionAndAction(candidate),
    () => validateEnvironment(candidate),
    () => validateDatabaseAndTenant(candidate, true),
    () =>
      matches(candidate.requestId, requestIdPattern)
        ? validationSuccess
        : validationFailure('request-id'),
    () =>
      matches(candidate.maintenanceWindowReference, maintenanceWindowPattern)
        ? validationSuccess
        : validationFailure('maintenance-window'),
    () =>
      matches(candidate.sourceSha256, sourceSha256Pattern)
        ? validationSuccess
        : validationFailure('digest'),
    () => validateWasteImportContract(candidate, contract.wasteImport),
    () => validateRestoreObjectKey(candidate, contract),
    () => validateExpiry(candidate.expiresAt, now),
  ]);
};
