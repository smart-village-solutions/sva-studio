import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/public-waste-web-release.yml'),
  'utf8'
);

describe('public Waste Web release workflow', () => {
  it('builds and pushes the tagged image once before deploying either target', () => {
    expect(workflow).toContain('build-public-waste-image:');
    expect(workflow).toContain('deploy-public-waste-stack:');
    expect(workflow.indexOf('build-public-waste-image:')).toBeLessThan(
      workflow.indexOf('deploy-public-waste-stack:')
    );
    expect(workflow).toContain('needs: build-public-waste-image');
    expect(workflow).toContain('PUBLIC_WASTE_IMAGE_TAG: ${{ needs.build-public-waste-image.outputs.image_tag }}');
    expect(workflow.match(/docker buildx build/g)).toHaveLength(1);
    expect(workflow).toContain('fail-fast: false');
  });

  it('keeps the two configured release targets isolated by GitHub Environment', () => {
    expect(workflow).toContain('environment: web-waste-calendar');
    expect(workflow).toContain('environment: web-waste-calendar-frankfurt-oder');
    expect(workflow).toContain('environment: ${{ matrix.target.environment }}');
    expect(workflow).toContain('label: Prignitz');
    expect(workflow).toContain('label: Frankfurt (Oder)');
    expect(workflow).toContain('PUBLIC_WASTE_BASE_URL: ${{ vars.PUBLIC_WASTE_BASE_URL }}');
    expect(workflow).toContain('QUANTUM_API_KEY: ${{ secrets.QUANTUM_API_KEY }}');
  });

  it('keeps target-local stack updates and the existing public runtime smokes', () => {
    expect(workflow).toContain('pnpm exec tsx scripts/ops/public-waste/portainer-release.ts');
    expect(workflow).toContain('${base_url}/health/live');
    expect(workflow).toContain('${base_url}/api/public-waste/selection');
    expect(workflow).not.toContain('SVA_IMAGE_TAG');
    expect(workflow).not.toContain('quantum-cli stacks deploy');
  });
});
