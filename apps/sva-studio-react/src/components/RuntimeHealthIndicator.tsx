import type { RuntimeDependencyKey, RuntimeDependencyStatus } from '@sva/core';

import { Badge } from './ui/badge';
import { useRuntimeHealth } from '../hooks/use-runtime-health';
import { t } from '../i18n';
import { cn } from '../lib/utils';

const serviceOrder: readonly RuntimeDependencyKey[] = ['database', 'redis', 'keycloak', 'authorizationCache'];

const statusBadgeClassNames: Readonly<Record<RuntimeDependencyStatus, string>> = {
  degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  not_ready: 'border-destructive/40 bg-destructive/10 text-destructive',
  ready: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  unknown: 'border-border bg-muted/60 text-muted-foreground',
};

const overallStatusLabels: Readonly<Record<RuntimeDependencyStatus, string>> = {
  degraded: t('shell.runtimeHealth.overall.degraded'),
  not_ready: t('shell.runtimeHealth.overall.not_ready'),
  ready: t('shell.runtimeHealth.overall.ready'),
  unknown: t('shell.runtimeHealth.overall.unknown'),
};

const serviceLabels: Readonly<Record<RuntimeDependencyKey, string>> = {
  authorizationCache: t('shell.runtimeHealth.services.authorizationCache'),
  database: t('shell.runtimeHealth.services.database'),
  keycloak: t('shell.runtimeHealth.services.keycloak'),
  redis: t('shell.runtimeHealth.services.redis'),
};

const serviceStatusLabels: Readonly<Record<RuntimeDependencyStatus, string>> = {
  degraded: t('shell.runtimeHealth.status.degraded'),
  not_ready: t('shell.runtimeHealth.status.not_ready'),
  ready: t('shell.runtimeHealth.status.ready'),
  unknown: t('shell.runtimeHealth.status.unknown'),
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) {
    return t('shell.runtimeHealth.notAvailable');
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
};

const toReasonLabel = (reasonCode: string | undefined): string | null => {
  if (!reasonCode) {
    return null;
  }

  switch (reasonCode) {
    case 'authorization_cache_degraded':
      return t('shell.runtimeHealth.reasons.authorizationCacheDegraded');
    case 'authorization_cache_failed':
      return t('shell.runtimeHealth.reasons.authorizationCacheFailed');
    case 'database_connection_failed':
      return t('shell.runtimeHealth.reasons.databaseConnectionFailed');
    case 'database_not_configured':
      return t('shell.runtimeHealth.reasons.databaseNotConfigured');
    case 'keycloak_admin_not_configured':
      return t('shell.runtimeHealth.reasons.keycloakAdminNotConfigured');
    case 'keycloak_dependency_failed':
      return t('shell.runtimeHealth.reasons.keycloakDependencyFailed');
    case 'redis_ping_failed':
      return t('shell.runtimeHealth.reasons.redisPingFailed');
    case 'schema_drift':
      return t('shell.runtimeHealth.reasons.schemaDrift');
    default:
      return t('shell.runtimeHealth.reasons.unknown');
  }
};

export function RuntimeHealthIndicator() {
  const { error, health, isLoading } = useRuntimeHealth();

  return (
    <section
      aria-label={t('shell.runtimeHealth.ariaLabel')}
      className="rounded-xl border border-border bg-card/70 p-4 shadow-shell"
      data-testid="runtime-health-indicator"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{t('shell.runtimeHealth.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('shell.runtimeHealth.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn(statusBadgeClassNames[health.status === 'not_ready' ? 'not_ready' : health.status])}>
            {overallStatusLabels[health.status]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('shell.runtimeHealth.lastUpdated', {
              timestamp: formatTimestamp(health.timestamp),
            })}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {serviceOrder.map((serviceKey) => {
          const service = health.checks.services[serviceKey];
          const reasonLabel = toReasonLabel(service.reasonCode);

          return (
            <article
              key={serviceKey}
              className="flex min-h-24 flex-col justify-between rounded-lg border border-border/70 bg-background/80 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-foreground">{serviceLabels[serviceKey]}</h3>
                  <p className="text-xs text-muted-foreground">
                    {reasonLabel ?? t('shell.runtimeHealth.reasons.ok')}
                  </p>
                </div>
                <Badge className={cn(statusBadgeClassNames[service.status])}>
                  {serviceStatusLabels[service.status]}
                </Badge>
              </div>
            </article>
          );
        })}
      </div>

      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">{t('shell.runtimeHealth.loading')}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-destructive">
          {t('shell.runtimeHealth.fetchError', {
            requestId: error.requestId ?? t('shell.runtimeHealth.notAvailable'),
          })}
        </p>
      ) : null}
    </section>
  );
}
