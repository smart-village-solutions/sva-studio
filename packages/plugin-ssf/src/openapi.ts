import {
  SSF_RUNTIME_CONTRACT_VERSION,
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_LIMITS,
} from './constants.js';

const revisionSchema = {
  type: 'string',
  pattern: '^sha256:[0-9a-f]{64}$',
} as const;

const htmlSchema = {
  type: 'string',
  description: `Sanitized HTML, at most ${SSF_RUNTIME_LIMITS.htmlUtf8Bytes} UTF-8 bytes.`,
} as const;

export const ssfRuntimeConfigurationV1OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'SVA Studio SSF Runtime Configuration API',
    version: SSF_RUNTIME_CONTRACT_VERSION,
  },
  paths: {
    [SSF_RUNTIME_ENDPOINT_PATH]: {
      get: {
        operationId: 'getSsfRuntimeConfigurationV1',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'X-Studio-Instance-Id',
            in: 'header',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 128 },
          },
          {
            name: 'X-Correlation-Id',
            in: 'header',
            required: true,
            schema: {
              type: 'string',
              minLength: 1,
              maxLength: SSF_RUNTIME_LIMITS.correlationIdCharacters,
              pattern: '^[\\x20-\\x7e]+$',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Effective SSF runtime configuration.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SsfRuntimeConfigurationV1' },
              },
            },
          },
          '401': { $ref: '#/components/responses/SsfRuntimeError' },
          '403': { $ref: '#/components/responses/SsfRuntimeError' },
          '404': { $ref: '#/components/responses/SsfRuntimeError' },
          '409': { $ref: '#/components/responses/SsfRuntimeError' },
          '503': { $ref: '#/components/responses/SsfRuntimeError' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    responses: {
      SsfRuntimeError: {
        description: 'Stable SSF runtime error.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SsfRuntimeErrorV1' },
          },
        },
      },
    },
    schemas: {
      SsfRuntimeConfigurationV1: {
        type: 'object',
        additionalProperties: false,
        required: [
          'contractVersion',
          'configurationRevision',
          'authorizationRevision',
          'tenant',
          'branding',
          'localization',
          'conversationContentStorage',
        ],
        properties: {
          contractVersion: { const: SSF_RUNTIME_CONTRACT_VERSION },
          configurationRevision: revisionSchema,
          authorizationRevision: revisionSchema,
          tenant: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'displayName', 'timeZone'],
            properties: {
              id: { type: 'string', minLength: 1, maxLength: 128 },
              displayName: {
                type: 'string',
                minLength: 1,
                maxLength: SSF_RUNTIME_LIMITS.displayNameCharacters,
              },
              timeZone: { type: 'string', minLength: 1, maxLength: 100 },
            },
          },
          branding: {
            type: 'object',
            additionalProperties: false,
            required: ['logo', 'icon'],
            properties: {
              logo: { anyOf: [{ $ref: '#/components/schemas/SsfMediaV1' }, { type: 'null' }] },
              icon: { anyOf: [{ $ref: '#/components/schemas/SsfMediaV1' }, { type: 'null' }] },
            },
          },
          localization: {
            type: 'object',
            additionalProperties: false,
            required: ['defaultLocale', 'locales'],
            properties: {
              defaultLocale: { $ref: '#/components/schemas/SsfLocaleTagV1' },
              locales: {
                type: 'array',
                minItems: 1,
                maxItems: SSF_RUNTIME_LIMITS.activeLocales,
                uniqueItems: true,
                items: { $ref: '#/components/schemas/SsfLocaleV1' },
              },
            },
          },
          conversationContentStorage: {
            type: 'object',
            additionalProperties: false,
            required: ['mode'],
            properties: { mode: { type: 'string', enum: ['ask', 'disabled'] } },
          },
        },
      },
      SsfLocaleTagV1: {
        type: 'string',
        minLength: 1,
        maxLength: SSF_RUNTIME_LIMITS.localeCharacters,
        description: 'Canonical BCP-47 language tag.',
      },
      SsfLocaleV1: {
        type: 'object',
        additionalProperties: false,
        required: [
          'locale',
          'authenticatedHomeExplanationHtml',
          'guestExplanationHtml',
          'conversationContentStorageQuestionHtml',
        ],
        properties: {
          locale: { $ref: '#/components/schemas/SsfLocaleTagV1' },
          authenticatedHomeExplanationHtml: htmlSchema,
          guestExplanationHtml: htmlSchema,
          conversationContentStorageQuestionHtml: {
            anyOf: [htmlSchema, { type: 'null' }],
          },
        },
      },
      SsfMediaV1: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'alternativeText'],
        properties: {
          url: { type: 'string', format: 'uri', maxLength: SSF_RUNTIME_LIMITS.urlCharacters },
          alternativeText: {
            type: 'string',
            maxLength: SSF_RUNTIME_LIMITS.alternativeTextCharacters,
          },
        },
      },
      SsfRuntimeErrorV1: {
        type: 'object',
        additionalProperties: false,
        required: ['contractVersion', 'error'],
        properties: {
          contractVersion: { const: SSF_RUNTIME_CONTRACT_VERSION },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message', 'retryable', 'correlationId'],
            properties: {
              code: {
                type: 'string',
                enum: [
                  'service_authentication_invalid',
                  'service_action_forbidden',
                  'tenant_not_found',
                  'tenant_suspended',
                  'ssf_plugin_inactive',
                  'ssf_tenant_not_ready',
                  'runtime_configuration_unavailable',
                ],
              },
              message: { type: 'string', minLength: 1, maxLength: 200 },
              retryable: { type: 'boolean' },
              correlationId: {
                type: 'string',
                minLength: 1,
                maxLength: SSF_RUNTIME_LIMITS.correlationIdCharacters,
              },
            },
          },
        },
      },
    },
  },
} as const;
