import type { GateMode, PrScopeDecision } from './pr-scope.ts';

const matches = (file: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(file));

// Diese Matrix bildet absichtlich die verteilten Aktivierungsregeln der noch
// aktiven Legacy-Workflows ab. Sie darf den zentralen Klassifizierer nicht
// importieren, damit der Shadow gemeinsame Scope-Fehler erkennen kann.
const ignoredByGeneralLegacyFilter = [
  /^docs\//u,
  /^.+\.md$/u,
  /^\.github\/(?:agents|prompts|ISSUE_TEMPLATE)\//u,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/u,
];
const qualityFull = [
  /^pnpm-lock\.yaml$/u,
  /^nx\.json$/u,
  /^tsconfig\.base\.json$/u,
  /^eslint\.config\.mjs$/u,
  /^vitest\.(?:config|workspace)\.ts$/u,
];
const coverageFull = [
  ...qualityFull,
  /^package\.json$/u,
  /^\.github\/workflows\/(?:runtime-gates|quality-gates)\.yml$/u,
];
const integrationAffected = [
  /^apps\/sva-studio-react\//u,
  /^packages\/(?:auth-runtime|core|data|data-repositories|instance-registry|routing|server-runtime|sva-mainserver)\//u,
];
const integrationFull = [
  /^apps\/sva-studio-react\/(?:package\.json|playwright\.config\.ts|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^packages\/(?:auth-runtime|core|data|data-repositories|instance-registry|routing|server-runtime|sva-mainserver)\/(?:package\.json|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\/(?:runtime-gates|quality-gates)\.yml$/u,
];
const pluginUiTs =
  /^packages\/plugin-(?:news|events|faq|poi|projects|waste-management)\/src\/.*\.(?:ts|tsx)$/u;
const pluginUiTsx =
  /^packages\/plugin-(?:news|events|faq|poi|projects|waste-management)\/src\/.*\.tsx$/u;
const a11yAffected = [
  /^apps\/sva-studio-react\/src\/(?:components|routes|providers)\//u,
  /^packages\/routing\//u,
  /^packages\/studio-ui-react\/src\/.*\.(?:ts|tsx)$/u,
  pluginUiTsx,
];
const a11yFull = [
  /^apps\/sva-studio-react\/(?:package\.json|vitest\.a11y\.config\.ts|vitest\.config\.ts)$/u,
  /^packages\/studio-ui-react\/(?:package\.json|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\/quality-gates\.yml$/u,
];
const runtimeAffected = [
  /^apps\/sva-studio-react\/src\/server\.ts$/u,
  /^apps\/sva-studio-react\/src\/lib\/.+\.server\.ts$/u,
  /^apps\/sva-studio-react\/(?:package\.json|vite\.config\.ts)$/u,
];
const runtimeFull = [
  /^scripts\/ci\/verify-runtime-artifact\.sh$/u,
  /^\.github\/workflows\/main-build\.yml$/u,
];
const appBuildAffected = [
  /^apps\/sva-studio-react\//u,
  /^packages\/(?:routing|studio-ui-react)\//u,
  pluginUiTs,
];
const appBuildFull = [
  /^package\.json$/u,
  /^pnpm-lock\.yaml$/u,
  /^nx\.json$/u,
  /^tsconfig\.base\.json$/u,
  /^vitest\.(?:config|workspace)\.ts$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\//u,
];
const documentationCatalog = [
  /^apps\/sva-studio-react\/(?:plugin-catalog\.json|project\.json)$/u,
  /^apps\/sva-studio-react\/src\/(?:lib\/plugin-catalog-loader\.ts|routing\/admin-resources\.ts)$/u,
  /^packages\/plugin-[^/]+\/(?:plugin\.manifest\.json|src\/)/u,
  /^packages\/routing\/src\//u,
  /^scripts\/ci\/generate-documentation-page-catalog\.ts$/u,
  /^docs\/user-documentation\/page-catalog\.json$/u,
  /^\.github\/workflows\/repository-hygiene\.yml$/u,
];
const dbSchema = [
  /^packages\/data\/migrations\//u,
  /^docs\/development\/studio-db-schema(?:-final\.sql|\.md)$/u,
  /^scripts\/(?:ci\/check-db-schema-snapshot|ops\/runtime\/db-schema-snapshot)\.ts$/u,
  /^\.github\/workflows\/repository-hygiene\.yml$/u,
];

const mode = (
  files: readonly string[],
  fullPatterns: readonly RegExp[],
  affectedPatterns: readonly RegExp[]
): GateMode =>
  files.some((file) => matches(file, fullPatterns))
    ? 'full'
    : files.some((file) => matches(file, affectedPatterns))
      ? 'affected'
      : 'skip';

export const classifyLegacyWorkflowScope = (changedFiles: readonly string[]): PrScopeDecision => {
  const normalizedFiles = [
    ...new Set(changedFiles.map((file) => file.trim()).filter(Boolean)),
  ].sort();
  const codeFiles = normalizedFiles.filter((file) => !matches(file, ignoredByGeneralLegacyFilter));
  const escalationReasons = codeFiles.filter((file) => matches(file, qualityFull));
  const codeRelevant = codeFiles.length > 0;

  return {
    changedFiles: normalizedFiles,
    codeRelevant,
    qualityGateMode: codeRelevant ? (escalationReasons.length > 0 ? 'full' : 'affected') : 'skip',
    coverageMode: codeRelevant ? mode(codeFiles, coverageFull, [/^scripts\/ci\//u]) : 'skip',
    integrationMode: codeRelevant ? mode(codeFiles, integrationFull, integrationAffected) : 'skip',
    a11yMode: codeRelevant ? mode(codeFiles, a11yFull, a11yAffected) : 'skip',
    runtimeVerifyMode: codeRelevant ? mode(codeFiles, runtimeFull, runtimeAffected) : 'skip',
    appBuildMode: codeRelevant ? mode(codeFiles, appBuildFull, appBuildAffected) : 'skip',
    documentationCatalogMode: normalizedFiles.some((file) => matches(file, documentationCatalog))
      ? 'full'
      : 'skip',
    dbSchemaMode: normalizedFiles.some((file) => matches(file, dbSchema)) ? 'full' : 'skip',
    escalationReasons,
  };
};
