import type { IamDsrCaseListItem } from '@sva/core';

import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';

const formatPrivacyDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }

  return formatEditorDateTime(value) ?? value;
};

const mapDsrStatusKey = (item: Pick<IamDsrCaseListItem, 'canonicalStatus'>) => {
  switch (item.canonicalStatus) {
    case 'queued':
      return 'account.privacy.status.queued';
    case 'in_progress':
      return 'account.privacy.status.inProgress';
    case 'completed':
      return 'account.privacy.status.completed';
    case 'blocked':
      return 'account.privacy.status.blocked';
    default:
      return 'account.privacy.status.failed';
  }
};

const mapDsrStatusTone = (item: Pick<IamDsrCaseListItem, 'canonicalStatus'>) => {
  switch (item.canonicalStatus) {
    case 'completed':
      return 'border-primary/40 bg-primary/10 text-primary';
    case 'blocked':
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    default:
      return 'border-secondary/40 bg-secondary/10 text-secondary';
  }
};

export const DsrCaseRow = ({ item }: Readonly<{ item: IamDsrCaseListItem }>) => (
  <Card className="bg-background shadow-none">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
          <p className="text-xs text-muted-foreground">{item.summary}</p>
        </div>
        <div className="text-right">
          <Badge className={mapDsrStatusTone(item)} variant="outline">
            {t(mapDsrStatusKey(item))}
          </Badge>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('account.privacy.shared.rawStatus', { value: item.rawStatus })}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{t('account.privacy.shared.createdAt', { value: formatPrivacyDateTime(item.createdAt) })}</span>
        {item.completedAt ? (
          <span>{t('account.privacy.shared.completedAt', { value: formatPrivacyDateTime(item.completedAt) })}</span>
        ) : null}
        {item.format ? <span>{t('account.privacy.shared.format', { value: item.format })}</span> : null}
        {item.blockedReason ? <span>{t('account.privacy.shared.blockedBy', { value: item.blockedReason })}</span> : null}
      </div>
    </CardContent>
  </Card>
);

export { formatPrivacyDateTime };
