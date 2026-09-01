import { createHash } from 'node:crypto';

import { canonicalize } from 'json-canonicalize';

import {
  ssfRuntimeConfigurationWithoutRevisionsSchema,
  type SsfRuntimeConfiguration,
  type SsfRuntimeConfigurationWithoutRevisions,
} from './contracts.js';

export const normalizeSsfConfigurationForRevision = (
  configuration: SsfRuntimeConfigurationWithoutRevisions
): SsfRuntimeConfigurationWithoutRevisions =>
  ssfRuntimeConfigurationWithoutRevisionsSchema.parse({
    ...configuration,
    localization: {
      ...configuration.localization,
      locales: [...configuration.localization.locales].sort((left, right) =>
        left.locale.localeCompare(right.locale)
      ),
    },
  });

const createRevisionFromNormalizedConfiguration = (
  configuration: SsfRuntimeConfigurationWithoutRevisions
): `sha256:${string}` => {
  const digest = createHash('sha256').update(canonicalize(configuration), 'utf8').digest('hex');
  return `sha256:${digest}`;
};

export const createSsfConfigurationRevision = (
  configuration: SsfRuntimeConfigurationWithoutRevisions
): `sha256:${string}` => {
  const normalized = normalizeSsfConfigurationForRevision(configuration);
  return createRevisionFromNormalizedConfiguration(normalized);
};

export const addSsfConfigurationRevisions = (
  configuration: SsfRuntimeConfigurationWithoutRevisions,
  authorizationRevision: `sha256:${string}`
): SsfRuntimeConfiguration => {
  const normalized = normalizeSsfConfigurationForRevision(configuration);
  return {
    ...normalized,
    configurationRevision: createRevisionFromNormalizedConfiguration(normalized),
    authorizationRevision,
  };
};
