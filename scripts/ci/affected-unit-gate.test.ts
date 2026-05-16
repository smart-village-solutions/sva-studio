import { describe, expect, it } from 'vitest';

import { buildAppUnitCommand, planAppUnitExecution } from './affected-unit-gate.ts';

describe('affected-unit-gate', () => {
  it('skips app slicing when the app is not affected', () => {
    expect(planAppUnitExecution(['packages/core/src/index.ts'], ['core'])).toEqual({
      mode: 'skip',
      reason: 'app-not-affected',
      slices: [],
    });
  });

  it('uses slices for app-only ui and hook changes', () => {
    expect(
      planAppUnitExecution(
        [
          'apps/sva-studio-react/src/components/Header.tsx',
          'apps/sva-studio-react/src/hooks/useTheme.ts',
        ],
        ['sva-studio-react']
      )
    ).toEqual({
      mode: 'slices',
      reason: 'app-only-sliceable-change',
      slices: ['hooks', 'ui'],
    });
  });

  it('routes non-server app lib changes to the hooks-lib slice', () => {
    expect(planAppUnitExecution(['apps/sva-studio-react/src/lib/theme.ts'], ['sva-studio-react'])).toEqual({
      mode: 'slices',
      reason: 'app-only-sliceable-change',
      slices: ['hooks'],
    });
  });

  it('uses the aggregate app target for app config changes', () => {
    expect(planAppUnitExecution(['apps/sva-studio-react/vitest.config.ts'], ['sva-studio-react'])).toEqual({
      mode: 'aggregate',
      reason: 'aggregate-app-file',
      slices: [],
    });
  });

  it('uses the aggregate app target for mixed workspace changes', () => {
    expect(
      planAppUnitExecution(
        [
          'apps/sva-studio-react/src/routes/-index.tsx',
          'packages/routing/src/index.ts',
        ],
        ['routing', 'sva-studio-react']
      )
    ).toEqual({
      mode: 'aggregate',
      reason: 'mixed-workspace-change',
      slices: [],
    });
  });

  it('uses the aggregate app target when a file cannot be mapped to a safe slice', () => {
    expect(planAppUnitExecution(['apps/sva-studio-react/src/main.tsx'], ['sva-studio-react'])).toEqual({
      mode: 'aggregate',
      reason: 'aggregate-app-file',
      slices: [],
    });
  });

  it('maps server-side app test files to the server slice', () => {
    expect(
      planAppUnitExecution(
        ['apps/sva-studio-react/src/lib/instance-interfaces-server.test.ts'],
        ['sva-studio-react']
      )
    ).toEqual({
      mode: 'slices',
      reason: 'app-only-sliceable-change',
      slices: ['server'],
    });
  });

  it('builds direct vitest commands for aggregate and sliced app runs', () => {
    expect(buildAppUnitCommand()).toBe(
      'pnpm exec vitest run --config apps/sva-studio-react/vitest.config.ts --reporter=verbose'
    );
    expect(buildAppUnitCommand('routes')).toBe(
      'pnpm exec vitest run --config apps/sva-studio-react/vitest.routes.config.ts --reporter=verbose'
    );
  });
});
