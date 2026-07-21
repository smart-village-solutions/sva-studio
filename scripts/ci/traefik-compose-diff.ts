import { execFileSync } from 'node:child_process';

const changedComposeLines = (diff: string): string[] =>
  diff
    .split('\n')
    .filter(
      (line) =>
        (line.startsWith('+') || line.startsWith('-')) &&
        !line.startsWith('+++') &&
        !line.startsWith('---')
    );

export const isTraefikOnlyComposeDiff = (diff: string): boolean => {
  const changedLines = changedComposeLines(diff);

  return changedLines.length > 0 && changedLines.every((line) => /^[-+]\s*-\s*['"]?traefik\./u.test(line));
};

const devMcpConfigurationLines = new Set([
  '+    environment:',
  '+      SVA_STUDIO_MCP_ENABLED: "true"',
  '+      SVA_STUDIO_MCP_ISSUER: "https://keycloak.smart-village.app/realms/studio-dev"',
  '+      SVA_STUDIO_MCP_AUDIENCE: "sva-studio-mcp"',
  '+      SVA_STUDIO_MCP_CLIENT_ID: "sva-studio-mcp"',
]);

export const isDevMcpOnlyComposeDiff = (diff: string): boolean => {
  const changedLines = changedComposeLines(diff);
  return changedLines.length === devMcpConfigurationLines.size
    && changedLines.every((line) => devMcpConfigurationLines.has(line));
};

export const resolveTraefikOnlyComposeFiles = (
  base: string,
  head: string,
  changedFiles: readonly string[],
): string[] =>
  changedFiles.filter(
    (filePath) =>
      /^deploy\/compose\.(?:dev|staging|prod)\.yaml$/u.test(filePath) &&
      (() => {
        const diff = execFileSync('git', ['diff', '--unified=0', `${base}...${head}`, '--', filePath], {
          encoding: 'utf8',
        });
        return isTraefikOnlyComposeDiff(diff)
          || (filePath === 'deploy/compose.dev.yaml' && isDevMcpOnlyComposeDiff(diff));
      })()
  );
