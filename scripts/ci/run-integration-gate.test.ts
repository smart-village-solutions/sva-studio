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
        'data',
        'plugin-news',
        'monitoring-client',
      ])
    ).toEqual(['data']);
  });

  it('parses newline-separated nx project output', () => {
    expect(parseNxProjectList('\ndata\nplugin-news\nmonitoring-client\n')).toEqual([
      'data',
      'plugin-news',
      'monitoring-client',
    ]);
  });

  it('builds a run-many command for the selected projects', () => {
    expect(buildRunManyIntegrationCommand(['data'])).toBe(
      'env -u NO_COLOR pnpm nx run-many -t test:integration --projects=data --output-style=stream'
    );
  });

  it('documents the split between general and monitoring-specific integration projects', () => {
    expect(GENERAL_INTEGRATION_PROJECTS).toEqual(['data']);
    expect(MONITORING_STACK_PROJECTS).toEqual(['monitoring-client']);
  });
});
