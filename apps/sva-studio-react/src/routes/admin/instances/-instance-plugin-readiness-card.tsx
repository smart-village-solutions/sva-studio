import type {
  PluginTenantLifecycleOperation,
  PluginTenantReadinessReadModel,
  PluginTenantReadinessStatus,
} from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

const statusVariants = {
  pending: 'outline',
  ready: 'secondary',
  degraded: 'outline',
  blocked: 'destructive',
} as const;

const statusLabels: Record<PluginTenantReadinessStatus, string> = {
  pending: 'admin.instances.pluginReadiness.status.pending',
  ready: 'admin.instances.pluginReadiness.status.ready',
  degraded: 'admin.instances.pluginReadiness.status.degraded',
  blocked: 'admin.instances.pluginReadiness.status.blocked',
};

const policyLabels = {
  optional: 'admin.instances.pluginReadiness.policy.optional',
  automatic: 'admin.instances.pluginReadiness.policy.automatic',
  required: 'admin.instances.pluginReadiness.policy.required',
} as const;

type PluginTenantLifecycleRepairOperation = Exclude<
  PluginTenantLifecycleOperation,
  'readiness'
>;

const operationLabels: Record<PluginTenantLifecycleRepairOperation, string> = {
  provision: 'admin.instances.pluginReadiness.operation.provision',
  reconcile: 'admin.instances.pluginReadiness.operation.reconcile',
  suspend: 'admin.instances.pluginReadiness.operation.suspend',
  reactivate: 'admin.instances.pluginReadiness.operation.reactivate',
};

const uniqueRepairOperations = (
  plugin: PluginTenantReadinessReadModel
): readonly PluginTenantLifecycleRepairOperation[] => {
  const hasUnfinishedGeneration = plugin.completedGeneration < plugin.desiredGeneration;
  const terminalFailure = plugin.error?.retryKind === 'terminal';
  const repairableChecks =
    !plugin.activeJobId &&
    (terminalFailure || (plugin.status !== 'ready' && hasUnfinishedGeneration))
      ? plugin.checks
      : plugin.checks.filter((check) => check.status !== 'ready');
  return [
    ...new Set(
      repairableChecks.flatMap((check) => (check.repairOperation ? [check.repairOperation] : []))
    ),
  ];
};

type PluginReadinessCardProps = {
  readonly plugins: readonly PluginTenantReadinessReadModel[];
  readonly isLoading: boolean;
  readonly activeAction: string | null;
  readonly error: IamHttpError | null;
  readonly onRepair: (
    pluginId: string,
    operation: PluginTenantLifecycleOperation
  ) => Promise<unknown>;
};

export const PluginReadinessCard = ({
  plugins,
  isLoading,
  activeAction,
  error,
  onRepair,
}: PluginReadinessCardProps) => (
  <Card className="space-y-4 p-4">
    <div className="space-y-1">
      <h2 className="font-medium text-foreground">{t('admin.instances.pluginReadiness.title')}</h2>
      <p className="text-sm text-muted-foreground">
        {t('admin.instances.pluginReadiness.subtitle')}
      </p>
    </div>

    {error ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>
          {t('admin.instances.pluginReadiness.error', { message: error.message })}
        </AlertDescription>
      </Alert>
    ) : null}

    {isLoading && plugins.length === 0 ? (
      <p className="text-sm text-muted-foreground" role="status">
        {t('admin.instances.pluginReadiness.loading')}
      </p>
    ) : null}

    {!isLoading && plugins.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t('admin.instances.pluginReadiness.empty')}</p>
    ) : null}

    <div className="space-y-3">
      {plugins.map((plugin) => {
        const repairOperations = uniqueRepairOperations(plugin);
        return (
          <section
            key={plugin.pluginId}
            aria-labelledby={`plugin-readiness-${plugin.pluginId}`}
            className="space-y-3 rounded-md border border-border p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 id={`plugin-readiness-${plugin.pluginId}`} className="font-medium">
                  {plugin.pluginId}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('admin.instances.pluginReadiness.policy.label', {
                    policy: t(policyLabels[plugin.activationPolicy]),
                  })}
                </p>
              </div>
              <Badge variant={statusVariants[plugin.status]}>
                {t(statusLabels[plugin.status])}
              </Badge>
            </div>

            <ul className="space-y-2">
              {plugin.checks.map((check) => (
                <li key={check.checkId} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="text-foreground">{t(check.titleKey)}</p>
                    {check.messageKey ? (
                      <p className="text-xs text-muted-foreground">{t(check.messageKey)}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t(statusLabels[check.status])}
                  </span>
                </li>
              ))}
            </ul>

            {plugin.activeJobId || repairOperations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {plugin.activeJobId ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      to="/monitoring/jobs/$jobId"
                      params={{ jobId: plugin.activeJobId }}
                      aria-label={t('admin.instances.pluginReadiness.activeJobAriaLabel', {
                        pluginId: plugin.pluginId,
                      })}
                    >
                      {t('admin.instances.pluginReadiness.activeJob')}
                    </Link>
                  </Button>
                ) : null}
                {repairOperations.map((operation) => {
                  const action = `${plugin.pluginId}:${operation}`;
                  return (
                    <Button
                      key={operation}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={activeAction !== null || Boolean(plugin.activeJobId)}
                      onClick={() => void onRepair(plugin.pluginId, operation)}
                      aria-label={t('admin.instances.pluginReadiness.repairAriaLabel', {
                        pluginId: plugin.pluginId,
                        operation: t(operationLabels[operation]),
                      })}
                    >
                      {activeAction === action
                        ? t('admin.instances.pluginReadiness.repairRunning')
                        : t('admin.instances.pluginReadiness.repair')}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  </Card>
);
