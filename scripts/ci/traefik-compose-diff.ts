import { execFileSync } from 'node:child_process';

export const isTraefikOnlyComposeDiff = (diff: string): boolean => {
  const changedLines = diff
    .split('\n')
    .filter(
      (line) =>
        (line.startsWith('+') || line.startsWith('-')) &&
        !line.startsWith('+++') &&
        !line.startsWith('---')
    );

  return changedLines.length > 0 && changedLines.every((line) => /^[-+]\s*-\s*['"]?traefik\./u.test(line));
};

export const resolveTraefikOnlyComposeFiles = (
  base: string,
  head: string,
  changedFiles: readonly string[],
): string[] =>
  changedFiles.filter(
    (filePath) =>
      /^deploy\/compose\.(?:dev|staging|prod)\.yaml$/u.test(filePath) &&
      isTraefikOnlyComposeDiff(
        execFileSync('git', ['diff', '--unified=0', `${base}...${head}`, '--', filePath], {
          encoding: 'utf8',
        })
      )
  );
