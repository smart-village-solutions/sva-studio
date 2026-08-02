import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioTechnicalStatusPanel } from '@sva/studio-ui-react';

import { formatUpdatedAt } from './waste-management.page.support.js';

const provisioningTone = (
  status: WasteManagementSettingsRecord['provisioningStatus']
): 'neutral' | 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'ready':
      return 'success';
    case 'provisioning':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
};

export const WasteSettingsStatusPanel = ({
  settings,
  retrying = false,
  onRetry,
}: {
  readonly settings: WasteManagementSettingsRecord | null;
  readonly retrying?: boolean;
  readonly onRetry?: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioTechnicalStatusPanel
      title={pt('settings.technical.title')}
      description={pt('settings.technical.description')}
      statusLabel={settings?.provisioningStatus ?? 'not_configured'}
      statusTone={provisioningTone(settings?.provisioningStatus)}
      actions={
        settings?.provisioningStatus === 'failed' && onRetry ? (
          <Button type="button" variant="outline" disabled={retrying} onClick={onRetry}>
            {retrying
              ? pt('settings.actions.retryingProvisioning')
              : pt('settings.actions.retryProvisioning')}
          </Button>
        ) : undefined
      }
      metadata={[
        {
          id: 'provisioningUpdatedAt',
          label: pt('settings.meta.provisioningUpdatedAtLabel'),
          value: formatUpdatedAt(settings?.provisioningUpdatedAt),
        },
        {
          id: 'provisioningErrorCode',
          label: pt('settings.meta.provisioningErrorCodeLabel'),
          value: settings?.provisioningErrorCode ?? pt('settings.meta.provisioningErrorCodeEmpty'),
        },
      ]}
    />
  );
};
