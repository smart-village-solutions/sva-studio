import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const directory = join(root, 'deploy/backup-agent');

describe('backup agent container module inventory', () => {
  it('packages every relative ESM dependency and preserves the actual Compose exports', async () => {
    const dockerfile = readFileSync(join(directory, 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('COPY --chown=node:node deploy/backup-agent/*.mjs /app/');
    expect(dockerfile).toContain('ENTRYPOINT ["node", "/app/agent.mjs"]');
    const modules = readdirSync(directory).filter((name) => name.endsWith('.mjs'));
    for (const module of modules) {
      const source = readFileSync(join(directory, module), 'utf8');
      for (const [, dependency] of source.matchAll(/from ['"]\.\/(.*?\.mjs)['"]/gu)) {
        expect(modules, `${module} -> ${dependency}`).toContain(dependency);
      }
    }
    const compose = readFileSync(join(directory, 'compose.integration.yaml'), 'utf8');
    const integrationExports = [
      ...compose.matchAll(/const \{ (\w+) \} = await import\('\/app\/agent\.mjs'\)/gu),
    ].map(([, name]) => name);
    expect(new Set(integrationExports)).toEqual(
      new Set(['executeBackupForIntegration', 'executeRestoreForIntegration'])
    );

    mkdirSync(join(root, '.nx'), { recursive: true });
    const packaged = mkdtempSync(join(root, '.nx/backup-agent-package-'));
    try {
      for (const module of modules) cpSync(join(directory, module), join(packaged, module));
      const entry = await import(
        /* @vite-ignore */ pathToFileURL(join(packaged, 'agent.mjs')).href
      );
      expect(Object.keys(entry).sort()).toEqual([...new Set(integrationExports)].sort());
      for (const name of integrationExports) expect(entry[name]).toBeTypeOf('function');
    } finally {
      rmSync(packaged, { recursive: true, force: true });
    }
  });
});
