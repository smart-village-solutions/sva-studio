import { assertPluginContributionAllowedKeys } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';

export type PluginJobTypeDefinition = {
  readonly jobTypeId: string;
  readonly queue: string;
  readonly displayName: string;
  readonly descriptionKey?: string;
  readonly progress?: {
    readonly phaseKeys?: readonly string[];
    readonly stepKeys?: readonly string[];
  };
  readonly result?: {
    readonly summaryKeys?: readonly (
      | 'processedItems'
      | 'acceptedItems'
      | 'rejectedItems'
      | 'skippedItems'
      | 'warningCount'
      | 'durationMs'
    )[];
    readonly detailKeys?: readonly string[];
  };
  readonly errors?: {
    readonly detailKeys?: readonly string[];
  };
};

export type PluginJobTypeRegistryEntry = {
  readonly jobTypeId: string;
  readonly namespace: string;
  readonly jobName: string;
  readonly ownerPluginId: string;
  readonly queue: string;
  readonly displayName: string;
  readonly descriptionKey?: string;
  readonly progress?: {
    readonly phaseKeys?: readonly string[];
    readonly stepKeys?: readonly string[];
  };
  readonly result?: {
    readonly summaryKeys?: readonly (
      | 'processedItems'
      | 'acceptedItems'
      | 'rejectedItems'
      | 'skippedItems'
      | 'warningCount'
      | 'durationMs'
    )[];
    readonly detailKeys?: readonly string[];
  };
  readonly errors?: {
    readonly detailKeys?: readonly string[];
  };
};

const jobTypeDefinitionAllowedKeys = new Set([
  'jobTypeId',
  'queue',
  'displayName',
  'descriptionKey',
  'progress',
  'result',
  'errors',
] as const);

const jobTypeProgressAllowedKeys = new Set(['phaseKeys', 'stepKeys'] as const);
const jobTypeResultAllowedKeys = new Set(['summaryKeys', 'detailKeys'] as const);
const jobTypeErrorAllowedKeys = new Set(['detailKeys'] as const);

const normalizeProgressKeys = (
  keys: readonly string[] | undefined
): readonly string[] | undefined => {
  if (!keys) {
    return undefined;
  }

  const normalizedKeys = keys.map((key) => normalizePluginIdentifier(key));
  if (normalizedKeys.some((key) => key.length === 0)) {
    return undefined;
  }

  return normalizedKeys.length > 0 ? normalizedKeys : undefined;
};

const normalizeSummaryKeys = (
  keys:
    | readonly (
        | 'processedItems'
        | 'acceptedItems'
        | 'rejectedItems'
        | 'skippedItems'
        | 'warningCount'
        | 'durationMs'
      )[]
    | undefined
):
  | readonly (
      | 'processedItems'
      | 'acceptedItems'
      | 'rejectedItems'
      | 'skippedItems'
      | 'warningCount'
      | 'durationMs'
    )[]
  | undefined => (keys && keys.length > 0 ? [...new Set(keys)] : undefined);

const normalizeDetailKeys = (
  keys: readonly string[] | undefined
): readonly string[] | undefined => {
  if (!keys) {
    return undefined;
  }

  const normalizedKeys = keys.map((key) => normalizePluginIdentifier(key));
  if (normalizedKeys.some((key) => key.length === 0)) {
    return undefined;
  }

  return normalizedKeys.length > 0 ? normalizedKeys : undefined;
};

const normalizeJobTypeDefinition = (
  definition: PluginJobTypeDefinition
): PluginJobTypeDefinition => ({
  ...definition,
  jobTypeId: normalizePluginIdentifier(definition.jobTypeId),
  queue: normalizePluginIdentifier(definition.queue),
  displayName: definition.displayName.trim(),
  ...(definition.descriptionKey?.trim()
    ? { descriptionKey: normalizePluginIdentifier(definition.descriptionKey) }
    : {}),
  progress: definition.progress
    ? {
        phaseKeys: normalizeProgressKeys(definition.progress.phaseKeys),
        stepKeys: normalizeProgressKeys(definition.progress.stepKeys),
      }
    : undefined,
  result: definition.result
    ? {
        summaryKeys: normalizeSummaryKeys(definition.result.summaryKeys),
        detailKeys: normalizeDetailKeys(definition.result.detailKeys),
      }
    : undefined,
  errors: definition.errors
    ? {
        detailKeys: normalizeDetailKeys(definition.errors.detailKeys),
      }
    : undefined,
});

export const definePluginJobTypes = <const TJobTypes extends readonly PluginJobTypeDefinition[]>(
  namespace: string,
  jobTypes: TJobTypes
): TJobTypes => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  const normalizedJobTypes = jobTypes.map((jobType) => {
    assertPluginContributionAllowedKeys(
      jobType,
      jobTypeDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(jobType.jobTypeId)
    );
    if (jobType.progress) {
      assertPluginContributionAllowedKeys(
        jobType.progress,
        jobTypeProgressAllowedKeys,
        normalizedNamespace,
        normalizePluginIdentifier(jobType.jobTypeId)
      );
    }
    if (jobType.result) {
      assertPluginContributionAllowedKeys(
        jobType.result,
        jobTypeResultAllowedKeys,
        normalizedNamespace,
        normalizePluginIdentifier(jobType.jobTypeId)
      );
    }
    if (jobType.errors) {
      assertPluginContributionAllowedKeys(
        jobType.errors,
        jobTypeErrorAllowedKeys,
        normalizedNamespace,
        normalizePluginIdentifier(jobType.jobTypeId)
      );
    }

    const normalizedJobType = normalizeJobTypeDefinition(jobType);
    const parsed = parseNamespacedPluginIdentifier(normalizedJobType.jobTypeId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_job_type:${normalizedJobType.jobTypeId}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_job_type_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${normalizedJobType.jobTypeId}`
      );
    }
    if (
      normalizedJobType.queue.length === 0 ||
      normalizedJobType.displayName.length === 0 ||
      (jobType.progress?.phaseKeys && normalizedJobType.progress?.phaseKeys === undefined) ||
      (jobType.progress?.stepKeys && normalizedJobType.progress?.stepKeys === undefined) ||
      (jobType.result?.detailKeys && normalizedJobType.result?.detailKeys === undefined) ||
      (jobType.errors?.detailKeys && normalizedJobType.errors?.detailKeys === undefined)
    ) {
      throw new Error(`invalid_plugin_job_type:${normalizedJobType.jobTypeId}`);
    }

    return normalizedJobType;
  });

  return normalizedJobTypes as unknown as TJobTypes;
};
