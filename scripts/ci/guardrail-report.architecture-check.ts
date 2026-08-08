import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createGuardrailCheckResult,
  normalizeRelativePath,
  walkFiles,
  type GuardrailCheckContext,
} from './guardrail-report.shared.ts';

const runI18nKeyCheck = (
  repoRoot: string
): { readonly ok: boolean; readonly details: readonly string[] } => {
  try {
    const scriptSource = readFileSync(resolve(repoRoot, 'scripts/ci/check-i18n-keys.ts'), 'utf8');
    if (!scriptSource.includes('missingUsageKeys')) {
      return {
        ok: false,
        details: ['check-i18n-keys.ts enthaelt keine erwartete Missing-Key-Pruefung.'],
      };
    }
    return { ok: true, details: [] };
  } catch (error) {
    return {
      ok: false,
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
};

const collectShortActionIdFindings = (repoRoot: string): readonly string[] => {
  const findings: string[] = [];
  const actionPattern = /\b(?:actionId|requiredAction|guard)\s*:\s*['"`]([a-z-]+)['"`]/g;

  for (const directory of [
    resolve(repoRoot, 'packages/auth-runtime/src'),
    resolve(repoRoot, 'packages/iam-admin/src'),
    resolve(repoRoot, 'packages/sva-mainserver/src/server'),
  ]) {
    for (const filePath of walkFiles(directory)) {
      if (
        !/\.(ts|tsx)$/.test(filePath) ||
        filePath.endsWith('.test.ts') ||
        filePath.endsWith('.test.tsx')
      ) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      for (const match of source.matchAll(actionPattern)) {
        const rawValue = match[1] ?? '';
        if (!rawValue.includes('.')) {
          findings.push(`${normalizeRelativePath(repoRoot, filePath)} -> ${rawValue}`);
        }
      }
    }
  }

  return findings;
};

const collectServerOnlyLeakFindings = (repoRoot: string): readonly string[] => {
  const findings: string[] = [];
  const importPattern =
    /from\s+['"`]([^'"`]+(?:\.server(?:\.[jt]sx?)?|\/server(?:\.[jt]sx?)?))['"`]/g;

  for (const directory of [resolve(repoRoot, 'apps'), resolve(repoRoot, 'packages')]) {
    for (const filePath of walkFiles(directory)) {
      if (
        !/\.(ts|tsx)$/.test(filePath) ||
        filePath.endsWith('.test.ts') ||
        filePath.endsWith('.test.tsx')
      ) {
        continue;
      }
      if (filePath.endsWith('.server.ts') || filePath.endsWith('.server.tsx')) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      const matches = [...source.matchAll(importPattern)];
      if (matches.length > 0) {
        findings.push(
          `${normalizeRelativePath(repoRoot, filePath)} -> ${matches
            .map((match) => match[1] ?? '')
            .filter((value) => value.length > 0)
            .join(', ')}`
        );
      }
    }
  }

  return findings;
};

const MAX_VISIBLE_DETAIL_FINDINGS = 10;

const limitVisibleFindings = (findings: readonly string[]): readonly string[] => {
  if (findings.length <= MAX_VISIBLE_DETAIL_FINDINGS) {
    return findings;
  }

  const remainingCount = findings.length - MAX_VISIBLE_DETAIL_FINDINGS;
  return [
    ...findings.slice(0, MAX_VISIBLE_DETAIL_FINDINGS),
    `... ${remainingCount} weitere Befunde gekuerzt. Siehe Evidence fuer die Gesamtanzahl.`,
  ];
};

export const buildArchitectureDriftCheck = async (context: GuardrailCheckContext) => {
  const i18nCheck = runI18nKeyCheck(context.rootDir);
  const shortActionIds = collectShortActionIdFindings(context.rootDir);
  const serverOnlyLeaks = collectServerOnlyLeakFindings(context.rootDir);
  const details = limitVisibleFindings([
    ...(!i18nCheck.ok ? i18nCheck.details : []),
    ...shortActionIds.map((entry) => `Kurzform-Action-ID: ${entry}`),
    ...serverOnlyLeaks.map((entry) => `Server-only Leak: ${entry}`),
  ]);

  return createGuardrailCheckResult({
    id: 'guardrail-architecture-drift',
    status: details.length > 0 ? 'warn' : 'ok',
    code: details.length > 0 ? 'architecture_drift_findings_visible' : 'architecture_drift_visible',
    summary:
      details.length > 0
        ? 'Architekturdrift ist sichtbar, wird aber noch nicht als Build-Gate erzwungen.'
        : 'Architekturdrift-Detektoren liefern im report-only Lauf keine Befunde.',
    details,
    evidence: {
      i18nCheckOk: i18nCheck.ok,
      shortActionIdCount: shortActionIds.length,
      serverOnlyLeakCount: serverOnlyLeaks.length,
      detectorsNotYetEnabled: ['dependency-graph-gate'],
    },
    wouldFailInEnforcement: details.length > 0,
    affectedTargets: [
      'scripts/ci/check-i18n-keys.ts',
      'packages/auth-runtime/src',
      'packages/sva-mainserver/src/server',
    ],
    suggestedNextStep:
      details.length > 0
        ? 'Vorhandene Drift in dedizierte statische Gates ueberfuehren und Altlasten abbauen.'
        : null,
  });
};
