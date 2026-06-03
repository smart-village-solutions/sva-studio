import type { IamDeletionContentStrategy, IamMyDeletionRulesOverview } from '@sva/core';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { t } from '../../i18n';

const mapContentStrategyKey = (strategy: IamDeletionContentStrategy) => {
  switch (strategy) {
    case 'with_owner_lifecycle':
      return 'account.rules.strategies.with_owner_lifecycle';
    case 'retain':
    default:
      return 'account.rules.strategies.retain';
  }
};

const summaryCards = [
  {
    label: 'account.rules.summary.deactivateAfterDays',
    description: 'account.rules.summary.deactivateAfterDaysHint',
    readValue: (deletionRules: IamMyDeletionRulesOverview) => String(deletionRules.rules.deactivateAfterDays),
  },
  {
    label: 'account.rules.summary.pseudonymizeAfterDays',
    description: 'account.rules.summary.pseudonymizeAfterDaysHint',
    readValue: (deletionRules: IamMyDeletionRulesOverview) => String(deletionRules.rules.pseudonymizeAfterDays),
  },
  {
    label: 'account.rules.summary.deleteAfterDays',
    description: 'account.rules.summary.deleteAfterDaysHint',
    readValue: (deletionRules: IamMyDeletionRulesOverview) => String(deletionRules.rules.deleteAfterDays),
  },
] as const;

export const AccountRulesSummaryCards = ({
  deletionRules,
  isLoading,
}: Readonly<{
  deletionRules: IamMyDeletionRulesOverview | null;
  isLoading: boolean;
}>) => (
  <div className="grid gap-4 md:grid-cols-3">
    {summaryCards.map((card) => (
      <Card key={card.label}>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">{t(card.label)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-3xl font-semibold text-foreground">
            {isLoading ? '...' : deletionRules ? card.readValue(deletionRules) : '—'}
          </p>
          <p className="text-sm text-muted-foreground">{t(card.description)}</p>
        </CardContent>
      </Card>
    ))}

    <Card className="md:col-span-3">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">{t('account.rules.summary.defaultContentStrategy')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground">
          {deletionRules
            ? t(mapContentStrategyKey(deletionRules.rules.defaultContentStrategy))
            : t('account.rules.messages.loading')}
        </p>
      </CardContent>
    </Card>
  </div>
);
