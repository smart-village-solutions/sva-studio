import { useState, type Dispatch, type SetStateAction } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import {
  startWasteManagementSyncWasteTypes,
  type WasteManagementSettingsMutationResponse,
} from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';
import { useWasteTrackedJob } from './waste-management.tools.job-state.js';

type PluginTranslation = ReturnType<typeof usePluginTranslation>;
type SyncJob = NonNullable<WasteManagementSettingsMutationResponse['syncJob']>;
const refreshNoTechnicalHistory = async () => undefined;

export const useWasteSettingsSyncFeedback = (
  pt: PluginTranslation,
  setMessage: Dispatch<SetStateAction<StatusMessage | null>>
) => {
  const [trackedJob, setTrackedJob] = useState<SyncJob | null>(null);
  const syncStartedMessage = pt('settings.messages.wasteTypesSyncStarted');

  const warnAboutSync = () => {
    setTrackedJob(null);
    setMessage({
      kind: 'warning',
      text: pt('settings.messages.wasteTypesSyncWarning'),
      retryAction: 'sync-waste-types',
    });
  };

  useWasteTrackedJob({
    lastJob: trackedJob,
    refreshTechnicalHistory: refreshNoTechnicalHistory,
    setLastJob: setTrackedJob,
    onTerminalJob: (job) => {
      if (job.status === 'failed' || job.status === 'cancelled') {
        warnAboutSync();
        return;
      }
      setTrackedJob(null);
      setMessage((currentMessage) =>
        currentMessage?.text === syncStartedMessage ? null : currentMessage
      );
    },
  });

  const applyMutationFeedback = (result: WasteManagementSettingsMutationResponse) => {
    if (result.syncStatus === 'queued' && result.syncJob) {
      setTrackedJob(result.syncJob);
      setMessage({ kind: 'success', text: syncStartedMessage });
      return;
    }
    if (result.syncStatus === 'failed') {
      warnAboutSync();
      return;
    }
    setMessage(null);
  };

  const retrySync = async () => {
    setMessage(null);
    try {
      const job = await startWasteManagementSyncWasteTypes();
      setTrackedJob(job ?? null);
      setMessage({ kind: 'success', text: syncStartedMessage });
    } catch {
      warnAboutSync();
    }
  };

  return { applyMutationFeedback, retrySync };
};
