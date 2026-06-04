import { Link } from '@tanstack/react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { t } from '../../../i18n';

export const MediaIntakeShelf = () => (
  <Card className="border-border/70 bg-card/95 shadow-shell">
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <CardTitle>{t('media.library.quickIntake.title')}</CardTitle>
        <CardDescription>{t('media.library.quickIntake.description')}</CardDescription>
      </div>
      <Button asChild>
        <Link to="/admin/media/new">{t('media.actions.create')}</Link>
      </Button>
    </CardHeader>
    <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
      <div>{t('media.library.quickIntake.steps.prepare')}</div>
      <div>{t('media.library.quickIntake.steps.describe')}</div>
      <div>{t('media.library.quickIntake.steps.publish')}</div>
    </CardContent>
  </Card>
);
