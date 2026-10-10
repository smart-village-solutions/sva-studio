import type {
  WasteManagementHistoryOverview,
  WasteManagementTechnicalHistoryRecord,
} from '@sva/waste-management-contracts';
import type { WasteServerLoaderHost } from './server-loaders.js';
import { WasteHistoryJobLoader, type WasteHistoryQuery } from './server-loaders.history-jobs.js';
import {
  listWasteManagementAuditRecords,
  listWasteManagementTechnicalAuditRecords,
} from './audit/read-models.js';

export class WasteHistoryLoaders {
  private readonly jobs: WasteHistoryJobLoader;
  constructor(private readonly host: WasteServerLoaderHost) {
    this.jobs = new WasteHistoryJobLoader(host);
  }

  private loadLatestPostalCodeJob = (query: WasteHistoryQuery) =>
    this.host.withStudioJobRepository(query.instanceId, async (repository) => {
      for (const view of ['active', 'history'] as const) {
        const page = await repository.listJobs(query.instanceId, {
          view,
          page: 1,
          pageSize: 1,
          pluginId: 'waste-management',
          jobTypeId: 'waste-management.enrich-postal-codes',
        });
        const latest = page.items[0];
        if (latest) return repository.getJobDetail(query.instanceId, latest.id);
      }
      return null;
    });

  private loadTechnicalAuditHistoryPrefix = async (
    query: WasteHistoryQuery,
    technicalLimit: number
  ): Promise<{
    readonly items: readonly WasteManagementTechnicalHistoryRecord[];
    readonly total: number;
  }> => {
    const items: WasteManagementTechnicalHistoryRecord[] = [];
    let currentPage = 1;
    let total: number;

    do {
      const technicalAuditPage = await this.host.withInstanceDb(query.instanceId, (client) =>
        listWasteManagementTechnicalAuditRecords(client, {
          ...query,
          page: currentPage,
          pageSize: query.pageSize,
        })
      );
      items.push(...technicalAuditPage.items);
      total = technicalAuditPage.total;
      currentPage += 1;
    } while (items.length < total && items.length < technicalLimit);

    return {
      items,
      total,
    };
  };

  loadWasteHistoryOverview = async (
    query: WasteHistoryQuery
  ): Promise<WasteManagementHistoryOverview> => {
    const audit = await this.host.withInstanceDb(query.instanceId, (client) =>
      listWasteManagementAuditRecords(client, query)
    );
    const technicalOffset = (query.page - 1) * query.pageSize;
    const technicalLimit = technicalOffset + query.pageSize;
    const [
      { items: technicalJobItems, total: technicalJobTotal },
      { items: technicalAuditItems, total: technicalAuditTotal },
      latestPostalCodeJob,
    ] = await Promise.all([
      this.jobs.loadTechnicalJobHistoryPage(query, technicalLimit),
      this.loadTechnicalAuditHistoryPrefix(query, technicalLimit),
      this.loadLatestPostalCodeJob(query),
    ]);

    const mergedTechnicalItems = [...technicalAuditItems, ...technicalJobItems].sort(
      (left, right) => right.occurredAt.localeCompare(left.occurredAt)
    );

    return {
      audit,
      ...(latestPostalCodeJob ? { latestPostalCodeJob } : {}),
      technical: {
        items: mergedTechnicalItems.slice(technicalOffset, technicalOffset + query.pageSize),
        total: technicalAuditTotal + technicalJobTotal,
      },
    };
  };
}
