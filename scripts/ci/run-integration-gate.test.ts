import { describe, expect, it } from 'vitest';

import {
  GENERAL_INTEGRATION_PROJECTS,
  MONITORING_STACK_PROJECTS,
  buildRunManyIntegrationCommand,
  filterRunnableIntegrationProjects,
  parseNxProjectList,
} from './run-integration-gate.ts';

describe('run-integration-gate', () => {
  it('keeps only general runnable integration projects from nx output', () => {
    expect(
      filterRunnableIntegrationProjects([
        'sva-studio-react',
        'auth-runtime',
        'data',
        'plugin-news',
        'monitoring-client',
      ])
    ).toEqual(['auth-runtime', 'data', 'sva-studio-react']);
  });

  it('parses newline-separated nx project output', () => {
    expect(parseNxProjectList('\ndata\nplugin-news\nmonitoring-client\n')).toEqual([
      'data',
      'plugin-news',
      'monitoring-client',
    ]);
  });

  it('serializes integration projects that share the Compose database', () => {
    expect(buildRunManyIntegrationCommand(['auth-runtime', 'data', 'sva-studio-react'])).toBe(
      'env -u NO_COLOR pnpm nx run-many -t test:integration --projects=auth-runtime,data,sva-studio-react --parallel=1 --output-style=stream'
    );
  });

  it('documents the split between general and monitoring-specific integration projects', () => {
    expect(GENERAL_INTEGRATION_PROJECTS).toEqual(['auth-runtime', 'data', 'sva-studio-react']);
    expect(MONITORING_STACK_PROJECTS).toEqual(['monitoring-client']);
  });
});
