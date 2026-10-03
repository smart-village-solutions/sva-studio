import type { DsrExportFormat } from './dsr-export-payload.js';

export type DsrExportRequestInput = {
  instanceId?: string;
  format: DsrExportFormat;
  async: boolean;
};

export type DsrAdminExportRequestInput = DsrExportRequestInput & {
  targetKeycloakSubject: string;
};

export type DsrIdempotencyReservation =
  | { status: 'reserved' }
  | { status: 'replay'; responseStatus: number; responseBody: unknown }
  | { status: 'conflict'; message: string };

export type DsrExportFlowDeps = {
  readonly reserveIdempotency: (input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    payloadHash: string;
  }) => Promise<DsrIdempotencyReservation>;
  readonly completeIdempotency: (input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    status: 'COMPLETED';
    responseStatus: number;
    responseBody: unknown;
  }) => Promise<void>;
  readonly toPayloadHash: (body: string) => string;
  readonly createAsyncStudioJob: (input: {
    instanceId: string;
    exportJobId: string;
    requestedByAccountId: string;
    targetAccountId: string;
    format: DsrExportFormat;
  }) => Promise<{ id: string }>;
  readonly jsonResponse: (status: number, body: unknown) => Response;
  readonly textResponse: (status: number, body: string, contentType: string) => Response;
};
