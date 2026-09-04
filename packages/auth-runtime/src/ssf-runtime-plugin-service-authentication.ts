import type {
  PluginServiceAuthenticationResult,
  PluginServerHandlerDispatcherDependencies,
} from './plugin-server-handlers/dispatcher.js';
import { readBearerToken } from './service-token.js';
import {
  hasExpectedSsfDescriptorContract,
  type SsfRuntimeErrorCode,
} from './ssf-runtime-plugin-service-contract.js';
import {
  createSsfRuntimeErrorResponse,
  recordSsfRuntimeDecision,
} from './ssf-runtime-plugin-service-observability.js';
import type { SsfRuntimeServiceAuthentication } from './ssf-runtime-service-token.js';

export const createSsfRuntimeAuthenticateService =
  (input: {
    readonly authenticateToken: (token: string) => Promise<SsfRuntimeServiceAuthentication>;
    readonly auditDenial: (input: {
      readonly request: Request;
      readonly reasonCode: SsfRuntimeErrorCode;
    }) => Promise<void>;
  }): NonNullable<PluginServerHandlerDispatcherDependencies['authenticateService']> =>
  async ({ request, descriptor, serviceId }): Promise<PluginServiceAuthenticationResult> => {
    const startedAt = performance.now();
    if (!hasExpectedSsfDescriptorContract({ descriptor, serviceId })) {
      recordSsfRuntimeDecision({
        startedAt,
        result: 'unavailable',
        code: 'runtime_configuration_unavailable',
      });
      return {
        kind: 'rejected',
        response: createSsfRuntimeErrorResponse(
          request,
          503,
          'runtime_configuration_unavailable',
          true
        ),
      };
    }
    const token = readBearerToken(request);
    if (!token) {
      await input.auditDenial({ request, reasonCode: 'service_authentication_invalid' });
      recordSsfRuntimeDecision({
        startedAt,
        result: 'denied',
        code: 'service_authentication_invalid',
      });
      return {
        kind: 'rejected',
        response: createSsfRuntimeErrorResponse(
          request,
          401,
          'service_authentication_invalid',
          false
        ),
      };
    }
    const authentication = await input.authenticateToken(token);
    if (authentication.kind === 'authenticated') {
      return { kind: 'authenticated', subject: authentication.subject };
    }
    if (authentication.status === 401 || authentication.status === 403) {
      await input.auditDenial({ request, reasonCode: authentication.code });
    }
    recordSsfRuntimeDecision({
      startedAt,
      result: authentication.status === 503 ? 'unavailable' : 'denied',
      code: authentication.reason,
    });
    return {
      kind: 'rejected',
      response: createSsfRuntimeErrorResponse(
        request,
        authentication.status,
        authentication.code,
        authentication.status === 503
      ),
    };
  };
