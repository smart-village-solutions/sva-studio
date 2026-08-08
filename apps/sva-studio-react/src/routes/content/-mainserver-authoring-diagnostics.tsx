import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { t } from '../../i18n';
import {
  getMainserverAuthoringDiagnostics,
  type MainserverAuthoringDiagnostics,
} from '../../lib/iam-api';

type DiagnosticMetricProps = Readonly<{
  label: string;
  value: number;
}>;

const DiagnosticMetric = ({ label, value }: DiagnosticMetricProps) => (
  <div className="rounded-md border border-border bg-background p-3">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
  </div>
);

const readCount = (counts: Readonly<Record<string, number>>, key: string): number =>
  counts[key] ?? 0;

export type MainserverAuthoringDiagnosticsPanelProps = Readonly<{
  enabled: boolean;
}>;

export const MainserverAuthoringDiagnosticsPanel = ({
  enabled,
}: MainserverAuthoringDiagnosticsPanelProps) => {
  const [diagnostics, setDiagnostics] = React.useState<MainserverAuthoringDiagnostics | null>(null);
  const [error, setError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setDiagnostics(null);
      setError(false);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(false);

    void getMainserverAuthoringDiagnostics()
      .then((response) => {
        if (isActive) {
          setDiagnostics(response.data);
        }
      })
      .catch(() => {
        if (isActive) {
          setDiagnostics(null);
          setError(true);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [enabled, reloadToken]);

  if (!enabled) {
    return null;
  }

  return (
    <section aria-labelledby="mainserver-authoring-diagnostics-title">
      <Card>
        <CardHeader>
          <CardTitle id="mainserver-authoring-diagnostics-title">
            {t('content.diagnostics.title')}
          </CardTitle>
          <CardDescription>{t('content.diagnostics.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {t('content.diagnostics.loading')}
            </p>
          ) : null}

          {error ? (
            <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{t('content.diagnostics.loadError')}</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReloadToken((value) => value + 1)}
                >
                  {t('content.diagnostics.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {diagnostics ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.verifiedBindings')}
                  value={readCount(diagnostics.bindings.byStatus, 'verified')}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.conflicts')}
                  value={readCount(diagnostics.bindings.byStatus, 'conflict')}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.rotations')}
                  value={diagnostics.bindings.rotationPrincipalCount}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.compatibility')}
                  value={readCount(
                    diagnostics.mutations.byAuthorizationMode,
                    'credential_visible_compatibility'
                  )}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.exact')}
                  value={readCount(diagnostics.mutations.byAuthorizationMode, 'exact')}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.modeSwitches')}
                  value={diagnostics.mutations.automaticModeSwitchCount}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.shadowEvaluations')}
                  value={readCount(diagnostics.mutations.byResolverMode, 'shadow')}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.shadowDifferences')}
                  value={diagnostics.mutations.shadowDifferenceCount}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.reconciliationRequired')}
                  value={readCount(
                    diagnostics.mutations.byReconciliationStatus,
                    'reconciliation_required'
                  )}
                />
                <DiagnosticMetric
                  label={t('content.diagnostics.metrics.reconciliationFailed')}
                  value={readCount(diagnostics.mutations.byReconciliationStatus, 'failed')}
                />
              </dl>
              <p className="text-xs text-muted-foreground">
                {t('content.diagnostics.readOnlyNotice')}
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
};
