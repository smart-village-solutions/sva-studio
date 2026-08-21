import type { IamContentListItem } from '@sva/core';
import { resolveMainserverGenericItemContentType } from '@sva/plugin-sdk';
import {
  listSvaMainserverEvents,
  listSvaMainserverGenericItems,
  listSvaMainserverNews,
  listSvaMainserverPoi,
  listSvaMainserverSurveys,
} from '@sva/sva-mainserver/server';

import {
  mapEventItem,
  mapGenericItem,
  mapNewsItem,
  mapPoiItem,
  mapSurveyItem,
} from './iam-content-list-mainserver.js';
import type { MainserverContentType } from './iam-content-list-api.shared.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionRowInput,
} from './iam-content-list-projection-model.server.js';
import { studioMainserverGenericTypeRegistry } from './mainserver-generic-type-registry.server.js';

const MAX_SYNC_ITEMS_PER_TYPE = 5_000;
export const GENERIC_ITEMS_CONTENT_TYPE = 'generic-items.generic-item' as const;
export const registeredGenericItemContentTypes = new Set<string>(
  studioMainserverGenericTypeRegistry.values()
);
export const resolveGenericItemProjectionContentType = (genericType: string): string =>
  resolveMainserverGenericItemContentType(
    studioMainserverGenericTypeRegistry,
    genericType,
    GENERIC_ITEMS_CONTENT_TYPE
  );
export type MainserverProjectionLoadedPage = Readonly<{
  readonly rows: readonly MainserverProjectionRowInput[];
  readonly hasNextPage: boolean;
  readonly nextPage: number;
  readonly nextGenericItemScanOffset?: number;
  readonly skippedInvalidCount: number;
}>;

export type MainserverProjectionPageResult<TItem> = {
  readonly credentialSource?: IamContentListItem['credentialSource'];
  readonly data: readonly TItem[];
  readonly pagination: {
    readonly hasNextPage: boolean;
    readonly page?: number;
    readonly nextGenericItemScanOffset?: number;
  };
};

const resolveMainserverProjectionCredentialSource = <TItem>(
  result: MainserverProjectionPageResult<TItem>,
  actingPrincipalType?: 'organization' | 'user'
): IamContentListItem['credentialSource'] =>
  result.credentialSource ?? actingPrincipalType ?? 'user';

export const hasNextProjectionPage = (
  result: MainserverProjectionPageResult<unknown>,
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  },
  continueAfterEmptyPage = true
): boolean => {
  const nextPage = result.pagination.page ?? pageQuery.page;
  return (
    (continueAfterEmptyPage || result.data.length > 0) &&
    nextPage >= pageQuery.page &&
    result.pagination.hasNextPage &&
    pageQuery.page * pageQuery.pageSize < MAX_SYNC_ITEMS_PER_TYPE
  );
};

const buildLoadedProjectionPage = <TItem>(input: {
  readonly result: MainserverProjectionPageResult<TItem>;
  readonly pagingResult?: MainserverProjectionPageResult<unknown>;
  readonly pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  };
  readonly mapRow: (
    item: TItem,
    credentialSource: IamContentListItem['credentialSource']
  ) => MainserverProjectionRowInput;
  readonly projectedOrganizationId: string | undefined;
  readonly actingPrincipalType?: 'organization' | 'user';
  readonly continueAfterEmptyPage?: boolean;
}): MainserverProjectionLoadedPage => {
  const credentialSource = resolveMainserverProjectionCredentialSource(
    input.result,
    input.actingPrincipalType
  );
  const pagingResult = input.pagingResult ?? input.result;
  const nextPage = pagingResult.pagination.page ?? input.pageQuery.page;

  return {
    rows: input.result.data.map((item) => input.mapRow(item, credentialSource)),
    hasNextPage: hasNextProjectionPage(pagingResult, input.pageQuery, input.continueAfterEmptyPage),
    nextPage: nextPage + 1,
    skippedInvalidCount: 0,
  };
};

type MainserverProjectionPageLoader = (
  input: Readonly<{
    target: ContentProjectionSyncTarget;
    pageQuery: {
      readonly page: number;
      readonly pageSize: number;
    };
  }>
) => Promise<MainserverProjectionLoadedPage>;

export const toProjectionPrincipalContext = (target: ContentProjectionSyncTarget) =>
  target.actingPrincipalType ? { actingPrincipalType: target.actingPrincipalType } : {};

const createGenericItemPageLoader =
  (options: {
    readonly overrideContentType: boolean;
    readonly continueAfterEmptyPage?: boolean;
  }): MainserverProjectionPageLoader =>
  async ({ target, pageQuery }) => {
    const result = await listSvaMainserverGenericItems({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      includeInvisible: true,
      ...pageQuery,
    });
    const projectedItems = result.data.filter(
      (item) => resolveGenericItemProjectionContentType(item.genericType) === target.contentType
    );

    return buildLoadedProjectionPage({
      result: { ...result, data: projectedItems },
      pagingResult: result,
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapGenericItem(item, target.instanceId, []),
        ...(options.overrideContentType ? { contentType: target.contentType } : {}),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: target.contentType,
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      ...(options.continueAfterEmptyPage ? { continueAfterEmptyPage: true } : {}),
    });
  };

export const mainserverProjectionPageLoaders: Record<
  MainserverContentType,
  MainserverProjectionPageLoader
> = {
  'events.event-record': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverEvents({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeInvisible: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapEventItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'events.event-record',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
  'generic-items.generic-item': createGenericItemPageLoader({ overrideContentType: false }),
  'faq.faq': createGenericItemPageLoader({ overrideContentType: true }),
  'cockpit-cards.cockpit-card': createGenericItemPageLoader({ overrideContentType: true }),
  'projects.project': createGenericItemPageLoader({
    overrideContentType: true,
    continueAfterEmptyPage: true,
  }),
  'news.article': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverNews({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeInvisible: true,
        orderBy: 'updatedAt_DESC',
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapNewsItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'news.article',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
  'poi.point-of-interest': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverPoi({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeInvisible: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapPoiItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'poi.point-of-interest',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
  'surveys.survey': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverSurveys({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeArchived: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapSurveyItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'surveys.survey',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
};
