import { describe, expect, it, vi } from 'vitest';

import {
  planChangedProjects,
  planChangedProjectsWithFallback,
  type ProjectRoot,
} from './changed-project-plan.ts';

const PROJECTS: ProjectRoot[] = [
  { name: 'plugin-news', root: 'packages/plugin-news' },
  { name: 'routing', root: 'packages/routing' },
  { name: 'sva-studio-react', root: 'apps/sva-studio-react' },
  { name: 'tooling-testing', root: 'tooling/testing' },
];

describe('changed-project-plan', () => {
  it('prioritizes directly changed projects and leaves transitive projects in the remainder', () => {
    expect(
      planChangedProjects(
        ['packages/plugin-news/src/index.ts'],
        ['sva-studio-react', 'plugin-news', 'routing'],
        PROJECTS
      )
    ).toEqual({
      mode: 'changed-first',
      reason: 'directly-changed-projects-first',
      directProjects: ['plugin-news'],
      remainingProjects: ['routing', 'sva-studio-react'],
      unmappedFiles: [],
    });
  });

  it('maps workflow and CI scripts to tooling-testing', () => {
    const plan = planChangedProjects(
      ['.github/workflows/quality-gates.yml', 'scripts/ci/affected-unit-gate.ts'],
      ['sva-studio-react', 'tooling-testing'],
      PROJECTS
    );

    expect(plan.directProjects).toEqual(['tooling-testing']);
    expect(plan.remainingProjects).toEqual(['sva-studio-react']);
    expect(plan.unmappedFiles).toEqual([]);
  });

  it('uses the longest matching project root', () => {
    const plan = planChangedProjects(
      ['packages/plugin-news/src/index.ts'],
      ['packages', 'plugin-news'],
      [...PROJECTS, { name: 'packages', root: 'packages' }]
    );

    expect(plan.directProjects).toEqual(['plugin-news']);
  });

  it('keeps unmapped code changes in the conservative affected remainder', () => {
    expect(planChangedProjects(['nx.json'], ['routing', 'sva-studio-react'], PROJECTS)).toEqual({
      mode: 'affected-fallback',
      reason: 'no-safe-direct-project-mapping',
      directProjects: [],
      remainingProjects: ['routing', 'sva-studio-react'],
      unmappedFiles: ['nx.json'],
    });
  });

  it('ignores documentation-only files when planning direct projects', () => {
    expect(planChangedProjects(['docs/guide.md'], [], PROJECTS)).toEqual({
      mode: 'affected-fallback',
      reason: 'no-affected-projects',
      directProjects: [],
      remainingProjects: [],
      unmappedFiles: [],
    });
  });

  it('falls back to the complete affected scope when the Nx project graph is unavailable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(
      planChangedProjectsWithFallback(
        ['packages/plugin-news/src/index.ts', 'packages\\routing\\src\\index.ts'],
        ['routing', 'plugin-news', 'routing'],
        () => {
          throw new Error('graph unavailable');
        }
      )
    ).toEqual({
      mode: 'affected-fallback',
      reason: 'nx-project-graph-unavailable',
      directProjects: [],
      remainingProjects: ['plugin-news', 'routing'],
      unmappedFiles: ['packages/plugin-news/src/index.ts', 'packages/routing/src/index.ts'],
    });
    expect(warn).toHaveBeenCalledWith(
      'Nx-Projektgraph konnte nicht geladen werden; verwende vollständigen affected-Fallback: graph unavailable'
    );

    warn.mockRestore();
  });
});
