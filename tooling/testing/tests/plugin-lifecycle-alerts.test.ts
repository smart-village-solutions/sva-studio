import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const alerts = readFileSync(resolve(root, 'deploy/portainer/monitoring/alert-rules.yml'), 'utf8');
const productionCompose = readFileSync(
  resolve(root, 'deploy/portainer/docker-compose.studio.yml'),
  'utf8'
);

describe('plugin tenant lifecycle alert contract', () => {
  it('keeps lifecycle alerts inactive until the production OTEL path exists', () => {
    expect(productionCompose).toContain("ENABLE_OTEL: 'false'");
    expect(productionCompose).not.toContain('OTEL_EXPORTER_OTLP_ENDPOINT:');
    expect(alerts).not.toContain('name: plugin_tenant_lifecycle_alerts');
    expect(alerts).not.toContain('PluginTenantLifecycleLaneUnavailable');
    expect(alerts).toContain('Issue #1237');
  });
});
