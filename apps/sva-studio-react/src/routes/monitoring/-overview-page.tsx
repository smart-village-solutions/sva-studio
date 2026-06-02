import type { AuthorizePerformanceRunResult } from '@sva/core';
import { StudioListPageTemplate } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { StudioTableSurface } from '../../components/StudioTableSurface';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { t } from '../../i18n';
import {
  asIamError,
  getLatestAuthorizePerformanceRun,
  IamHttpError,
  startAuthorizePerformanceRun,
} from '../../lib/iam-api';

type AuthorizePerformanceFormState = {
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly organizationId: string;
};

const INITIAL_FORM_STATE: AuthorizePerformanceFormState = {
  action: 'content.read',
  resourceType: 'content',
  resourceId: '',
  organizationId: '',
};

const formatDuration = (value: number): string => `${value.toFixed(2)} ms`;

const authorizeScenarioLabel = (
  scenario: AuthorizePerformanceRunResult['scenarios'][number]['scenario']
): string => {
  switch (scenario) {
    case 'cache-hit':
      return t('monitoring.authorize.scenarios.cache-hit');
    case 'cache-miss':
      return t('monitoring.authorize.scenarios.cache-miss');
    case 'recompute':
      return t('monitoring.authorize.scenarios.recompute');
  }
};

const describeAuthorizeError = (error: IamHttpError | null): string => {
  if (!error) {
    return t('monitoring.authorize.errors.runFailed');
  }

  switch (error.code) {
    case 'forbidden':
      return t('monitoring.authorize.errors.forbidden');
    case 'database_unavailable':
      return t('monitoring.authorize.errors.runFailed');
    case 'invalid_request':
      return t('monitoring.authorize.errors.invalidRequest');
    default:
      return t('monitoring.authorize.errors.runFailed');
  }
};

const AuthorizeResultTable = ({
  result,
}: Readonly<{
  result: AuthorizePerformanceRunResult;
}>) => (
  <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('monitoring.authorize.summary.actorTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{t('monitoring.authorize.summary.instanceId', { value: result.actor.instanceId })}</p>
          <p>{t('monitoring.authorize.summary.subject', { value: result.actor.keycloakSubject })}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('monitoring.authorize.summary.requestTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{t('monitoring.authorize.summary.action', { value: result.request.action })}</p>
          <p>{t('monitoring.authorize.summary.resourceType', { value: result.request.resourceType })}</p>
          <p>{t('monitoring.authorize.summary.resourceId', { value: result.request.resourceId ?? t('monitoring.authorize.values.notAvailable') })}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('monitoring.authorize.summary.configurationTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{t('monitoring.authorize.summary.samples', { value: result.configuration.measuredRequests })}</p>
          <p>{t('monitoring.authorize.summary.warmup', { value: result.configuration.warmupRequests })}</p>
          <p>{t('monitoring.authorize.summary.generatedAt', { value: result.generatedAt })}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('monitoring.authorize.summary.reportTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{t('monitoring.authorize.summary.measuredOnServer')}</p>
          <p>{t('monitoring.authorize.summary.reportJson', { value: result.report?.jsonPath ?? t('monitoring.authorize.values.notAvailable') })}</p>
          <p>{t('monitoring.authorize.summary.reportMarkdown', { value: result.report?.markdownPath ?? t('monitoring.authorize.values.notAvailable') })}</p>
        </CardContent>
      </Card>
    </div>

    <StudioTableSurface tone="background">
      <table className="min-w-full text-sm">
        <caption className="sr-only">{t('monitoring.authorize.table.caption')}</caption>
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">{t('monitoring.authorize.table.scenario')}</th>
            <th className="px-4 py-3 font-medium">{t('monitoring.authorize.table.samples')}</th>
            <th className="px-4 py-3 font-medium">{t('monitoring.authorize.table.p50')}</th>
            <th className="px-4 py-3 font-medium">{t('monitoring.authorize.table.p95')}</th>
            <th className="px-4 py-3 font-medium">{t('monitoring.authorize.table.p99')}</th>
            <th className="px-4 py-3 font-medium">{t('monitoring.authorize.table.evaluation')}</th>
            <th className="px-4 py-3 font-medium">{t('monitoring.authorize.table.cacheStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {result.scenarios.map((scenario) => (
            <tr key={scenario.scenario} className="border-t align-top">
              <td className="px-4 py-3 font-medium text-foreground">{authorizeScenarioLabel(scenario.scenario)}</td>
              <td className="px-4 py-3 text-muted-foreground">{scenario.summary.count}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDuration(scenario.summary.p50Ms)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDuration(scenario.summary.p95Ms)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDuration(scenario.summary.p99Ms)}</td>
              <td className="px-4 py-3 text-muted-foreground">{scenario.evaluationLabel}</td>
              <td className="px-4 py-3 text-muted-foreground">{scenario.observedCacheStatuses.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StudioTableSurface>
  </div>
);

const toSubmitPayload = (form: AuthorizePerformanceFormState) => ({
  action: form.action.trim(),
  resourceType: form.resourceType.trim(),
  ...(form.resourceId.trim().length > 0 ? { resourceId: form.resourceId.trim() } : {}),
  ...(form.organizationId.trim().length > 0 ? { organizationId: form.organizationId.trim() } : {}),
});

export const MonitoringOverviewPage = () => {
  const [form, setForm] = React.useState<AuthorizePerformanceFormState>(INITIAL_FORM_STATE);
  const [isLoadingLatest, setIsLoadingLatest] = React.useState(true);
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<AuthorizePerformanceRunResult | null>(null);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    let active = true;

    void getLatestAuthorizePerformanceRun()
      .then((latestResult) => {
        if (!active) {
          return;
        }
        setResult(latestResult);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        setError(asIamError(loadError));
      })
      .finally(() => {
        if (active) {
          setIsLoadingLatest(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange =
    (key: keyof AuthorizePerformanceFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((current) => ({
        ...current,
        [key]: value,
      }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsRunning(true);
    setError(null);

    try {
      const nextResult = await startAuthorizePerformanceRun(toSubmitPayload(form));
      setResult(nextResult);
    } catch (submitError) {
      setError(asIamError(submitError));
    } finally {
      setIsRunning(false);
      setIsLoadingLatest(false);
    }
  };

  return (
    <StudioListPageTemplate
      title={t('monitoring.page.title')}
      description={t('monitoring.page.subtitle')}
      primaryAction={{
        label: t('monitoring.page.jobsAction'),
        render: (
          <Button asChild variant="outline">
            <Link to="/monitoring/jobs">{t('monitoring.page.jobsAction')}</Link>
          </Button>
        ),
      }}
    >
      <div className="space-y-6">
        {error ? (
          <Alert className="border-destructive/40 text-destructive">
            <AlertDescription>{describeAuthorizeError(error)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t('monitoring.authorize.title')}</CardTitle>
              <CardDescription>{t('monitoring.authorize.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('monitoring.authorize.serverMeasuredNotice')}</p>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="authorize-performance-action">{t('monitoring.authorize.form.action')}</Label>
                  <Input id="authorize-performance-action" value={form.action} onChange={handleChange('action')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorize-performance-resource-type">{t('monitoring.authorize.form.resourceType')}</Label>
                  <Input
                    id="authorize-performance-resource-type"
                    value={form.resourceType}
                    onChange={handleChange('resourceType')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorize-performance-resource-id">{t('monitoring.authorize.form.resourceId')}</Label>
                  <Input
                    id="authorize-performance-resource-id"
                    value={form.resourceId}
                    onChange={handleChange('resourceId')}
                    placeholder={t('monitoring.authorize.form.resourceIdPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorize-performance-organization-id">{t('monitoring.authorize.form.organizationId')}</Label>
                  <Input
                    id="authorize-performance-organization-id"
                    value={form.organizationId}
                    onChange={handleChange('organizationId')}
                    placeholder={t('monitoring.authorize.form.organizationIdPlaceholder')}
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-between gap-3">
                  <p aria-live="polite" className="text-sm text-muted-foreground">
                    {isRunning
                      ? t('monitoring.authorize.status.running')
                      : isLoadingLatest
                        ? t('monitoring.authorize.status.loading')
                        : t('monitoring.authorize.status.idle')}
                  </p>
                  <Button type="submit" disabled={isRunning}>
                    {isRunning ? t('monitoring.authorize.actions.running') : t('monitoring.authorize.actions.start')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('monitoring.page.jobsCardTitle')}</CardTitle>
              <CardDescription>{t('monitoring.page.jobsCardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('monitoring.page.jobsCardBody')}</p>
              <Button asChild variant="outline">
                <Link to="/monitoring/jobs">{t('monitoring.page.jobsAction')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {result ? <AuthorizeResultTable result={result} /> : null}
      </div>
    </StudioListPageTemplate>
  );
};
