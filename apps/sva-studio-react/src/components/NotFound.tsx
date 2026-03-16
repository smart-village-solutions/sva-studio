import { Link } from '@tanstack/react-router';

import { t } from '../i18n';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <CardTitle className="text-6xl">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-muted-foreground">{t('shared.notFound.heading')}</h2>
            <p className="mt-3 text-muted-foreground">{t('shared.notFound.body')}</p>
          </div>
          <Button asChild>
            <Link to="/">{t('shared.notFound.home')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
