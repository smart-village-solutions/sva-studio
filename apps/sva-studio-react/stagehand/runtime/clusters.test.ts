import { describe, expect, it } from 'vitest';

import {
  buildStagehandStoryClusters,
  getStagehandClusterDefinition,
  resolveStagehandStoryCluster,
  type StagehandClusterDefinition,
} from './clusters.ts';
import type { StagehandStoryRecord } from '../stories/state.ts';

function createStory(overrides: Partial<StagehandStoryRecord> & Pick<StagehandStoryRecord, 'id' | 'packageId'>): StagehandStoryRecord {
  return {
    acceptanceCriteria: [],
    evidence: [],
    id: overrides.id,
    legacy: true,
    legacyId: overrides.id,
    packageId: overrides.packageId,
    packageTitle: overrides.packageTitle ?? overrides.packageId,
    preconditions: [],
    priority: 1,
    relatedPackageIds: [],
    role: overrides.role ?? 'Organisations-Admin',
    story: overrides.story ?? `Story ${overrides.id}`,
    studioCheck: {
      status: 'offen',
      coverage: 'nicht_geprueft',
      notes: '',
    },
    trigger: 'fixture',
  };
}

describe('stagehand cluster definitions', () => {
  it('resolves tenant isolation as an explicit cross-tenant capability cluster', () => {
    const cluster = resolveStagehandStoryCluster(
      createStory({
        id: 37,
        packageId: 'IAM-P5',
        story: 'Mandanten bleiben getrennt sichtbar.',
      })
    );

    expect(cluster.id).toBe('tenant-isolation');
    expect(cluster.entity).toBe('tenant');
    expect(cluster.action).toBe('isolate');
    expect(cluster.tenantAxis).toBe('cross-tenant');
    expect(cluster.audit).toBe('required');
  });

  it('builds grouped clusters from explicit definitions instead of ad-hoc story heuristics', () => {
    const clusters = buildStagehandStoryClusters([
      createStory({ id: 18, packageId: 'IAM-P2', story: 'Nutzer anlegen im Mandanten.' }),
      createStory({ id: 37, packageId: 'IAM-P5', story: 'Mandanten trennen.' }),
      createStory({ id: 23, packageId: 'IAM-P4', story: 'Rollen und Rechte verwalten.' }),
    ]);

    expect(clusters.map((cluster) => cluster.definition.id)).toEqual([
      'tenant-user-create',
      'role-and-permission-management',
      'tenant-isolation',
    ]);
    expect(clusters.find((cluster) => cluster.definition.id === 'tenant-isolation')?.stories.map((story) => story.id)).toEqual([
      37,
    ]);
  });

  it('prefers story-specific isolation mapping even outside the package fallback', () => {
    const cluster = resolveStagehandStoryCluster(
      createStory({
        id: 19,
        packageId: 'IAM-P3',
        story: 'Mandantenfremde Daten bleiben unsichtbar.',
      })
    );

    expect(cluster.id).toBe('tenant-isolation');
  });

  it('falls back to audit-and-monitoring for unmatched stories', () => {
    const cluster = resolveStagehandStoryCluster(
      createStory({
        id: 999,
        packageId: 'IAM-P9',
        story: 'Nicht klassifizierte Reststory.',
      })
    );

    expect(cluster.id).toBe('audit-and-monitoring');
  });

  it('exposes stable cluster metadata for reporting and executor routing', () => {
    const definition = getStagehandClusterDefinition('tenant-user-create');

    expect(definition).toMatchObject({
      id: 'tenant-user-create',
      entity: 'user',
      action: 'create',
      tenantAxis: 'in-tenant',
      audit: 'supporting',
    } satisfies Partial<StagehandClusterDefinition>);
  });

  it('throws for unknown cluster definitions', () => {
    expect(() => getStagehandClusterDefinition('unknown-cluster')).toThrow(
      'Unknown Stagehand cluster definition: unknown-cluster'
    );
  });

  it('sorts stories within a cluster by story id', () => {
    const clusters = buildStagehandStoryClusters([
      createStory({ id: 24, packageId: 'IAM-P4' }),
      createStory({ id: 18, packageId: 'IAM-P2' }),
      createStory({ id: 23, packageId: 'IAM-P4' }),
    ]);

    expect(
      clusters.find((cluster) => cluster.definition.id === 'role-and-permission-management')?.stories.map(
        (story) => story.id
      )
    ).toEqual([23, 24]);
  });
});
