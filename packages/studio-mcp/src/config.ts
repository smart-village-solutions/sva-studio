import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const sourceSchema = z.object({
  baseUrl: z.string().url(),
  tokenUrl: z.string().url(),
  clientId: z.string().trim().min(1),
  clientSecret: z.string().min(1).optional(),
  clientSecretCommand: z.array(z.string().min(1)).min(1).optional(),
  readTimeoutMs: z.number().int().positive().default(10_000),
  mutationTimeoutMs: z.number().int().positive().default(30_000),
  tokenTimeoutMs: z.number().int().positive().default(10_000),
  diagnosisTimeoutMs: z.number().int().positive().default(15_000),
  caFilePath: z.string().trim().min(1).optional(),
}).refine((value) => value.clientSecret || value.clientSecretCommand, 'Client-Secret oder Secret-Command fehlt.');

export type StudioMcpConfig = Omit<z.infer<typeof sourceSchema>, 'clientSecret' | 'clientSecretCommand'> & {
  readonly clientSecret: string;
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
    readTimeoutMs: env.SVA_STUDIO_MCP_READ_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_READ_TIMEOUT_MS)
      : undefined,
    mutationTimeoutMs: env.SVA_STUDIO_MCP_MUTATION_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_MUTATION_TIMEOUT_MS)
      : undefined,
    tokenTimeoutMs: env.SVA_STUDIO_MCP_TOKEN_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_TOKEN_TIMEOUT_MS)
      : undefined,
    diagnosisTimeoutMs: env.SVA_STUDIO_MCP_DIAGNOSIS_TIMEOUT_MS
      ? Number(env.SVA_STUDIO_MCP_DIAGNOSIS_TIMEOUT_MS)
      : undefined,
    caFilePath: env.SVA_STUDIO_MCP_CA_FILE,
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
    tokenTimeoutMs: source.tokenTimeoutMs,
    diagnosisTimeoutMs: source.diagnosisTimeoutMs,
    caFilePath: source.caFilePath,
    clientSecret,
  };
};
