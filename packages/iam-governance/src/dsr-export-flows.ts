import { runSelfExport } from './dsr-export-flow-self.js';
import { runAdminExport } from './dsr-export-flow-admin.js';
import type { DsrExportFlowDeps } from './dsr-export-flow-types.js';

export type {
  DsrExportRequestInput,
  DsrAdminExportRequestInput,
  DsrIdempotencyReservation,
  DsrExportFlowDeps,
} from './dsr-export-flow-types.js';

export const createDsrExportFlows = (deps: DsrExportFlowDeps) => ({
  runSelfExport: (input: Parameters<typeof runSelfExport>[1]) => runSelfExport(deps, input),
  runAdminExport: (input: Parameters<typeof runAdminExport>[1]) => runAdminExport(deps, input),
});
