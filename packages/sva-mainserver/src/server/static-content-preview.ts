import {
  appConfigurationSelectionSchema,
  type AppConfigurationPreview,
  type AppConfigurationSelection,
  type LoadedAppConfigurationPreview,
} from '../app-configuration-preview.js';
import { toSvaMainserverError } from './service-internals/shared.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readField = (root: Record<string, unknown>, path: readonly string[]): unknown => {
  let value: unknown = root;
  for (const key of path) {
    if (!isObject(value)) return null;
    if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
    value = value[key];
  }
  return value;
};

const readRecord = (file: Record<string, unknown>): LoadedAppConfigurationPreview['record'] => {
  const version = file.version === '' ? null : file.version;
  const validId =
    typeof file.id === 'string'
      ? file.id.length > 0
      : typeof file.id === 'number' && Number.isSafeInteger(file.id) && file.id > 0;
  if (
    !validId ||
    typeof file.name !== 'string' ||
    !/^globalsettings$/i.test(file.name) ||
    file.dataType !== 'json' ||
    !(version === null || typeof version === 'string')
  )
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'app_configuration_metadata_invalid',
      statusCode: 502,
    });
  return { id: String(file.id), name: file.name, version };
};

/** Read-only projection. No foreign content or raw JSON crosses the host boundary. */
export const projectAppConfigurationPreview = (
  file: unknown,
  instanceId: string,
  selection: AppConfigurationSelection
): AppConfigurationPreview => {
  const parsed = appConfigurationSelectionSchema.safeParse(selection);
  if (!parsed.success)
    throw toSvaMainserverError({
      code: 'invalid_config',
      message: 'app_configuration_selection_invalid',
      statusCode: 400,
    });
  if (!isObject(file) || file.id === null || file.id === undefined)
    return { status: 'unavailable', reason: 'not_resolved' };
  const record = readRecord(file);
  let document: unknown = file.content;
  // The resolver decodes every versioned request, including unversioned fallbacks.
  // A returned string may be a decoded JSON scalar; never guess a second parse.
  if (typeof document === 'string' && parsed.data.version === null) {
    try {
      document = JSON.parse(document);
    } catch {
      return { status: 'unavailable', reason: 'invalid_document' };
    }
  }
  if (!isObject(document)) return { status: 'unavailable', reason: 'invalid_document' };
  const alternative = readField(document, [
    'settings',
    'locationService',
    'showAlternativeLocationButton',
  ]);
  const lines = readField(document, ['appDesignSystem', 'serviceTiles', 'numberOfLines']);
  return {
    status: 'loaded',
    instanceId,
    requestedVersion: parsed.data.version,
    record,
    fallback: record.version !== parsed.data.version,
    fields: {
      alternativeLocation:
        alternative === undefined
          ? { state: 'missing' }
          : typeof alternative === 'boolean'
            ? { state: 'value', value: alternative }
            : { state: 'unsupported' },
      tileTitleLines:
        lines === undefined
          ? { state: 'missing' }
          : typeof lines === 'number' && Number.isSafeInteger(lines) && lines > 0
            ? { state: 'value', value: lines }
            : { state: 'unsupported' },
    },
  };
};
