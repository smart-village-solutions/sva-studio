import React from 'react';

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
}>;

export const OrganizationContextSwitcher = ({ variant = 'inline' }: OrganizationContextSwitcherProps) => {
  const organizationContext = useOrganizationContext();
  const options = organizationContext.context?.organizations.filter((organization) => organization.isActive) ?? [];
  const activeOrganization = options.find(
    (organization) => organization.organizationId === organizationContext.context?.activeOrganizationId
  );
  const errorMessage = organizationContextErrorMessage(organizationContext.error);
  const statusId = React.useId();
  const errorId = React.useId();
  const describedBy = [statusId, errorMessage ? errorId : null].filter(Boolean).join(' ') || undefined;

  if (organizationContext.isLoading || options.length <= 1) {
    return null;
  }

  const isMenuVariant = variant === 'menu';

  return (
    <div
      className={cn(
        'flex max-w-full flex-col items-start text-xs text-muted-foreground',
        isMenuVariant ? 'w-full gap-1.5 px-3 py-2' : 'gap-1'
      )}
    >
      <div className={cn('field-group', isMenuVariant ? 'flex w-full flex-col gap-2' : 'flex items-center gap-2')}>
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
      </div>
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
