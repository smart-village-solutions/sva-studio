import { Button } from '@sva/studio-ui-react';

import { StudioFilterSurface } from '../../components/StudioFilterSurface';

import { StudioSummaryCard } from '../../components/StudioSummaryCard';

import { Alert, AlertDescription } from '../../components/ui/alert';

import { Card } from '../../components/ui/card';

import { Input } from '../../components/ui/input';

import { Label } from '../../components/ui/label';

import { Select } from '../../components/ui/select';

import { t } from '../../i18n';

import { PermissionTable, formatObjectEntries } from './-iam-page-display';
import { useRightsTabState } from './-iam-page-rights-state';
import { formatPermissionSourceKindLabels } from './-iam.models';

export const RightsTabPanel = ({
  panelId,
  labelledBy,
  state,
}: Readonly<{
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useRightsTabState>;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <StudioFilterSurface className="grid gap-3 lg:grid-cols-4">
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-organization-filter">
          {t('admin.iam.rights.filters.organization')}
        </Label>
        <Select
          id="iam-organization-filter"
          value={state.organizationId}
          onChange={(event) => state.setOrganizationId(event.target.value)}
        >
          <option value="">{t('admin.iam.shared.all')}</option>
          {state.organizationSelectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-acting-as-filter">{t('admin.iam.rights.filters.actingAs')}</Label>
        <Input
          id="iam-acting-as-filter"
          value={state.actingAsUserId}
          onChange={(event) => state.setActingAsUserId(event.target.value)}
        />
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-query-filter">{t('admin.iam.rights.filters.search')}</Label>
        <Input
          id="iam-query-filter"
          value={state.queryText}
          onChange={(event) => state.setQueryText(event.target.value)}
        />
      </div>
      <StudioSummaryCard
        eyebrow={t('admin.iam.rights.subject.title')}
        value={state.permissionSubject ? state.permissionSubject.effectiveUserId : '—'}
        valueClassName="text-lg"
      >
        <p className="text-xs text-muted-foreground">
          {state.permissionSubject?.isImpersonating
            ? t('admin.iam.rights.subject.impersonating', {
                actor: state.permissionSubject.actorUserId,
              })
            : t('admin.iam.rights.subject.self')}
        </p>
      </StudioSummaryCard>
    </StudioFilterSurface>

    {state.organizationOptions.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {state.organizationOptions.map((organizationValue) => (
          <Button
            key={organizationValue || 'no-organization'}
            type="button"
            className={`rounded-full text-xs ${
              state.selectedOrganizationIds.includes(organizationValue)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
            }`}
            onClick={() => state.handleOrganizationFilterToggle(organizationValue)}
            size="sm"
            variant="secondary"
          >
            {organizationValue || t('admin.iam.rights.noOrganization')}
          </Button>
        ))}
      </div>
    ) : null}

    {state.permissionsError ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>
          {t('admin.iam.rights.messages.error', { value: state.permissionsError })}
        </AlertDescription>
      </Alert>
    ) : null}

    <Card aria-busy={state.isLoadingPermissions} className="p-4">
      <PermissionTable permissions={state.filteredPermissions} />
    </Card>

    <RightsAuthorizeForm state={state} />
  </div>
);

const RightsAuthorizeForm = ({
  state,
}: Readonly<{ state: ReturnType<typeof useRightsTabState> }>) => (
  <StudioFilterSurface>
    <form onSubmit={state.handleAuthorizeSubmit} className="grid gap-3 lg:grid-cols-4">
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-authorize-action">{t('admin.iam.rights.authorize.action')}</Label>
        <Input
          id="iam-authorize-action"
          value={state.authorizeAction}
          onChange={(event) => state.setAuthorizeAction(event.target.value)}
        />
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-authorize-resource-type">
          {t('admin.iam.rights.authorize.resourceType')}
        </Label>
        <Input
          id="iam-authorize-resource-type"
          value={state.authorizeResourceType}
          onChange={(event) => state.setAuthorizeResourceType(event.target.value)}
        />
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-authorize-resource-id">
          {t('admin.iam.rights.authorize.resourceId')}
        </Label>
        <Input
          id="iam-authorize-resource-id"
          value={state.authorizeResourceId}
          onChange={(event) => state.setAuthorizeResourceId(event.target.value)}
        />
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-authorize-organization-id">
          {t('admin.iam.rights.authorize.organizationId')}
        </Label>
        <Select
          id="iam-authorize-organization-id"
          value={state.authorizeOrganizationId}
          onChange={(event) => state.setAuthorizeOrganizationId(event.target.value)}
        >
          <option value="">{t('admin.iam.shared.all')}</option>
          {state.organizationSelectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      <div className="lg:col-span-4 flex items-center gap-3">
        <Button type="submit" disabled={state.isAuthorizing}>
          {state.isAuthorizing
            ? t('admin.iam.rights.authorize.running')
            : t('admin.iam.rights.authorize.run')}
        </Button>
        {state.authorizeError ? (
          <p className="text-sm text-destructive">{state.authorizeError}</p>
        ) : null}
      </div>
      {state.authorizeDecision ? (
        <Card className="lg:col-span-4 bg-background p-3 shadow-none">
          <p className="font-semibold text-foreground">
            {state.authorizeDecision.allowed
              ? t('admin.iam.rights.authorize.allowed')
              : t('admin.iam.rights.authorize.denied')}
          </p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('admin.iam.rights.authorize.summary.action')}
              </dt>
              <dd className="text-foreground">{state.authorizeAction.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('admin.iam.rights.authorize.summary.resource')}
              </dt>
              <dd className="text-foreground">
                {[state.authorizeResourceType.trim(), state.authorizeResourceId.trim()]
                  .filter(Boolean)
                  .join(' / ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('admin.iam.rights.authorize.summary.organization')}
              </dt>
              <dd className="text-foreground">
                {state.authorizeOrganizationId.trim() || state.organizationId.trim() || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('admin.iam.rights.authorize.summary.cause')}
              </dt>
              <dd className="text-foreground">
                {state.authorizeDecision.reasonCode ?? state.authorizeDecision.reason}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('admin.iam.rights.authorize.summary.origin')}
              </dt>
              <dd className="text-foreground">
                {state.authorizeDecision.provenance?.sourceKinds &&
                state.authorizeDecision.provenance.sourceKinds.length > 0
                  ? formatPermissionSourceKindLabels(state.authorizeDecision.provenance.sourceKinds)
                  : state.authorizeDecision.matchedPermissions &&
                      state.authorizeDecision.matchedPermissions.length > 0
                    ? formatPermissionSourceKindLabels([
                        ...new Set(
                          state.authorizeDecision.matchedPermissions.map(
                            (permission) => permission.source
                          )
                        ),
                      ] as readonly string[])
                    : '—'}
              </dd>
            </div>
          </dl>
          {state.authorizeDecision.diagnostics ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {formatObjectEntries(state.authorizeDecision.diagnostics)}
            </p>
          ) : null}
        </Card>
      ) : null}
    </form>
  </StudioFilterSurface>
);
