import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceTypeDefinition,
} from '@sva/core';

import { createExternalInterfaceRepository } from './external-interfaces.js';
import { createExecutor, withIamDb } from './external-interfaces.db.js';

const resolveDatabaseUrl = (getDatabaseUrl?: () => string | undefined) =>
  getDatabaseUrl ?? (() => process.env.IAM_DATABASE_URL);

const withDefaultDatabase = <T>(
  instanceId: string,
  getDatabaseUrl: (() => string | undefined) | undefined,
  work: Parameters<typeof withIamDb<T>>[1]
) =>
  withIamDb(
    {
      instanceId,
      getDatabaseUrl: resolveDatabaseUrl(getDatabaseUrl),
    },
    work
  );

export const listExternalInterfaceTypeDefinitions = async (
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<readonly ExternalInterfaceTypeDefinition[]> =>
  withDefaultDatabase('default', options.getDatabaseUrl, async (client) =>
    createExternalInterfaceRepository(createExecutor(client)).listTypeDefinitions()
  );

export const saveExternalInterfaceTypeDefinition = async (
  definition: ExternalInterfaceTypeDefinition,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<void> => {
  await withDefaultDatabase('default', options.getDatabaseUrl, async (client) => {
    await createExternalInterfaceRepository(createExecutor(client)).upsertTypeDefinition(definition);
  });
};

export const listExternalInterfaceRecords = async (
  instanceId: string,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<readonly ExternalInterfaceRecord[]> =>
  withDefaultDatabase(instanceId, options.getDatabaseUrl, async (client) =>
    createExternalInterfaceRepository(createExecutor(client)).listByInstanceId(instanceId)
  );

export const loadExternalInterfaceRecordById = async (
  instanceId: string,
  id: string,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<ExternalInterfaceRecord | null> =>
  withDefaultDatabase(instanceId, options.getDatabaseUrl, async (client) =>
    createExternalInterfaceRepository(createExecutor(client)).getById(instanceId, id)
  );

export const loadExternalInterfaceRecordByAlias = async (
  instanceId: string,
  typeKey: string,
  alias: string,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<ExternalInterfaceRecord | null> =>
  withDefaultDatabase(instanceId, options.getDatabaseUrl, async (client) =>
    createExternalInterfaceRepository(createExecutor(client)).getByAlias(instanceId, typeKey, alias)
  );

export const loadDefaultExternalInterfaceRecord = async (
  instanceId: string,
  typeKey: string,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<ExternalInterfaceRecord | null> =>
  withDefaultDatabase(instanceId, options.getDatabaseUrl, async (client) =>
    createExternalInterfaceRepository(createExecutor(client)).getDefaultByTypeKey(instanceId, typeKey)
  );

export const saveExternalInterfaceRecord = async (
  record: ExternalInterfaceRecord,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<void> => {
  await withDefaultDatabase(record.instanceId, options.getDatabaseUrl, async (client) => {
    await createExternalInterfaceRepository(createExecutor(client)).upsert(record);
  });
};

export const deleteExternalInterfaceRecord = async (
  instanceId: string,
  id: string,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<boolean> =>
  withDefaultDatabase(instanceId, options.getDatabaseUrl, async (client) =>
    createExternalInterfaceRepository(createExecutor(client)).deleteById(instanceId, id)
  );

export const saveExternalInterfaceConnectionCheck = async (
  check: ExternalInterfaceConnectionCheckRecord,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<void> => {
  await withDefaultDatabase(check.instanceId, options.getDatabaseUrl, async (client) => {
    await createExternalInterfaceRepository(createExecutor(client)).updateConnectionCheck(check);
  });
};
