import type { IamInstanceRealmCatalog, IamInstanceRealmCatalogEntry } from '@sva/core';
import type { InstanceRegistryServiceDeps } from './service-types.js';

export type RealmCatalogEntry = IamInstanceRealmCatalogEntry;
export type RealmCatalog = IamInstanceRealmCatalog;

export const createListRealmCatalogHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (
    input: {
      search?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<RealmCatalog> => {
    if (!deps.listKeycloakRealms) throw new Error('keycloak_realm_catalog_unavailable');
    const [realms, instances] = await Promise.all([
      deps.listKeycloakRealms(),
      deps.repository.listInstances(),
    ]);
    const assignments = new Map(
      instances.map((instance) => [instance.authRealm, instance.instanceId])
    );
    const search = input.search?.trim().toLocaleLowerCase('en-US');
    const entries = realms
      .filter(({ realm }) => !search || realm.toLocaleLowerCase('en-US').includes(search))
      .sort((left, right) => left.realm.localeCompare(right.realm, 'en'))
      .map(({ realm }): RealmCatalogEntry => {
        if (realm === 'master') return { realm, status: 'disabled', reasonCode: 'system_realm' };
        const assignedInstanceId = assignments.get(realm);
        return assignedInstanceId
          ? { realm, status: 'disabled', reasonCode: 'already_assigned', assignedInstanceId }
          : { realm, status: 'selectable' };
      });
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
    const offset = (page - 1) * pageSize;
    return {
      data: entries.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: entries.length,
    };
  };
