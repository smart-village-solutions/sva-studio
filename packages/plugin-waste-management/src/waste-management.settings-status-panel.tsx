import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioTechnicalStatusPanel } from '@sva/studio-ui-react';

import { formatUpdatedAt, toTechnicalStatusTone } from './waste-management.page.support.js';

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
      statusLabel={settings?.visibleStatus ?? 'not_configured'}
      statusTone={toTechnicalStatusTone(settings?.visibleStatus)}
      metadata={[
        {
          id: 'databaseUrlConfigured',
          label: pt('settings.meta.databaseUrlConfiguredLabel'),
          value: settings?.databaseUrlConfigured ? pt('common.yes') : pt('common.no'),
        },
        {
          id: 'serviceRoleKeyConfigured',
          label: pt('settings.meta.serviceRoleKeyConfiguredLabel'),
          value: settings?.serviceRoleKeyConfigured ? pt('common.yes') : pt('common.no'),
        },
        {
          id: 'lastCheckedAt',
          label: pt('settings.meta.lastCheckedAtLabel'),
          value: formatUpdatedAt(settings?.lastCheckedAt),
        },
      ]}
    />
  );
};
