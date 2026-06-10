import type { InstanceAuditRun } from '@sva/core';

import { t } from '../../../i18n';
import { InstanceAuditRunSection } from './-instance-audit-run-section';

export const InstanceDetailAuditSection = ({
  auditRun,
  auditLoading,
  onRefresh,
}: {
  auditRun: InstanceAuditRun | null;
  auditLoading: boolean;
  onRefresh: () => Promise<unknown>;
}) => (
  <InstanceAuditRunSection
    title={t('admin.instances.audit.title')}
    subtitle={t('admin.instances.audit.subtitle')}
    emptyMessage={t('admin.instances.audit.empty')}
    refreshLabel={t('admin.instances.audit.refresh')}
    loadingLabel={t('admin.instances.audit.loading')}
    auditRun={auditRun}
    auditLoading={auditLoading}
    onRefresh={onRefresh}
  />
);
