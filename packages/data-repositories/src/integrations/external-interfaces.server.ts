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
    await createExternalInterfaceRepository(createExecutor(client)).upsertTypeDefinition(
      definition
    );
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
    createExternalInterfaceRepository(createExecutor(client)).getDefaultByTypeKey(
      instanceId,
      typeKey
    )
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

/** An asynchronous identity response must not overwrite a newer assignment or reactivation. */
export const saveMainserverTranslationServiceBinding = async (input: {
  connection: ExternalInterfaceRecord;
  binding: Readonly<{ issuer: string; audience: string; clientId: string; subject: string }>;
  generation: string;
  assignmentRevision: string;
  jobId: string;
  operation: string;
  hostname: string;
}): Promise<boolean> => {
  const { connection } = input;
  if (connection.typeKey !== 'sva_mainserver' || connection.ownerKind !== 'host') return false;
  return withDefaultDatabase(connection.instanceId, undefined, async (client) => {
    const scope = await client.query(
      `SELECT m.module_id FROM iam.instances i
       JOIN iam.instance_modules m ON m.instance_id=i.id AND m.module_id='app-translations'
       JOIN iam.instance_plugin_lifecycle l ON l.instance_id=m.instance_id AND l.plugin_id=m.module_id
       WHERE i.id=$1 AND i.status='active' AND i.primary_hostname=$2
         AND m.effective_active AND l.desired_generation=$3::bigint
         AND l.active_job_id=$4::uuid AND l.claimed_generation=l.desired_generation AND l.desired_operation=$5
         AND (l.access_state='active' OR ($5='reactivate' AND l.access_state='suspended'))
       FOR SHARE OF i,m,l`, [connection.instanceId, input.hostname, input.generation, input.jobId, input.operation]);
    if (!scope.rows[0]) return false;
    const result = await client.query(
      `UPDATE iam.instance_external_interfaces
       SET public_config_json=jsonb_set(public_config_json,'{translationService}',$4::jsonb), updated_at=now()
       WHERE instance_id=$1 AND id=$2 AND type_key='sva_mainserver' AND owner_kind='host'
         AND enabled AND is_default AND public_config_json=$3::jsonb AND base_url IS NOT DISTINCT FROM $5
         AND xmin::text=$6
       RETURNING id`,
      [connection.instanceId, connection.id, JSON.stringify(connection.publicConfig), JSON.stringify(input.binding), connection.baseUrl ?? null, input.assignmentRevision]);
    return result.rowCount === 1;
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

/** DeepL is configured by the tenant but available only while its module is active. */
export const saveDeepLInterfaceRecord = async (
  record: ExternalInterfaceRecord,
  expectedRevision: string
): Promise<void> => {
  if (record.typeKey !== 'deepl' || record.ownerKind !== 'host') throw new Error('invalid_config');
  await withDefaultDatabase(record.instanceId, undefined, async (client) => {
    const module = await client.query(
      `SELECT m.module_id FROM iam.instance_modules m JOIN iam.instance_plugin_lifecycle l ON l.instance_id=m.instance_id AND l.plugin_id=m.module_id WHERE m.instance_id=$1 AND m.module_id='app-translations' AND m.effective_active AND l.access_state='active' FOR SHARE OF m,l`,
      [record.instanceId]
    );
    if (!module.rows[0]) throw new Error('deepl_module_unavailable');
    const current = await client.query<{ revision: string }>(
      `SELECT public_config_json->>'revision' AS revision FROM iam.instance_external_interfaces WHERE instance_id=$1 AND id=$2 AND type_key='deepl' AND owner_kind='host' FOR UPDATE`,
      [record.instanceId, record.id]
    );
    if ((current.rows[0]?.revision ?? '0') !== expectedRevision)
      throw new Error('interface_conflict');
    await createExternalInterfaceRepository(createExecutor(client)).upsert(record);
  });
};

/** Compare the exact saved configuration before accepting an asynchronous provider response. */
export const saveDeepLInterfaceCheck = async (input: {
  instanceId: string;
  interfaceId: string;
  expectedRevision: string;
  checkedAt: string;
  languages?: readonly import('@sva/core').DeepLLanguage[];
  errorCode?: string;
}): Promise<void> =>
  withDefaultDatabase(input.instanceId, undefined, async (client) => {
    const module = await client.query(
      `SELECT m.module_id FROM iam.instance_modules m JOIN iam.instance_plugin_lifecycle l ON l.instance_id=m.instance_id AND l.plugin_id=m.module_id WHERE m.instance_id=$1 AND m.module_id='app-translations' AND m.effective_active AND l.access_state='active' FOR SHARE OF m,l`,
      [input.instanceId]
    );
    if (!module.rows[0]) throw new Error('deepl_module_unavailable');
    const result = await client.query(
      `UPDATE iam.instance_external_interfaces SET public_config_json=public_config_json || CASE WHEN $5::jsonb IS NOT NULL THEN jsonb_build_object('availableLanguages',$5::jsonb,'verifiedCredentialRevision',public_config_json->>'credentialRevision') ELSE '{}'::jsonb END,visible_status=$6,last_checked_at=$4::timestamptz,last_check_status=$7,last_check_error_code=$8,last_check_error_message=NULL,updated_at=now() WHERE instance_id=$1 AND id=$2 AND type_key='deepl' AND owner_kind='host' AND enabled AND public_config_json->>'revision'=$3 RETURNING id`,
      [
        input.instanceId,
        input.interfaceId,
        input.expectedRevision,
        input.checkedAt,
        input.languages ? JSON.stringify(input.languages) : null,
        input.errorCode ? 'error' : 'ok',
        input.errorCode ? 'failed' : 'succeeded',
        input.errorCode ?? null,
      ]
    );
    if (result.rowCount !== 1) throw new Error('interface_conflict');
  });
