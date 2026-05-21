import type { IamDsrCaseListItem } from '@sva/core';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { t } from '../../i18n';
import { DsrCaseRow, formatPrivacyDateTime } from './-account-privacy-shared';

export const PrivacyActionPanel = ({
  disabled,
  onExport,
  onRequestPermissionChange,
  onRequestAccess,
  onSubmitObjection,
}: Readonly<{
  disabled: boolean;
  onExport: () => void;
  onRequestPermissionChange?: () => void;
  onRequestAccess: () => void;
  onSubmitObjection: () => void;
}>) => (
  <Card>
    <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
      <Button type="button" disabled={disabled} onClick={onExport}>
        {t('account.privacy.actions.requestExport')}
      </Button>
      <Button type="button" disabled={disabled} variant="outline" onClick={onRequestAccess}>
        {t('account.privacy.actions.requestAccess')}
      </Button>
      {onRequestPermissionChange ? (
        <Button type="button" disabled={disabled} variant="outline" onClick={onRequestPermissionChange}>
          {t('account.privacy.actions.requestPermissionChange')}
        </Button>
      ) : null}
      <Button type="button" disabled={disabled} variant="outline" onClick={onSubmitObjection}>
        {t('account.privacy.actions.optOut')}
      </Button>
    </CardContent>
  </Card>
);

export const PrivacyEmptyStateCard = ({
  disabled,
  onRequestAccess,
}: Readonly<{
  disabled: boolean;
  onRequestAccess: () => void;
}>) => (
  <Card className="border-dashed">
    <CardHeader>
      <CardTitle>{t('account.privacy.empty.title')}</CardTitle>
      <CardDescription>{t('account.privacy.empty.body')}</CardDescription>
    </CardHeader>
    <CardContent>
      <Button type="button" disabled={disabled} onClick={onRequestAccess}>
        {t('account.privacy.empty.cta')}
      </Button>
    </CardContent>
  </Card>
);

export const PrivacyCasesSection = ({
  title,
  items,
  prefix,
}: Readonly<{
  title: string;
  items: readonly IamDsrCaseListItem[];
  prefix: 'export' | 'request' | 'hold';
}>) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <DsrCaseRow key={`${prefix}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
};

export const PrivacyProcessingCard = ({
  disabled,
  legalHolds,
  nonEssentialProcessingAllowed,
  processingRestrictedAt,
  processingRestrictionReason,
  nonEssentialProcessingOptOutAt,
  onCheckProcessing,
}: Readonly<{
  disabled: boolean;
  legalHolds: readonly IamDsrCaseListItem[];
  nonEssentialProcessingAllowed?: boolean;
  processingRestrictedAt?: string;
  processingRestrictionReason?: string;
  nonEssentialProcessingOptOutAt?: string;
  onCheckProcessing: () => void;
}>) => (
  <Card>
    <CardHeader className="p-4 pb-0">
      <CardTitle>{t('account.privacy.sections.processing')}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 p-4 pt-0">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('account.privacy.processing.optional')}
          </dt>
          <dd className="text-foreground">
            {nonEssentialProcessingAllowed
              ? t('account.privacy.processing.allowed')
              : t('account.privacy.processing.restricted')}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('account.privacy.processing.restrictionSince')}
          </dt>
          <dd className="text-foreground">{formatPrivacyDateTime(processingRestrictedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('account.privacy.processing.reason')}
          </dt>
          <dd className="text-foreground">{processingRestrictionReason ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('account.privacy.processing.optOutSince')}
          </dt>
          <dd className="text-foreground">{formatPrivacyDateTime(nonEssentialProcessingOptOutAt)}</dd>
        </div>
      </dl>
      <Button type="button" className="w-full" disabled={disabled} variant="outline" onClick={onCheckProcessing}>
        {t('account.privacy.actions.checkProcessing')}
      </Button>

      {legalHolds.length ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">{t('account.privacy.sections.legalHolds')}</h3>
          {legalHolds.map((item) => (
            <DsrCaseRow key={`hold-${item.id}`} item={item} />
          ))}
        </section>
      ) : null}
    </CardContent>
  </Card>
);
