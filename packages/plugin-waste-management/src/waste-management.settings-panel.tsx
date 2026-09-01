import { startTransition, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState, useStudioSaveFeedback } from '@sva/studio-ui-react';
import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';

import {
  getWasteManagementSettings,
  retryWasteTenantProvisioning,
} from './waste-management.api.js';
import {
  StatusNotice,
  resolveApiErrorCode,
  type StatusMessage,
} from './waste-management.page.support.js';
import { WasteSettingsForm } from './waste-management.settings-form.js';
import { WasteSettingsStatusPanel } from './waste-management.settings-status-panel.js';
import {
  mapWasteSettingsToForm,
  persistWasteSettings,
  useWasteSettingsState,
} from './waste-management.settings-panel.support.js';
import { useWasteSettingsSyncFeedback } from './waste-management.settings-panel.sync.js';

export const WasteSettingsPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const saveFeedback = useStudioSaveFeedback();
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const { error, form, loading, setForm, setSettings, settings } = useWasteSettingsState(pt);
  const syncFeedback = useWasteSettingsSyncFeedback(pt, setMessage);

  if (loading) {
    return <StudioLoadingState>{pt('settings.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const applyPersistedSettings = (result: WasteManagementSettingsRecord | null) => {
    startTransition(() => {
      setSettings(result);
      setForm(mapWasteSettingsToForm(result));
    });
  };

  const handleSubmit = async () => {
    const operationId = saveFeedback.beginSaving();
    const holidaySyncTriggered =
      Boolean(form.holidayStateCode) && form.holidayStateCode !== settings?.holidayStateCode;

    try {
      const result = await persistWasteSettings(form, pt);
      applyPersistedSettings(result.data);
      if (
        holidaySyncTriggered &&
        result.data.lastHolidaySyncStatus &&
        result.data.lastHolidaySyncStatus !== 'success'
      ) {
        setMessage({
          kind: result.data.lastHolidaySyncStatus === 'failed' ? 'error' : 'warning',
          text: pt('settings.messages.saveSuccessWithHolidaySync', {
            status: result.data.lastHolidaySyncStatus,
          }),
        });
        saveFeedback.markFailed(operationId);
        return;
      }
      syncFeedback.applyMutationFeedback(result);
      saveFeedback.markSaved(operationId);
    } catch (saveError) {
      setMessage({
        kind: 'error',
        text: saveError instanceof Error ? saveError.message : pt('settings.messages.saveError'),
      });
      saveFeedback.markFailed(operationId);
    }
  };

  const handleRetryProvisioning = async () => {
    setRetrying(true);
    setMessage(null);
    try {
      await retryWasteTenantProvisioning();
      const refreshed = await getWasteManagementSettings();
      startTransition(() => {
        setSettings(refreshed);
        setForm(mapWasteSettingsToForm(refreshed));
        setMessage({ kind: 'success', text: pt('settings.messages.retryProvisioningSuccess') });
      });
    } catch (retryError) {
      const code = resolveApiErrorCode(retryError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('settings.messages.retryProvisioningForbidden')
            : pt('settings.messages.retryProvisioningError'),
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      <StatusNotice
        message={message}
        onRetry={(action) => {
          if (action === 'sync-waste-types') void syncFeedback.retrySync();
        }}
      />
      <WasteSettingsStatusPanel
        settings={settings}
        retrying={retrying}
        onRetry={() => void handleRetryProvisioning()}
      />
      <WasteSettingsForm
        form={form}
        settings={settings}
        saving={saveFeedback.status === 'saving'}
        saveStatus={saveFeedback.status}
        onChange={(value) => {
          saveFeedback.markDirty();
          setForm(value);
        }}
        onSubmit={() => void handleSubmit()}
      />
    </div>
  );
};
