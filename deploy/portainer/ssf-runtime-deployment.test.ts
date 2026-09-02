import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('SSF runtime deployment contract', () => {
  it('keeps the runtime endpoint and plugin database disabled in every tracked remote profile', () => {
    for (const environment of ['dev', 'staging', 'prod']) {
      const profile = read(`config/runtime/remote/${environment}.vars`);
      expect(profile).toContain('SSF_PLUGIN_DATABASE_ENABLED=false');
      expect(profile).toContain('SVA_STUDIO_SSF_RUNTIME_ENABLED=false');
      expect(profile).not.toContain('SVA_STUDIO_SSF_DATABASE_URL=');
      expect(profile).not.toContain('SSF_PLUGIN_RUNTIME_DB_PASSWORD=');
      expect(profile).not.toContain('SVA_STUDIO_SSF_RUNTIME_ISSUER=');
      expect(profile).not.toContain('SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_SECRET=');
    }
  });

  it('routes SSF migrations through the existing migration one-shot', () => {
    const compose = read('deploy/portainer/docker-compose.studio.yml');
    const entrypoint = read('deploy/portainer/migrate-entrypoint.sh');
    const dockerfile = read('Dockerfile');

    expect(compose).toContain(
      "SSF_PLUGIN_DATABASE_ENABLED: '${SSF_PLUGIN_DATABASE_ENABLED:-false}'"
    );
    expect(compose).toContain(
      "SVA_STUDIO_SSF_RUNTIME_ENABLED: '${SVA_STUDIO_SSF_RUNTIME_ENABLED:-false}'"
    );
    expect(compose).toContain("SVA_STUDIO_SSF_DATABASE_URL: '${SVA_STUDIO_SSF_DATABASE_URL:-}'");
    expect(compose).toContain(
      "SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL: '${SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL:-}'"
    );
    expect(compose).toContain(
      "SVA_STUDIO_SSF_CONTROL_PLANE_TOKEN_URL: '${SVA_STUDIO_SSF_CONTROL_PLANE_TOKEN_URL:-}'"
    );
    expect(compose).toContain(
      "SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_ID: '${SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_ID:-sva-studio-ssf-control-plane}'"
    );
    expect(compose).toContain(
      "SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_SECRET: '${SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_SECRET:-}'"
    );
    expect(entrypoint).toContain('node "${SSF_PLUGIN_MIGRATOR}" prepare');
    expect(entrypoint).toContain('"${GOOSE_WRAPPER}" -dir "${SSF_PLUGIN_MIGRATIONS_DIR}"');
    expect(entrypoint).toContain('node "${SSF_PLUGIN_MIGRATOR}" reconcile');
    expect(dockerfile).toContain('/workspace/packages/plugin-ssf/migrations');
  });
});
