import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/waste-bb-prignitz-cutover.yml'),
  'utf8'
);

describe('bb-prignitz Waste cutover workflow', () => {
  it('stops before the fixed import and starts only after successful verification', () => {
    expect(workflow.indexOf('stop-public-waste:')).toBeLessThan(
      workflow.indexOf('import-waste-data:')
    );
    expect(workflow).toContain('needs: stop-public-waste');
    expect(workflow).toContain('needs: import-waste-data');
    expect(workflow).toContain('submit-restore-agent-request.ts prod waste-import');
    expect(workflow).toContain('PUBLIC_WASTE_BASE_URL fehlt.');
    expect(workflow).toContain('consecutive_failures >= 3');
    expect(workflow).toContain("jq -e '.options | length > 0'");
  });

  it('binds the immutable source, tenant and protected environments without exposing credentials', () => {
    expect(workflow).toContain('prod/waste/bb-prignitz/import/2026-08-09/waste-data-pg16.sql');
    expect(workflow).toContain('df75392bee510be71444eec28914f704c0917a5a59ac46e6380ef050c3ffd5dc');
    expect(workflow).toContain('WASTE_TENANT_INSTANCE_ID: bb-prignitz');
    expect(workflow).toContain('environment: prod');
    expect(workflow).toContain('environment: web-waste-calendar');
    expect(workflow).not.toContain('postgres://');
    expect(workflow).not.toContain('quantum-cli stacks deploy');
  });
});
