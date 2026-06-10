import type { InstanceAuditCheck, InstanceAuditRun } from '@sva/core';

import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { formatEditorDateTime } from '../../../lib/editor-date-time';

const formatDateTime = (value?: string) => formatEditorDateTime(value) ?? value ?? '—';

const scopeOrder: readonly InstanceAuditCheck['scope'][] = ['run', 'instance', 'registry', 'keycloak', 'localIam'];

const groupChecksByScope = (checks: readonly InstanceAuditCheck[]) =>
  scopeOrder
    .map((scope) => ({
      scope,
      checks: checks.filter((check) => check.scope === scope),
    }))
    .filter((group) => group.checks.length > 0);

const readStatusClassName = (status: InstanceAuditCheck['status']) => {
  switch (status) {
    case 'pass':
      return 'bg-emerald-500/10 text-emerald-700';
    case 'warn':
      return 'bg-amber-500/10 text-amber-700';
    case 'fail':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const formatAuditDetailValue = (value: unknown): string => {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const AuditCheckList = ({ checks }: { checks: readonly InstanceAuditCheck[] }) => (
  <div className="space-y-3">
    {groupChecksByScope(checks).map((group) => (
      <div key={group.scope} className="space-y-2">
        <h4 className="text-sm font-medium">{t(`admin.instances.audit.scopes.${group.scope}`)}</h4>
        <div className="space-y-2">
          {group.checks.map((check) => (
            <div key={check.checkId} className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{check.title}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${readStatusClassName(check.status)}`}>
                  {t(`admin.instances.audit.status.${check.status}`)}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                <div>
                  <dt className="font-medium">{t('admin.instances.audit.expected')}</dt>
                  <dd>{check.expected}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t('admin.instances.audit.actual')}</dt>
                  <dd>{check.actual}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t('admin.instances.audit.evidenceSource')}</dt>
                  <dd>{check.evidenceSource}</dd>
                </div>
              </dl>
              {check.details && Object.keys(check.details).length > 0 ? (
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p className="font-medium">{t('admin.instances.audit.details')}</p>
                  <dl className="grid gap-2 md:grid-cols-2">
                    {Object.entries(check.details).map(([key, value]) => (
                      <div key={key}>
                        <dt className="font-medium">{key}</dt>
                        <dd className="break-all">{formatAuditDetailValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
              {check.remediationHint ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">{t('admin.instances.audit.remediationHint')}</span> {check.remediationHint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const InstanceAuditRunSection = ({
  title,
  subtitle,
  emptyMessage,
  refreshLabel,
  loadingLabel,
  auditRun,
  auditLoading,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  emptyMessage: string;
  refreshLabel: string;
  loadingLabel: string;
  auditRun: InstanceAuditRun | null;
  auditLoading: boolean;
  onRefresh: () => Promise<unknown>;
}) => (
  <Card className="space-y-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void onRefresh()} disabled={auditLoading}>
        {auditLoading ? loadingLabel : refreshLabel}
      </Button>
    </div>

    {auditRun ? (
      <div className="space-y-4">
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t('admin.instances.audit.generatedAt')}</dt>
            <dd>{formatDateTime(auditRun.generatedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('admin.instances.audit.overallStatus')}</dt>
            <dd>{t(`admin.instances.audit.status.${auditRun.overallStatus}`)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('admin.instances.audit.targetCount')}</dt>
            <dd>{auditRun.summary.totalInstances}</dd>
          </div>
        </dl>

        <AuditCheckList checks={auditRun.checks} />

        {auditRun.instances.map((instance) => (
          <div key={instance.instanceId} className="space-y-3 rounded-xl border border-border/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">{instance.displayName}</h4>
                <p className="text-xs text-muted-foreground">
                  {t('admin.instances.audit.instanceHost', { host: instance.primaryHostname })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.instances.audit.instanceStatus', {
                    status: instance.status,
                    overallStatus: t(`admin.instances.audit.status.${instance.overallStatus}`),
                  })}
                </p>
              </div>
            </div>
            <AuditCheckList checks={instance.checks} />
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    )}
  </Card>
);
