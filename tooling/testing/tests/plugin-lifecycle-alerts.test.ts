import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const alerts = readFileSync(resolve(root, 'deploy/portainer/monitoring/alert-rules.yml'), 'utf8');
const monitoring = readFileSync(
  resolve(root, 'packages/monitoring-client/src/otel.server.ts'),
  'utf8'
);

const lifecycleGroup = (): string => {
  const start = alerts.indexOf('  - name: plugin_tenant_lifecycle_alerts');
  expect(start).toBeGreaterThanOrEqual(0);
  const next = alerts.indexOf('\n  - name:', start + 1);
  return alerts.slice(start, next < 0 ? undefined : next);
};

describe('plugin tenant lifecycle alert contract', () => {
  it('covers every blocking class with warning and critical rules and a runbook link', () => {
    const group = lifecycleGroup();
    for (const alertName of [
      'PluginTenantLifecycleLaneUnavailable',
      'PluginTenantLifecycleStaleClaim',
      'PluginTenantLifecycleDueWorkStalled',
      'PluginTenantLifecycleGenerationWithoutOwner',
      'PluginTenantLifecycleObservabilityUnavailable',
    ]) {
      expect(group).toContain(`- alert: ${alertName}Warning`);
      expect(group).toContain(`- alert: ${alertName}Critical`);
    }
    expect(group.match(/runbook_url:/g)).toHaveLength(10);
    expect(group).toContain(
      'https://github.com/smart-village-solutions/sva-studio/blob/main/docs/operations/plugin-tenant-lifecycle-operations.md'
    );
  });

  it('deduplicates fleet aggregates with max while retaining lane process semantics', () => {
    const group = lifecycleGroup();
    expect(group).toContain('max by (reason_code)');
    expect(group).toContain('min by (lane)');
    expect(group).toContain('sva_plugin_tenant_lifecycle_lane_ready{lane=~"default|privileged"}');
    expect(group).toContain('absent(sva_plugin_tenant_lifecycle_lane_ready{lane="default"})');
    expect(group).toContain('absent(sva_plugin_tenant_lifecycle_lane_ready{lane="privileged"})');
    expect(group).not.toMatch(/sum\s*(?:by\s*\([^)]*\)\s*)?\(/);
  });

  it('uses only bounded labels and keeps the critical delivery budget within 120 seconds', () => {
    const group = lifecycleGroup();
    expect(group).toContain('interval: 15s');
    const criticalBlocks = group
      .split(/\n\s+- alert: /)
      .filter((block) => block.startsWith('PluginTenantLifecycle') && block.includes('Critical'));
    expect(criticalBlocks).toHaveLength(5);
    for (const block of criticalBlocks) {
      expect(block).toContain('for: 30s');
      expect(block).toContain('severity: critical');
    }
    expect(group).not.toMatch(
      /(?:instance_id|plugin_id|job_id|generation|request_id|correlation_id)\s*[:=]|\$labels\.instance/i
    );

    const exportInterval = Number(
      monitoring.match(/OTEL_METRIC_EXPORT_INTERVAL_MS\s*=\s*([\d_]+)/)?.[1]?.replaceAll('_', '')
    );
    const exportTimeout = Number(
      monitoring.match(/OTEL_METRIC_EXPORT_TIMEOUT_MS\s*=\s*([\d_]+)/)?.[1]?.replaceAll('_', '')
    );
    const budgetSeconds = exportInterval / 1_000 + exportTimeout / 1_000 + 1 + 15 + 15 + 30;
    expect(budgetSeconds).toBeLessThanOrEqual(120);
  });
});
