import type { AdminExplorationStoryRecord } from '../stories/state.js';

export type AdminExplorationClusterEntity = 'audit' | 'legal' | 'permission' | 'role' | 'tenant' | 'user';
export type AdminExplorationClusterAction = 'assign' | 'audit' | 'create' | 'govern' | 'inspect' | 'isolate' | 'login' | 'manage';
export type AdminExplorationClusterTenantAxis = 'cross-tenant' | 'in-tenant' | 'tenant-context';
export type AdminExplorationClusterAuditMode = 'none' | 'required' | 'supporting';

export interface AdminExplorationClusterDefinition {
  readonly action: AdminExplorationClusterAction;
  readonly audit: AdminExplorationClusterAuditMode;
  readonly entity: AdminExplorationClusterEntity;
  readonly id: string;
  readonly packageIds?: readonly string[];
  readonly reason: string;
  readonly storyIds?: readonly number[];
  readonly tenantAxis: AdminExplorationClusterTenantAxis;
}

export interface AdminExplorationStoryClusterGroup {
  readonly definition: AdminExplorationClusterDefinition;
  readonly stories: readonly AdminExplorationStoryRecord[];
}

const IAM_EXPLORE_CLUSTER_DEFINITIONS = [
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
] as const satisfies readonly AdminExplorationClusterDefinition[];

export const IAM_EXPLORE_CLUSTER_IDS = IAM_EXPLORE_CLUSTER_DEFINITIONS.map((definition) => definition.id);

function matchesDefinition(definition: AdminExplorationClusterDefinition, story: AdminExplorationStoryRecord): boolean {
  if (definition.storyIds?.includes(story.id) === true) {
    return true;
  }

  return definition.packageIds?.includes(story.packageId) ?? false;
}

export function getAdminExplorationClusterDefinition(clusterId: string): AdminExplorationClusterDefinition {
  const definition = IAM_EXPLORE_CLUSTER_DEFINITIONS.find((entry) => entry.id === clusterId);

  if (definition === undefined) {
    throw new Error(`Unknown AdminExploration cluster definition: ${clusterId}`);
  }

  return definition;
}

export function resolveAdminExplorationStoryCluster(story: AdminExplorationStoryRecord): AdminExplorationClusterDefinition {
  return (
    IAM_EXPLORE_CLUSTER_DEFINITIONS.find((definition) => matchesDefinition(definition, story)) ??
    getAdminExplorationClusterDefinition('audit-and-monitoring')
  );
}

export function buildAdminExplorationStoryClusters(stories: readonly AdminExplorationStoryRecord[]): AdminExplorationStoryClusterGroup[] {
  const grouped = new Map<string, AdminExplorationStoryRecord[]>();

  for (const story of stories) {
    const cluster = resolveAdminExplorationStoryCluster(story);
    grouped.set(cluster.id, [...(grouped.get(cluster.id) ?? []), story]);
  }

  return [...grouped.entries()]
    .map(([clusterId, clusterStories]) => ({
      definition: getAdminExplorationClusterDefinition(clusterId),
      stories: [...clusterStories].sort((left, right) => left.id - right.id),
    }))
    .sort((left, right) => (left.stories[0]?.id ?? Number.MAX_SAFE_INTEGER) - (right.stories[0]?.id ?? Number.MAX_SAFE_INTEGER));
}
