import type { WasteTenantProvisioningRecord } from '@sva/waste-management-contracts';
import type { SqlStatement } from '@sva/data-repositories';
import { createWasteProvisioningRepository } from './waste-provisioning.js';

export type WasteProvisioningDbClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ readonly rowCount: number | null; readonly rows: readonly TRow[] }>;
};

export type WasteProvisioningAccess = Readonly<{
  loadWasteTenantProvisioningRecord(
    instanceId: string
  ): Promise<WasteTenantProvisioningRecord | null>;
  requestWasteTenantProvisioning(instanceId: string): Promise<WasteTenantProvisioningRecord>;
  disableWasteTenantProvisioning(instanceId: string): Promise<WasteTenantProvisioningRecord | null>;
  claimWasteTenantProvisioning(input: {
    readonly instanceId: string;
    readonly jobId: string;
    readonly desiredGeneration: number;
  }): Promise<WasteTenantProvisioningRecord | null>;
  completeWasteTenantProvisioning(input: {
    readonly instanceId: string;
    readonly jobId: string;
    readonly desiredGeneration: number;
    readonly databaseName: string;
    readonly interfaceId: string;
  }): Promise<WasteTenantProvisioningRecord | null>;
  failWasteTenantProvisioning(input: {
    readonly instanceId: string;
    readonly jobId: string;
    readonly desiredGeneration: number;
    readonly errorCode: string;
    readonly errorMessage: string;
  }): Promise<WasteTenantProvisioningRecord | null>;
  failWasteTenantProvisioningRequest(input: {
    readonly instanceId: string;
    readonly desiredGeneration: number;
    readonly errorCode: string;
    readonly errorMessage: string;
  }): Promise<WasteTenantProvisioningRecord | null>;
}>;

export const createWasteProvisioningAccess = (
  withInstanceDb: <T>(
    instanceId: string,
    work: (client: WasteProvisioningDbClient) => Promise<T>
  ) => Promise<T>
): WasteProvisioningAccess => {
  const withRepository = <T>(
    instanceId: string,
    work: (repository: ReturnType<typeof createWasteProvisioningRepository>) => Promise<T>
  ) =>
    withInstanceDb(instanceId, async (client) =>
      work(
        createWasteProvisioningRepository({
          async execute<TRow = Record<string, unknown>>(query: SqlStatement) {
            const result = await client.query<TRow>(query.text, query.values);
            return { rowCount: result.rowCount ?? 0, rows: result.rows };
          },
        })
      )
    );

  return {
    loadWasteTenantProvisioningRecord: (instanceId) =>
      withRepository(instanceId, (repository) => repository.getWasteProvisioning(instanceId)),
    requestWasteTenantProvisioning: (instanceId) =>
      withRepository(instanceId, (repository) => repository.requestWasteProvisioning(instanceId)),
    disableWasteTenantProvisioning: (instanceId) =>
      withRepository(instanceId, (repository) => repository.disableWasteProvisioning(instanceId)),
    claimWasteTenantProvisioning: (input) =>
      withRepository(input.instanceId, (repository) => repository.claimWasteProvisioning(input)),
    completeWasteTenantProvisioning: (input) =>
      withRepository(input.instanceId, (repository) => repository.completeWasteProvisioning(input)),
    failWasteTenantProvisioning: (input) =>
      withRepository(input.instanceId, (repository) => repository.failWasteProvisioning(input)),
    failWasteTenantProvisioningRequest: (input) =>
      withRepository(input.instanceId, (repository) =>
        repository.failWasteProvisioningRequest(input)
      ),
  };
};
