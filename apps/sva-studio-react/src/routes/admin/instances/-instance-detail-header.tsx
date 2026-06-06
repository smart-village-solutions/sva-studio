import { Link } from '@tanstack/react-router';

import { Button } from '../../../components/ui/button';
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
  <header className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.detail.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.detail.subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onOpenDoctor}>
          {t('admin.instances.detail.actions.openDoctor')}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/instances">{t('admin.instances.actions.back')}</Link>
        </Button>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('admin.instances.cockpit.identity')}
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-lg font-semibold text-foreground">{selectedInstance.displayName}</div>
          <div className="text-sm text-muted-foreground">{selectedInstance.instanceId}</div>
          <div className="text-sm text-muted-foreground">
            {t('admin.instances.detail.primaryHostname', { value: selectedInstance.primaryHostname })}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('admin.instances.cockpit.currentState')}
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-lg font-semibold text-foreground">{operationalTitle}</div>
          <p className="text-sm text-muted-foreground">{operationalSummary}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('admin.instances.cockpit.lifecycle')}
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-lg font-semibold text-foreground">{t(INSTANCE_STATUS_LABELS[selectedInstance.status])}</div>
          <div className="text-sm text-muted-foreground">
            {t('admin.instances.detail.parentDomain', { value: selectedInstance.parentDomain })}
          </div>
        </div>
      </div>
    </div>

    {doctorWarning ? (
      <div
        className={
          doctorWarning.tone === 'blocked'
            ? 'rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-900'
            : 'rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950'
        }
      >
        <div className="font-medium">{doctorWarning.title}</div>
        <p className="mt-1 text-sm">{doctorWarning.summary}</p>
      </div>
    ) : null}
  </header>
);
