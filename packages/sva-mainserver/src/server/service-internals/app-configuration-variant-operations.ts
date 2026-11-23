import { z } from 'zod';
import {
  appConfigurationIdSchema,
  canCopyAppConfigurationName,
  normalizeAppConfigurationVersion,
  type AppConfigurationDocument,
  type AppConfigurationRecord,
  type AppConfigurationVariantCommand,
  type AppConfigurationVariantResult,
} from '../../app-configuration.js';
import {
  svaMainserverCopyStaticJsonDocument,
  svaMainserverDeleteStaticJsonDocument,
} from '../../generated/static-content.js';

type Source = AppConfigurationRecord & { revision: string; content: string | null };
type Operations = {
  read: (id: string) => Promise<Source | null>;
  list: () => Promise<AppConfigurationRecord[]>;
  mutate: (
    operationName: string,
    document: string,
    variables: Record<string, string | null>
  ) => Promise<unknown>;
  project: (entry: Source) => AppConfigurationDocument;
};

const copyResponse = z.object({
  createOrUpdateStaticContent: z.object({ id: appConfigurationIdSchema }),
});
const deleteResponse = z.object({
  destroyRecord: z.object({
    id: z.number().int().positive().transform(String),
    statusCode: z.literal(200),
  }),
});

const hasTargetVersion = (
  records: AppConfigurationRecord[],
  name: string,
  version: string | null
) =>
  records.some((record) => {
    if (record.name.toLowerCase() !== name) return false;
    if (version === null) return !record.version?.trim();
    return (
      record.version !== null &&
      normalizeAppConfigurationVersion(record.version) === normalizeAppConfigurationVersion(version)
    );
  });

const isJson = (content: string): boolean => {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
};

async function copy(
  ops: Operations,
  source: Source,
  version: string | null
): Promise<AppConfigurationVariantResult> {
  if (
    !canCopyAppConfigurationName(source.name) ||
    source.content === null ||
    !isJson(source.content)
  )
    return { status: 'unsupported' };
  if (hasTargetVersion(await ops.list(), source.name, version)) return { status: 'exists' };
  const response = await ops.mutate(
    'SvaMainserverCopyStaticJson',
    svaMainserverCopyStaticJsonDocument,
    {
      name: source.name,
      content: source.content,
      version,
    }
  );
  const { id } = copyResponse.parse(response).createOrUpdateStaticContent;
  if (id === source.id) return { status: 'unconfirmed' };
  const result = await ops.read(id);
  if (
    result?.name !== source.name ||
    result.version !== version ||
    result.content !== source.content
  )
    return { status: 'unconfirmed' };
  return { status: 'created', document: ops.project(result) };
}

async function remove(ops: Operations, id: string): Promise<AppConfigurationVariantResult> {
  const response = await ops.mutate(
    'SvaMainserverDeleteStaticJson',
    svaMainserverDeleteStaticJsonDocument,
    { id }
  );
  if (deleteResponse.parse(response).destroyRecord.id !== id) return { status: 'unconfirmed' };
  return { status: (await ops.read(id)) === null ? 'deleted' : 'unconfirmed' };
}

export async function changeAppConfigurationVariant(
  ops: Operations,
  command: AppConfigurationVariantCommand
): Promise<AppConfigurationVariantResult> {
  const source = await ops.read(command.id);
  if (!source) return { status: 'missing' };
  if (source.revision !== command.revision) return { status: 'stale' };
  try {
    return command.operation === 'create'
      ? await copy(ops, source, command.version)
      : await remove(ops, source.id);
  } catch {
    return { status: 'unconfirmed' };
  }
}
