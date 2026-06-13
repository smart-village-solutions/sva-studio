import type {
  PluginArchitectureBaselineEntry,
  PluginArchitectureViolation,
  PluginArchitectureViolationRule,
} from './plugin-architecture-boundary-lib.ts';

export type PluginArchitectureImportKind = 'runtime' | 'type' | 'reexport';

export type PluginArchitectureAllowlistEntry = {
  plugin: string;
  sourceFile: string;
  importSpecifier: string;
  resolvedTarget: string;
  kind: PluginArchitectureImportKind;
  reason: string;
  ticket?: string;
};

const RULES = new Set<PluginArchitectureViolationRule>([
  'workspace-dependency',
  'workspace-import',
  'forbidden-path-signal',
  'review-required-path-signal',
]);
const IMPORT_KINDS = new Set<PluginArchitectureImportKind>(['runtime', 'type', 'reexport']);

export const parsePluginArchitectureAllowlist = (value: unknown): readonly PluginArchitectureAllowlistEntry[] => {
  if (!Array.isArray(value)) {
    throw new Error('Plugin architecture allowlist must be a JSON array.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Allowlist entry ${index} is not an object.`);
    }

    const candidate = entry as Record<string, unknown>;
    const { plugin, sourceFile, importSpecifier, resolvedTarget, kind, reason, ticket } = candidate;

    if (
      typeof plugin !== 'string' ||
      typeof sourceFile !== 'string' ||
      typeof importSpecifier !== 'string' ||
      typeof resolvedTarget !== 'string' ||
      typeof kind !== 'string' ||
      typeof reason !== 'string'
    ) {
      throw new Error(`Allowlist entry ${index} is incomplete or invalid.`);
    }

    if (!IMPORT_KINDS.has(kind as PluginArchitectureImportKind)) {
      throw new Error(`Allowlist entry ${index} uses unknown kind ${String(kind)}.`);
    }

    if (ticket !== undefined && typeof ticket !== 'string') {
      throw new Error(`Allowlist entry ${index} has invalid ticket.`);
    }

    return {
      plugin,
      sourceFile,
      importSpecifier,
      resolvedTarget,
      kind: kind as PluginArchitectureImportKind,
      reason,
      ...(ticket !== undefined ? { ticket } : {}),
    };
  });
};

export const parsePluginArchitectureBaseline = (markdown: string): readonly PluginArchitectureBaselineEntry[] => {
  const baselineMatch = markdown.match(/## Machine Readable Baseline\s+```json\s*([\s\S]*?)```/m);
  if (!baselineMatch) {
    throw new Error('Machine Readable Baseline JSON-Codeblock fehlt.');
  }

  const parsed = JSON.parse(baselineMatch[1]) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Machine Readable Baseline muss ein JSON-Array sein.');
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Baseline-Eintrag ${index} ist kein Objekt.`);
    }

    const candidate = entry as Record<string, unknown>;
    const { packageName, relativePath, rule, subject, owner, justification, removalChange } = candidate;
    if (
      typeof packageName !== 'string' ||
      typeof relativePath !== 'string' ||
      typeof rule !== 'string' ||
      typeof subject !== 'string' ||
      typeof owner !== 'string' ||
      typeof justification !== 'string' ||
      typeof removalChange !== 'string'
    ) {
      throw new Error(`Baseline-Eintrag ${index} ist unvollstaendig oder typungueltig.`);
    }

    if (!RULES.has(rule as PluginArchitectureViolationRule)) {
      throw new Error(`Baseline-Eintrag ${index} verwendet die unbekannte Regel ${rule}.`);
    }

    return {
      packageName,
      relativePath,
      rule: rule as PluginArchitectureViolationRule,
      subject,
      owner,
      justification,
      removalChange,
    };
  });
};

const getViolationKey = (violation: Pick<PluginArchitectureViolation, 'packageName' | 'relativePath' | 'rule' | 'subject'>): string =>
  `${violation.packageName}::${violation.relativePath}::${violation.rule}::${violation.subject}`;

export const diffViolationsAgainstBaseline = (
  violations: readonly PluginArchitectureViolation[],
  baseline: readonly PluginArchitectureBaselineEntry[]
): readonly PluginArchitectureViolation[] => {
  const baselineKeys = new Set(baseline.map(getViolationKey));
  return violations.filter((violation) => !baselineKeys.has(getViolationKey(violation)));
};
