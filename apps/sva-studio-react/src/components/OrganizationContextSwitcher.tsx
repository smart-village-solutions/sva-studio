import React from 'react';
import { resolveOrganizationContextState } from '@sva/core';

import type { IamHttpError } from '../lib/iam-api';
import { t } from '../i18n';
import { cn } from '../lib/utils';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { Alert, AlertDescription } from './ui/alert';
import { Label } from './ui/label';
import { Select } from './ui/select';

const organizationContextErrorMessage = (error: IamHttpError | null) => {
  if (!error) {
    return null;
  }

  switch (error.code) {
    case 'invalid_organization_id':
      return t('shell.header.organizationContextErrorInvalid');
    case 'organization_inactive':
      return t('shell.header.organizationContextErrorInactive');
    default:
      return t('shell.header.organizationContextError');
  }
};

type OrganizationContextSwitcherProps = Readonly<{
  variant?: 'inline' | 'menu';
  readOnly?: boolean;
}>;

export const OrganizationContextSwitcher = ({
  variant = 'inline',
  readOnly = false,
}: OrganizationContextSwitcherProps) => {
  const organizationContext = useOrganizationContext();
  const organizationContextState = resolveOrganizationContextState({
    organizations: organizationContext.context?.organizations,
    storedActiveOrganizationId: organizationContext.context?.activeOrganizationId,
  });
  const options = organizationContextState.activeOrganizations;
  const activeOrganization = options.find(
    (organization) => organization.organizationId === organizationContext.context?.activeOrganizationId
  );
  const errorMessage = organizationContextErrorMessage(organizationContext.error);
  const statusId = React.useId();
  const errorId = React.useId();
  const describedBy = [statusId, errorMessage ? errorId : null].filter(Boolean).join(' ') || undefined;
  const isMenuVariant = variant === 'menu';

  const shouldRenderSelector = !readOnly && organizationContextState.canSwitch;
  const shouldRenderMenuMemberships = isMenuVariant && organizationContextState.hasVisibleMemberships;

  if (organizationContext.isLoading || (!shouldRenderSelector && !shouldRenderMenuMemberships)) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex max-w-full flex-col items-start text-xs text-muted-foreground',
        isMenuVariant ? 'w-full gap-1.5 px-3 py-2' : 'gap-1'
      )}
    >
      <div className={cn('field-group', isMenuVariant ? 'flex w-full flex-col gap-2' : 'flex items-center gap-2')}>
        {shouldRenderSelector ? (
          <>
            <Label
              htmlFor="organization-context-switcher"
              className={cn(isMenuVariant ? 'text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground' : undefined)}
            >
              {t('shell.header.organizationContext')}
            </Label>
            <Select
              id="organization-context-switcher"
              aria-label={t('shell.header.organizationContext')}
              aria-describedby={describedBy}
              value={organizationContext.context?.activeOrganizationId ?? ''}
              onChange={(event) => {
                if (!event.target.value) {
                  return;
                }
                void organizationContext.switchOrganization(event.target.value);
              }}
              className={cn(
                'text-sm',
                isMenuVariant
                  ? 'h-10 w-full rounded-lg border-border bg-background px-3 py-2 shadow-none'
                  : 'h-8 w-auto min-w-40 max-w-full px-2 py-1'
              )}
              disabled={organizationContext.isUpdating}
            >
              {options.map((organization) => (
                <option key={organization.organizationId} value={organization.organizationId}>
                  {organization.displayName}
                </option>
              ))}
            </Select>
          </>
        ) : null}
      </div>
      {shouldRenderMenuMemberships ? (
        <div className="flex w-full flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t('shell.header.organizationMemberships')}
          </p>
          {readOnly ? (
            <p className="text-xs text-muted-foreground">
              {t('shell.header.organizationMembershipsSystemAdminHint')}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1 text-sm text-foreground">
            {options.map((organization) => (
              <li key={organization.organizationId}>{organization.displayName}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {organizationContext.isUpdating
          ? t('shell.header.organizationContextUpdating')
          : activeOrganization
            ? t('shell.header.organizationContextStatus', { name: activeOrganization.displayName })
            : ''}
      </span>
      {errorMessage ? (
        <Alert
          id={errorId}
          className={cn(
            'border-destructive/40 bg-destructive/10 text-xs text-destructive',
            isMenuVariant ? 'w-full px-3 py-2' : 'px-3 py-2'
          )}
        >
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};
