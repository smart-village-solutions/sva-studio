import { Link } from '@tanstack/react-router';

import { Button, StudioPageTitle } from '@sva/studio-ui-react';
import { t } from '../../../i18n';
import { INSTANCE_STATUS_LABELS } from './-instance-detail-view-shared';

import type { SelectedInstance } from './-instances-shared-types';

type InstanceDetailHeaderProps = {
  readonly selectedInstance: SelectedInstance;
  readonly operationalTitle: string;
  readonly operationalSummary: string;
  readonly onOpenDoctor: () => void;
  readonly doctorWarning?: {
    readonly tone: 'blocked' | 'degraded';
    readonly title: string;
    readonly summary: string;
  } | null;
};

export const InstanceDetailHeader = ({
  selectedInstance,
  operationalTitle,
  operationalSummary,
  onOpenDoctor,
  doctorWarning,
}: InstanceDetailHeaderProps) => (
  <header className="space-y-3 border-b border-border pb-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <StudioPageTitle withAccessory>{selectedInstance.displayName}</StudioPageTitle>
        <p className="break-all text-sm text-muted-foreground">
          {selectedInstance.primaryHostname} · {selectedInstance.instanceId}
        </p>
        <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <div>
            <dt className="inline text-muted-foreground">
              {t('admin.instances.cockpit.lifecycle')}:{' '}
            </dt>
            <dd className="inline">{t(INSTANCE_STATUS_LABELS[selectedInstance.status])}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">
              {t('admin.instances.detail.operationalState')}:{' '}
            </dt>
            <dd className="inline" title={operationalSummary}>
              {operationalTitle}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onOpenDoctor}>
          {t('admin.instances.detail.actions.openDoctor')}
        </Button>
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/instances">{t('admin.instances.actions.back')}</Link>
        </Button>
      </div>
    </div>
    {doctorWarning ? (
      <p role="status" className="text-sm text-muted-foreground">
        <span>{doctorWarning.title}</span> {doctorWarning.summary}
      </p>
    ) : null}
  </header>
);
