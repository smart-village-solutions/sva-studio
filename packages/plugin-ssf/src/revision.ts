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

export const createSsfConfigurationRevision = (
  configuration: SsfRuntimeConfigurationWithoutRevisions
): `sha256:${string}` => {
  const normalized = normalizeSsfConfigurationForRevision(configuration);
  const digest = createHash('sha256').update(canonicalize(normalized), 'utf8').digest('hex');
  return `sha256:${digest}`;
};

export const addSsfConfigurationRevisions = (
  configuration: SsfRuntimeConfigurationWithoutRevisions,
  authorizationRevision: `sha256:${string}`
): SsfRuntimeConfiguration => ({
  ...normalizeSsfConfigurationForRevision(configuration),
  configurationRevision: createSsfConfigurationRevision(configuration),
  authorizationRevision,
});
