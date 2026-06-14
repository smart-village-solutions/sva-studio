import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readPropertyValues = (propertyName: string): string[] => {
  const properties = fs.readFileSync(path.resolve('sonar-project.properties'), 'utf8');
  const line = properties
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${propertyName}=`));

  expect(line).toBeDefined();

  return line
    ?.slice(`${propertyName}=`.length)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];
};

describe('sonar-project.properties', () => {
  it('includes media, plugin-waste-management, and waste-management-runtime in sonar source and test scopes', () => {
    const sources = readPropertyValues('sonar.sources');
    const tests = readPropertyValues('sonar.tests');

    expect(sources).toContain('packages/media/src');
    expect(sources).toContain('packages/plugin-waste-management/src');
    expect(sources).toContain('packages/waste-management-runtime/src');
    expect(tests).toContain('packages/media/src');
    expect(tests).toContain('packages/plugin-waste-management/src');
    expect(tests).toContain('packages/waste-management-runtime/src');
  });

  it('keeps plugin translation resources out of copy-paste detection only', () => {
    const cpdExclusions = readPropertyValues('sonar.cpd.exclusions');
    const sonarExclusions = readPropertyValues('sonar.exclusions');
    const pluginTranslationPatterns = [
      'packages/plugin-news/src/plugin.translations*.ts',
      'packages/plugin-waste-management/src/plugin.translations*.ts',
    ];

    for (const pattern of pluginTranslationPatterns) {
      expect(cpdExclusions).toContain(pattern);
      expect(sonarExclusions).not.toContain(pattern);
    }
  });
});
