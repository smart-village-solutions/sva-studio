import type { IamUserDetail } from '@sva/core';

import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { t } from '../../i18n';
import { pickInitials } from '../../lib/display-name';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import {
  deriveProfileProjectionDetails,
  deriveProfileDisplayName,
  type AccountActionStatus,
  type ProfileFormValues,
} from './-account-profile-model';

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatEditorDateTime(value) ?? value;
};

type OverviewCardProps = Readonly<{
  displayName: string;
  email: string;
  profile: IamUserDetail | null;
  statusKey: (typeof statusTranslationKeyByValue)[keyof typeof statusTranslationKeyByValue];
}>;

const AccountProfileOverviewCard = ({
  displayName,
  email,
  profile,
  statusKey,
}: OverviewCardProps) => (
  <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-lg font-semibold text-foreground">
        {pickInitials(displayName)}
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{displayName}</h2>
        <p className="text-sm text-muted-foreground">{email}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{t(statusKey)}</Badge>
          {profile?.roles.length ? (
            profile.roles.map((role) => (
              <Badge key={role.roleId} variant="outline" className="h-auto items-start py-1">
                <span className="block">{role.roleName}</span>
              </Badge>
            ))
          ) : (
            <Badge variant="outline">{t('account.fields.role')}: -</Badge>
          )}
        </div>
      </div>
    </div>
    <div className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{t('account.fields.lastLogin')}: </span>
      {formatDateTime(profile?.lastLoginAt)}
    </div>
  </Card>
);

const AccountProfileProjectionWarning = ({ profile }: { profile: IamUserDetail | null }) => {
  const details = deriveProfileProjectionDetails(profile);
  if (!details.hasWarning) {
    return null;
  }

  return (
    <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900">
      <AlertTitle>{t('account.projection.warningTitle')}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{t('account.projection.warningBody')}</p>
        {details.mappingStatusTranslationKey ? (
          <p>
            {t('account.projection.statusLine', {
              value: t(details.mappingStatusTranslationKey),
            })}
          </p>
        ) : null}
        {details.editabilityTranslationKey ? (
          <p>
            {t('account.projection.editabilityLine', {
              value: t(details.editabilityTranslationKey),
            })}
          </p>
        ) : null}
        {details.diagnosticCodes ? (
          <p>{t('account.projection.diagnosticCodesLine', { value: details.diagnosticCodes })}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

const AccountActionNotice = ({ status }: { status: AccountActionStatus | null }) => {
  const message =
    status === 'password-updated'
      ? t('account.messages.passwordUpdated')
      : status === 'email-update-finished'
        ? t('account.messages.emailUpdateFinished')
        : status === 'email-update-unavailable'
          ? t('account.messages.emailUpdateUnavailable')
          : status === 'cancelled'
            ? t('account.messages.accountActionCancelled')
            : null;
  if (!message) {
    return null;
  }

  const className =
    status === 'cancelled'
      ? 'border-secondary/40 bg-secondary/10 text-secondary'
      : 'border-primary/40 bg-primary/10 text-primary';
  return (
    <Alert className={className} role="status">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};

type AccountProfileSummaryProps = Readonly<{
  accountActionStatus: AccountActionStatus | null;
  fallbackUserId?: string;
  formValues: ProfileFormValues;
  isProfileReadOnly: boolean;
  profile: IamUserDetail | null;
}>;

export const AccountProfileSummary = ({
  accountActionStatus,
  fallbackUserId,
  formValues,
  isProfileReadOnly,
  profile,
}: AccountProfileSummaryProps) => {
  const statusKey = profile?.status
    ? statusTranslationKeyByValue[profile.status]
    : statusTranslationKeyByValue.pending;
  const displayName =
    profile?.displayName ??
    deriveProfileDisplayName(formValues.firstName, formValues.lastName) ??
    fallbackUserId ??
    '-';

  return (
    <>
      <AccountProfileOverviewCard
        displayName={displayName}
        email={profile?.email ?? '-'}
        profile={profile}
        statusKey={statusKey}
      />
      <AccountProfileProjectionWarning profile={profile} />
      {isProfileReadOnly ? (
        <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
          <AlertTitle>{t('account.profile.platformReadOnlyTitle')}</AlertTitle>
          <AlertDescription>{t('account.profile.platformReadOnlyBody')}</AlertDescription>
        </Alert>
      ) : null}
      <AccountActionNotice status={accountActionStatus} />
    </>
  );
};
