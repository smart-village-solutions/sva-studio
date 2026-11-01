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
  allowPersonal?: boolean;
}>;

export const OrganizationContextSwitcher = ({
  variant = 'inline',
  allowPersonal = false,
}: OrganizationContextSwitcherProps) => {
  const organizationContext = useOrganizationContext();
  const organizationContextState = resolveOrganizationContextState({
    ...(allowPersonal ? { roleNames: ['system_admin'] } : {}),
    organizations: organizationContext.context?.organizations,
    storedActiveOrganizationId: organizationContext.context?.activeOrganizationId,
  });
  const options = organizationContextState.activeOrganizations;
  const activeOrganization = options.find(
    (organization) => organization.organizationId === organizationContextState.activeOrganizationId
  );
  const errorMessage = organizationContextErrorMessage(organizationContext.error);
  const statusId = React.useId();
  const errorId = React.useId();
  const controlId = React.useId();
  const describedBy =
    [statusId, errorMessage ? errorId : null].filter(Boolean).join(' ') || undefined;
  const isMenuVariant = variant === 'menu';

  const shouldRenderSelector = organizationContextState.canSwitch;
  const shouldRenderMenuMemberships =
    isMenuVariant && organizationContextState.hasVisibleMemberships;

  if (organizationContext.isLoading || !organizationContextState.hasVisibleMemberships) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex max-w-full flex-col items-start text-xs text-muted-foreground',
        isMenuVariant ? 'w-full gap-1.5 px-3 py-2' : 'gap-1'
      )}
    >
      <div
        className={cn(
          'field-group',
          isMenuVariant
            ? 'flex w-full flex-col gap-2'
            : 'flex min-h-11 w-full min-w-0 items-center gap-2'
        )}
      >
        {shouldRenderSelector ? (
          <>
            <Label
              htmlFor={controlId}
              className={cn(
                isMenuVariant
                  ? 'text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'
                  : 'sr-only'
              )}
            >
              {t('shell.header.organizationContext')}
            </Label>
            <Select
              id={controlId}
              aria-label={t('shell.header.organizationContext')}
              aria-describedby={describedBy}
              value={organizationContextState.activeOrganizationId ?? ''}
              onChange={(event) => {
                if (!event.target.value && !allowPersonal) return;
                void organizationContext.switchOrganization(event.target.value || null);
              }}
              className={cn(
                'text-sm',
                isMenuVariant
                  ? 'h-10 w-full rounded-lg border-border bg-background px-3 py-2 shadow-none'
                  : 'h-11 w-full min-w-0 max-w-full border-transparent bg-transparent pl-0 pr-8 font-medium lg:w-auto'
              )}
              disabled={organizationContext.isUpdating}
            >
              {allowPersonal ? (
                <option value="">{t('shell.header.organizationContextPersonal')}</option>
              ) : null}
              {options.map((organization) => (
                <option key={organization.organizationId} value={organization.organizationId}>
                  {organization.displayName}
                </option>
              ))}
            </Select>
          </>
        ) : !isMenuVariant && activeOrganization ? (
          <span className="min-w-0 break-words text-sm font-medium text-foreground">
            {activeOrganization.displayName}
          </span>
        ) : null}
      </div>
      {shouldRenderMenuMemberships ? (
        <div className="flex w-full flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t('shell.header.organizationMemberships')}
          </p>
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
