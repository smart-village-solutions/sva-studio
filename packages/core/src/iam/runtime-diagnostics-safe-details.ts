import type { IamRuntimeSafeDetails } from './account-management-contract.js';

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const readStringArray = (value: unknown): readonly string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;

export const readSafeDetails = (
  details?: Readonly<Record<string, unknown>>
): IamRuntimeSafeDetails | undefined => {
  if (!details) {
    return undefined;
  }

  const syncError =
    typeof details.syncError === 'object' && details.syncError !== null
      ? (details.syncError as Record<string, unknown>)
      : undefined;

  const safeDetails: IamRuntimeSafeDetails = {
    reason_code: readString(details.reason_code),
    dependency: readString(details.dependency),
    schema_object: readString(details.schema_object),
    expected_migration: readString(details.expected_migration),
    actor_resolution: readString(details.actor_resolution),
    instance_id: readString(details.instance_id),
    return_to: readString(details.return_to),
    auth_flow_id: readString(details.auth_flow_id),
    recovery_step: readString(details.recovery_step),
    field: readString(details.field),
    step: readString(details.step),
    impact: readString(details.impact),
    remediation: readString(details.remediation),
    responsibility: readString(details.responsibility),
    next_check: readString(details.next_check),
    retry_class:
      details.retry_class === 'never' ||
      details.retry_class === 'safe' ||
      details.retry_class === 'conditional'
        ? details.retry_class
        : undefined,
    run_id: readString(details.run_id),
    moduleIds: readStringArray(details.moduleIds),
    errorCodes: readStringArray(details.errorCodes),
    sync_state: readString(details.sync_state) ?? readString(details.syncState),
    sync_error_code:
      readString(details.sync_error_code) ??
      readString(details.syncErrorCode) ??
      readString(syncError?.code),
  };

  return Object.values(safeDetails).some((value) => typeof value === 'string')
    ? safeDetails
    : undefined;
};
