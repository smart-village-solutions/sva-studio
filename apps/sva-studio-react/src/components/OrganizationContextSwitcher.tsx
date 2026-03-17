import React from 'react';

import type { IamHttpError } from '../lib/iam-api';
import { t } from '../i18n';
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

export const OrganizationContextSwitcher = () => {
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

  return (
    <div className="flex max-w-full flex-col items-start gap-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Label htmlFor="organization-context-switcher">{t('shell.header.organizationContext')}</Label>
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
          className="h-8 w-auto min-w-40 max-w-full px-2 py-1 text-sm"
          disabled={organizationContext.isUpdating}
        >
          {options.map((organization) => (
            <option key={organization.organizationId} value={organization.organizationId}>
              {organization.displayName}
            </option>
          ))}
        </Select>
      </div>
      {activeOrganization ? (
        <p className="max-w-sm text-[11px] leading-4 text-muted-foreground">
          {[
            activeOrganization.organizationKey,
            activeOrganization.organizationType,
            activeOrganization.isDefaultContext ? t('shell.header.organizationContextDefault') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {organizationContext.isUpdating
          ? t('shell.header.organizationContextUpdating')
          : activeOrganization
            ? t('shell.header.organizationContextStatus', { name: activeOrganization.displayName })
            : ''}
      </span>
      {errorMessage ? (
        <Alert id={errorId} className="border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};
