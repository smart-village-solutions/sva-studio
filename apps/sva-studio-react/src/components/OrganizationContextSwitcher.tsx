import React from 'react';

import type { IamHttpError } from '../lib/iam-api';
import { t } from '../i18n';
import { useOrganizationContext } from '../hooks/use-organization-context';

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
    <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground">
      <label className="flex items-center gap-2">
        <span>{t('shell.header.organizationContext')}</span>
        <select
          aria-label={t('shell.header.organizationContext')}
          aria-describedby={describedBy}
          value={organizationContext.context?.activeOrganizationId ?? ''}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }
            void organizationContext.switchOrganization(event.target.value);
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          disabled={organizationContext.isUpdating}
        >
          {options.map((organization) => (
            <option key={organization.organizationId} value={organization.organizationId}>
              {organization.displayName}
            </option>
          ))}
        </select>
      </label>
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {organizationContext.isUpdating
          ? t('shell.header.organizationContextUpdating')
          : activeOrganization
            ? t('shell.header.organizationContextStatus', { name: activeOrganization.displayName })
            : ''}
      </span>
      {errorMessage ? (
        <p id={errorId} className="text-xs text-red-200" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
