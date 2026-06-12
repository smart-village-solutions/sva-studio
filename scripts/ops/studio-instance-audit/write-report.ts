import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const writeStudioInstanceAuditReport = (
  outputDir: string,
  html: string,
  now = new Date(),
): string => {
  mkdirSync(outputDir, { recursive: true });
  const fileName = `studio-instance-audit-${now.toISOString().replaceAll(':', '-')}.html`;
  const outputPath = join(outputDir, fileName);
  writeFileSync(outputPath, html, 'utf8');
  return outputPath;
};
