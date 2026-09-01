import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
  const syncStartedMessageRef = useRef<StatusMessage | null>(null);

  const showSyncStarted = () => {
    const message: StatusMessage = {
      kind: 'success',
      text: pt('settings.messages.wasteTypesSyncStarted'),
    };
    syncStartedMessageRef.current = message;
    setMessage(message);
  };

  const warnAboutSync = () => {
    setTrackedJob(null);
    syncStartedMessageRef.current = null;
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
      const syncStartedMessage = syncStartedMessageRef.current;
      syncStartedMessageRef.current = null;
      setMessage((currentMessage) => (currentMessage === syncStartedMessage ? null : currentMessage));
    },
  });

  const applyMutationFeedback = (result: WasteManagementSettingsMutationResponse) => {
    if (result.syncStatus === 'queued' && result.syncJob) {
      setTrackedJob(result.syncJob);
      showSyncStarted();
      return;
    }
    if (result.syncStatus === 'failed') {
      warnAboutSync();
      return;
    }
    syncStartedMessageRef.current = null;
    setMessage(null);
  };

  const retrySync = async () => {
    setMessage(null);
    try {
      const job = await startWasteManagementSyncWasteTypes();
      setTrackedJob(job ?? null);
      showSyncStarted();
    } catch {
      warnAboutSync();
    }
  };

  return { applyMutationFeedback, retrySync };
};
