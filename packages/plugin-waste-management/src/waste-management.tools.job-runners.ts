import type { StudioJobResponse } from '@sva/plugin-sdk';

import { deleteWasteManagementHistoryJob } from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';
import { createWasteToolErrorMessage } from './waste-management.tools.messages.js';

export type Translate = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;
export type Action = 'export' | 'import' | 'migration' | 'postalCode' | 'seed' | 'reset';

export const createWasteToolsJobRunner =
  ({
    pt,
    refreshTechnicalHistory,
    setRunningAction,
    setMessage,
    setLastJob,
  }: {
    readonly pt: Translate;
    readonly refreshTechnicalHistory: (active?: boolean) => Promise<void>;
    readonly setRunningAction: (action: Action | null) => void;
    readonly setMessage: (message: StatusMessage | null) => void;
    readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
  }) =>
  async (action: Action, callback: () => Promise<StudioJobResponse['data']>) => {
    setRunningAction(action);
    setMessage(null);
    try {
      const job = await callback();
      setLastJob(job);
      await refreshTechnicalHistory();
      setMessage({ kind: 'success', text: pt('tools.messages.jobStarted', { jobId: job.id }) });
      return job;
    } catch (error) {
      setMessage({
        kind: 'error',
        text: createWasteToolErrorMessage({ action, error, pt }),
      });
      return null;
    } finally {
      setRunningAction(null);
    }
  };

export const createWasteToolsHistoryDeletionRunner =
  ({
    pt,
    refreshTechnicalHistory,
    setMessage,
    setLastJob,
  }: {
    readonly pt: Translate;
    readonly refreshTechnicalHistory: (active?: boolean) => Promise<void>;
    readonly setMessage: (message: StatusMessage | null) => void;
    readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
  }) =>
  async (jobId: string, currentLastJobId?: string) => {
    setMessage(null);
    try {
      await deleteWasteManagementHistoryJob(jobId);
      if (currentLastJobId === jobId) {
        setLastJob(null);
      }
    } catch (error) {
      setMessage({
        kind: 'error',
        text: createWasteToolErrorMessage({ action: 'historyDelete', error, pt }),
      });
      return false;
    }
    try {
      await refreshTechnicalHistory(true);
    } catch {
      setMessage({
        kind: 'warning',
        text: pt('tools.messages.historyRefreshAfterDeleteError'),
      });
      return true;
    }
    setMessage({ kind: 'success', text: pt('tools.messages.historyDeleteSuccess') });
    return true;
  };
