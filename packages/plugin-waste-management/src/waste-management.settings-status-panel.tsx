import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioTechnicalStatusPanel } from '@sva/studio-ui-react';

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
}: {
  readonly settings: WasteManagementSettingsRecord | null;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioTechnicalStatusPanel
      title={pt('settings.technical.title')}
      description={pt('settings.technical.description')}
      statusLabel={settings?.provisioningStatus ?? 'not_configured'}
      statusTone={provisioningTone(settings?.provisioningStatus)}
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
