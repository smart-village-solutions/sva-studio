import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('styles foundation tokens', () => {
  it('maps the default shell action tokens to a KERN-blue palette', () => {
    expect(stylesSource).toContain('--primary: 0 90 158;');
    expect(stylesSource).toContain('--ring: 0 90 158;');
    expect(stylesSource).toContain('--sidebar-primary: 0 90 158;');
    expect(stylesSource).toContain('--sidebar-accent: 233 240 249;');
    expect(stylesSource).toContain('--waste-panel-surface: 240 244 249;');
  });

  it('keeps the forest theme as an explicit green variant over the default blue base', () => {
    expect(stylesSource).toContain("html[data-theme='sva-forest'] {");
    expect(stylesSource).toContain('--primary: 18 122 96;');
    expect(stylesSource).toContain('--sidebar-primary: 18 122 96;');
  });

  it('uses tighter radii for larger shell surfaces while keeping small controls differentiated', () => {
    expect(stylesSource).toContain('--radius: 6px;');
    expect(stylesSource).toContain('--radius-card: 8px;');
    expect(stylesSource).toContain('--radius-modal: 12px;');
  });
});
