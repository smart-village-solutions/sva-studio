import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export type GuardrailCheckStatus = 'ok' | 'skipped' | 'warn';

export type GuardrailCheckResult = Readonly<{
  id: string;
  status: GuardrailCheckStatus;
  code: string;
  summary: string;
  details: readonly string[];
  evidence: Readonly<Record<string, unknown>>;
  enforcementReady: boolean;
  wouldFailInEnforcement: boolean;
  affectedTargets: readonly string[];
  suggestedNextStep: string | null;
}>;

export type GuardrailReport = Readonly<{
  generatedAt: string;
  runtimeProfile: string;
  checks: readonly GuardrailCheckResult[];
}>;

export type GuardrailCheckContext = Readonly<{
  env: NodeJS.ProcessEnv;
  rootDir: string;
  runtimeProfile: string;
}>;

export type GuardrailCheckDefinition = Readonly<{
  id: string;
  run: (context: GuardrailCheckContext) => Promise<GuardrailCheckResult>;
}>;

export const guardrailCheckOrder = [
  'guardrail-plugin-contract',
  'guardrail-architecture-drift',
  'guardrail-runtime-boot',
  'guardrail-auth-session',
  'guardrail-cache-contract',
] as const;

export const createGuardrailCheckResult = (
  input: Pick<GuardrailCheckResult, 'code' | 'id' | 'status' | 'summary'> &
    Partial<Omit<GuardrailCheckResult, 'code' | 'id' | 'status' | 'summary'>>
): GuardrailCheckResult => ({
  id: input.id,
  status: input.status,
  code: input.code,
  summary: input.summary,
  details: input.details ?? [],
  evidence: input.evidence ?? {},
  enforcementReady: input.enforcementReady ?? false,
  wouldFailInEnforcement: input.wouldFailInEnforcement ?? false,
  affectedTargets: input.affectedTargets ?? [],
  suggestedNextStep: input.suggestedNextStep ?? null,
});

export const walkFiles = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === '.cache' ||
        entry.name === '.nx' ||
        entry.name === '.output' ||
        entry.name === '.turbo' ||
        entry.name === '.vite' ||
        entry.name === 'coverage' ||
        entry.name === 'dist' ||
        entry.name === 'node_modules'
      ) {
        continue;
      }
      files.push(...walkFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
};

export const normalizeRelativePath = (repoRoot: string, filePath: string): string =>
  path.relative(repoRoot, filePath).split(path.sep).join('/');

export const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, 'utf8')) as T;
