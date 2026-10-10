import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const personalContextBaseSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/u),
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().url(),
  issuer: z.string().url(),
  clientId: z.string().trim().min(1).max(128),
});

const personalContextSchema = z.discriminatedUnion('kind', [
  personalContextBaseSchema.extend({ kind: z.literal('platform') }),
  personalContextBaseSchema.extend({
    kind: z.literal('tenant'),
    tenantId: z.string().trim().min(1).max(128),
  }),
]);

const personalContextsSchema = z.array(personalContextSchema).max(100).superRefine((contexts, ctx) => {
  const ids = new Set<string>();
  contexts.forEach((context, index) => {
    if (ids.has(context.id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: 'duplicate_context_id' });
    ids.add(context.id);
    for (const [field, raw] of [['baseUrl', context.baseUrl], ['issuer', context.issuer]] as const) {
      const url = new URL(raw);
      const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
      if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
        ctx.addIssue({ code: 'custom', path: [index, field], message: 'personal_context_requires_https' });
      }
      if (url.username || url.password || url.search || url.hash) {
        ctx.addIssue({ code: 'custom', path: [index, field], message: 'personal_context_url_invalid' });
      }
    }
    const baseUrl = new URL(context.baseUrl);
    if (baseUrl.pathname !== '/') {
      ctx.addIssue({ code: 'custom', path: [index, 'baseUrl'], message: 'studio_base_url_must_be_origin' });
    }
    const issuer = new URL(context.issuer);
    if (!/^\/realms\/[^/]+\/?$/u.test(issuer.pathname)) {
      ctx.addIssue({ code: 'custom', path: [index, 'issuer'], message: 'keycloak_realm_issuer_required' });
    }
  });
});

export type PersonalMcpContext = z.infer<typeof personalContextSchema>;

const sourceSchema = z.object({
  baseUrl: z.string().url(),
  tokenUrl: z.string().url(),
  clientId: z.string().trim().min(1),
  clientSecret: z.string().min(1).optional(),
  clientSecretCommand: z.array(z.string().min(1)).min(1).optional(),
  interfaceSecretCommand: z.array(z.string().min(1)).min(1).optional(),
  readTimeoutMs: z.number().int().positive().default(10_000),
  mutationTimeoutMs: z.number().int().positive().default(30_000),
  processTimeoutMs: z.number().int().positive().default(120_000),
  tokenTimeoutMs: z.number().int().positive().default(10_000),
  diagnosisTimeoutMs: z.number().int().positive().default(15_000),
  caFilePath: z.string().trim().min(1).optional(),
  personalContexts: personalContextsSchema.default([]),
  personalSessionStorage: z.enum(['memory', 'keychain']).default('memory'),
}).refine((value) => value.clientSecret || value.clientSecretCommand, 'Client-Secret oder Secret-Command fehlt.');

export type StudioMcpConfig = Omit<z.infer<typeof sourceSchema>, 'clientSecret' | 'clientSecretCommand' | 'interfaceSecretCommand' | 'personalContexts' | 'personalSessionStorage'> & {
  readonly clientSecret: string;
  readonly interfaceSecretCommand?: readonly string[];
  readonly personalContexts?: readonly PersonalMcpContext[];
  readonly personalSessionStorage?: 'memory' | 'keychain';
};

const parseCommand = (raw: string | undefined): string[] | undefined => {
  if (!raw) return undefined;
  const parsed: unknown = JSON.parse(raw);
  return z.array(z.string().min(1)).min(1).parse(parsed);
};

export const readStudioMcpConfig = async (env: NodeJS.ProcessEnv = process.env): Promise<StudioMcpConfig> => {
  const source = sourceSchema.parse({
    baseUrl: env.SVA_STUDIO_MCP_BASE_URL,
    tokenUrl: env.SVA_STUDIO_MCP_TOKEN_URL,
    clientId: env.SVA_STUDIO_MCP_CLIENT_ID ?? 'sva-studio-mcp',
    clientSecret: env.SVA_STUDIO_MCP_CLIENT_SECRET,
    clientSecretCommand: parseCommand(env.SVA_STUDIO_MCP_CLIENT_SECRET_COMMAND),
    interfaceSecretCommand: parseCommand(env.SVA_STUDIO_MCP_INTERFACE_SECRET_COMMAND),
    readTimeoutMs: env.SVA_STUDIO_MCP_READ_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_READ_TIMEOUT_MS)
      : undefined,
    mutationTimeoutMs: env.SVA_STUDIO_MCP_MUTATION_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_MUTATION_TIMEOUT_MS)
      : undefined,
    processTimeoutMs: env.SVA_STUDIO_MCP_PROCESS_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_PROCESS_TIMEOUT_MS)
      : undefined,
    tokenTimeoutMs: env.SVA_STUDIO_MCP_TOKEN_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_TOKEN_TIMEOUT_MS)
      : undefined,
    diagnosisTimeoutMs: env.SVA_STUDIO_MCP_DIAGNOSIS_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_DIAGNOSIS_TIMEOUT_MS)
      : undefined,
    caFilePath: env.SVA_STUDIO_MCP_CA_FILE,
    personalSessionStorage: env.SVA_STUDIO_MCP_PERSONAL_SESSION_STORAGE,
    personalContexts: env.SVA_STUDIO_MCP_PERSONAL_CONTEXTS
      ? JSON.parse(env.SVA_STUDIO_MCP_PERSONAL_CONTEXTS)
      : [],
  });
  let clientSecret = source.clientSecret;
  if (!clientSecret) {
    const [executable, ...args] = source.clientSecretCommand ?? [];
    if (!executable) throw new Error('client_secret_resolver_missing');
    clientSecret = (await execFileAsync(executable, args, {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 16_384,
    })).stdout.trim();
  }
  if (!clientSecret) throw new Error('client_secret_resolver_empty');
  return {
    baseUrl: source.baseUrl,
    tokenUrl: source.tokenUrl,
    clientId: source.clientId,
    readTimeoutMs: source.readTimeoutMs,
    mutationTimeoutMs: source.mutationTimeoutMs,
    processTimeoutMs: source.processTimeoutMs,
    tokenTimeoutMs: source.tokenTimeoutMs,
    diagnosisTimeoutMs: source.diagnosisTimeoutMs,
    caFilePath: source.caFilePath,
    clientSecret,
    interfaceSecretCommand: source.interfaceSecretCommand,
    personalContexts: source.personalContexts,
    personalSessionStorage: source.personalSessionStorage,
  };
};

export const resolveInterfaceSecret = async (
  config: StudioMcpConfig,
  reference: Readonly<{
    contextId: string;
    interfaceType: string;
    interfaceId?: string;
    field: string;
    secretRef: string;
  }>
): Promise<string> => {
  const [executable, ...args] = config.interfaceSecretCommand ?? [];
  if (!executable) throw new Error('interface_secret_resolver_not_configured');
  if (!args.some((argument) => argument.includes('{secretRef}'))) {
    throw new Error('interface_secret_reference_placeholder_missing');
  }
  const values: Readonly<Record<string, string>> = {
    contextId: reference.contextId,
    interfaceType: reference.interfaceType,
    interfaceId: reference.interfaceId ?? 'new',
    field: reference.field,
    secretRef: reference.secretRef,
  };
  const resolvedArgs = args.map((argument) =>
    argument.replace(/\{(contextId|interfaceType|interfaceId|field|secretRef)\}/gu, (_match, key: string) => values[key] ?? '')
  );
  try {
    const { stdout } = await execFileAsync(executable, resolvedArgs, {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 16_384,
    });
    const secret = stdout.endsWith('\r\n') ? stdout.slice(0, -2)
      : stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
    if (!secret) throw new Error('interface_secret_resolver_empty');
    return secret;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('interface_secret_resolver_')) throw error;
    throw Object.assign(new Error('interface_secret_resolution_failed'), { cause: error });
  }
};
