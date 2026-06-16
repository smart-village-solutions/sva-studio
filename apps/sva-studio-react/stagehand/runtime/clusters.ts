import type { StagehandStoryRecord } from '../stories/state.js';

export type StagehandClusterEntity = 'audit' | 'legal' | 'permission' | 'role' | 'tenant' | 'user';
export type StagehandClusterAction = 'assign' | 'audit' | 'create' | 'govern' | 'inspect' | 'isolate' | 'login' | 'manage';
export type StagehandClusterTenantAxis = 'cross-tenant' | 'in-tenant' | 'tenant-context';
export type StagehandClusterAuditMode = 'none' | 'required' | 'supporting';

export interface StagehandClusterDefinition {
  readonly action: StagehandClusterAction;
  readonly audit: StagehandClusterAuditMode;
  readonly entity: StagehandClusterEntity;
  readonly id: string;
  readonly packageIds?: readonly string[];
  readonly reason: string;
  readonly storyIds?: readonly number[];
  readonly tenantAxis: StagehandClusterTenantAxis;
}

export interface StagehandStoryClusterGroup {
  readonly definition: StagehandClusterDefinition;
  readonly stories: readonly StagehandStoryRecord[];
}

const STAGEHAND_CLUSTER_DEFINITIONS = [
  {
    id: 'tenant-user-create',
    entity: 'user',
    action: 'create',
    tenantAxis: 'in-tenant',
    audit: 'supporting',
    storyIds: [18],
    reason: 'Tenant-Mutationslauf für Nutzeranlage und Sichtbarkeit im Mandantenkontext.',
  },
  {
    id: 'tenant-isolation',
    entity: 'tenant',
    action: 'isolate',
    tenantAxis: 'cross-tenant',
    audit: 'required',
    storyIds: [19],
    packageIds: ['IAM-P5'],
    reason: 'Mandanten- und Sichttrennung erfordert Positiv- und Negativnachweise über Tenant-Grenzen.',
  },
  {
    id: 'tenant-login-context',
    entity: 'tenant',
    action: 'login',
    tenantAxis: 'tenant-context',
    audit: 'supporting',
    packageIds: ['IAM-P1'],
    reason: 'Login- und Einstiegsszenarien benötigen tenant-spezifischen UI-Kontext.',
  },
  {
    id: 'tenant-user-lifecycle',
    entity: 'user',
    action: 'manage',
    tenantAxis: 'in-tenant',
    audit: 'supporting',
    packageIds: ['IAM-P2'],
    reason: 'Onboarding- und Lebenszykluspfade laufen über tenant-nahe Nutzerverwaltung.',
  },
  {
    id: 'tenant-user-assignments',
    entity: 'user',
    action: 'assign',
    tenantAxis: 'in-tenant',
    audit: 'supporting',
    packageIds: ['IAM-P3'],
    reason: 'Organisations- und Bereichszuordnungen sind tenantgebundene Admin-Flows.',
  },
  {
    id: 'role-and-permission-management',
    entity: 'role',
    action: 'manage',
    tenantAxis: 'in-tenant',
    audit: 'required',
    packageIds: ['IAM-P4'],
    reason: 'Rollen-, Gruppen- und Rechtebeweise erfordern dedizierte Admin-Oberflächen.',
  },
  {
    id: 'legal-text-governance',
    entity: 'legal',
    action: 'govern',
    tenantAxis: 'in-tenant',
    audit: 'required',
    packageIds: ['IAM-P6'],
    reason: 'Rechtstexte und Zustimmungen sind separate Governance-Flows.',
  },
  {
    id: 'audit-and-monitoring',
    entity: 'audit',
    action: 'audit',
    tenantAxis: 'tenant-context',
    audit: 'required',
    reason: 'Audit-, Monitoring- oder Betriebsnachweise liegen nicht direkt in einer lokalen UI vor.',
  },
] as const satisfies readonly StagehandClusterDefinition[];

export const STAGEHAND_CLUSTER_IDS = STAGEHAND_CLUSTER_DEFINITIONS.map((definition) => definition.id);

function matchesDefinition(definition: StagehandClusterDefinition, story: StagehandStoryRecord): boolean {
  if (definition.storyIds?.includes(story.id) === true) {
    return true;
  }

  return definition.packageIds?.includes(story.packageId) ?? false;
}

export function getStagehandClusterDefinition(clusterId: string): StagehandClusterDefinition {
  const definition = STAGEHAND_CLUSTER_DEFINITIONS.find((entry) => entry.id === clusterId);

  if (definition === undefined) {
    throw new Error(`Unknown Stagehand cluster definition: ${clusterId}`);
  }

  return definition;
}

export function resolveStagehandStoryCluster(story: StagehandStoryRecord): StagehandClusterDefinition {
  return (
    STAGEHAND_CLUSTER_DEFINITIONS.find((definition) => matchesDefinition(definition, story)) ??
    getStagehandClusterDefinition('audit-and-monitoring')
  );
}

export function buildStagehandStoryClusters(stories: readonly StagehandStoryRecord[]): StagehandStoryClusterGroup[] {
  const grouped = new Map<string, StagehandStoryRecord[]>();

  for (const story of stories) {
    const cluster = resolveStagehandStoryCluster(story);
    grouped.set(cluster.id, [...(grouped.get(cluster.id) ?? []), story]);
  }

  return [...grouped.entries()]
    .map(([clusterId, clusterStories]) => ({
      definition: getStagehandClusterDefinition(clusterId),
      stories: [...clusterStories].sort((left, right) => left.id - right.id),
    }))
    .sort((left, right) => (left.stories[0]?.id ?? Number.MAX_SAFE_INTEGER) - (right.stories[0]?.id ?? Number.MAX_SAFE_INTEGER));
}
