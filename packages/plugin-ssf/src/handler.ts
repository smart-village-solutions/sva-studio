import { SSF_RUNTIME_LIMITS } from './constants.js';
import {
  ssfRevisionSchema,
  ssfRuntimeConfigurationSchema,
  type SsfRuntimeConfiguration,
} from './contracts.js';
import type { SsfConfigurationOverrides } from './repository.js';
import {
  resolveSsfRuntimeConfiguration,
  SsfRuntimeConfigurationValidationError,
  type SsfMediaResolver,
  type SsfTenantProfile,
} from './resolver.js';
import { addSsfConfigurationRevisions } from './revision.js';

export interface SsfRuntimeConfigurationHandlerDependencies {
  readonly readOverrides: (instanceId: string) => Promise<SsfConfigurationOverrides>;
  readonly mediaResolver: SsfMediaResolver;
}

export interface SsfRuntimeConfigurationHandlerInput {
  readonly tenant: SsfTenantProfile;
  readonly authorizationRevision: string;
}

export type SsfRuntimeConfigurationHandler = (
  input: SsfRuntimeConfigurationHandlerInput
) => Promise<SsfRuntimeConfiguration>;

export const createSsfRuntimeConfigurationHandler =
  (dependencies: SsfRuntimeConfigurationHandlerDependencies): SsfRuntimeConfigurationHandler =>
  async ({ tenant, authorizationRevision }) => {
    const parsedAuthorizationRevision = ssfRevisionSchema.safeParse(authorizationRevision);
    if (!parsedAuthorizationRevision.success) {
      throw new SsfRuntimeConfigurationValidationError(
        'The verified SSF authorization revision is invalid.'
      );
    }

    const overrides = await dependencies.readOverrides(tenant.id);
    const effectiveConfiguration = await resolveSsfRuntimeConfiguration({
      tenant,
      ...overrides,
      mediaResolver: dependencies.mediaResolver,
    });
    const response = ssfRuntimeConfigurationSchema.parse(
      addSsfConfigurationRevisions(
        effectiveConfiguration,
        parsedAuthorizationRevision.data as `sha256:${string}`
      )
    );
    const responseBytes = new TextEncoder().encode(JSON.stringify(response)).byteLength;
    if (responseBytes > SSF_RUNTIME_LIMITS.responseUtf8Bytes) {
      throw new SsfRuntimeConfigurationValidationError(
        `The SSF runtime response exceeds ${SSF_RUNTIME_LIMITS.responseUtf8Bytes} UTF-8 bytes.`
      );
    }

    return response;
  };
