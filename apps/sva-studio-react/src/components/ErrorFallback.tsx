import { Link, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';

import { t } from '../i18n';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

/**
 * Globaler Error-Fallback für nicht abgefangene Fehler in der Route-Hierarchie.
 *
 * Zeigt eine benutzerfreundliche Fehlermeldung und bietet Optionen zur Wiederherstellung.
 * Technische Details werden NICHT an den Benutzer weitergegeben.
 */
export default function ErrorFallback({ error, reset }: Readonly<ErrorComponentProps>) {
  const router = useRouter();
  const metaEnv = import.meta as ImportMeta & {
    env?: {
      DEV?: boolean;
      VITE_ENABLE_ERROR_DEBUG_DETAILS?: string;
    };
  };
  const browserWindow = typeof globalThis.window !== 'undefined' ? globalThis.window : undefined;
  const isLocalDebugHost =
    browserWindow?.location.hostname === 'localhost' || browserWindow?.location.hostname === '127.0.0.1';
  const debugDetailsEnabled = metaEnv.env?.VITE_ENABLE_ERROR_DEBUG_DETAILS === 'true';
  const shouldShowDebugDetails = isLocalDebugHost && debugDetailsEnabled;
  const debugErrorMessage = error instanceof Error ? error.message : String(error ?? '');

  const handleRetry = () => {
    reset();
    router.invalidate();
  };

  // Fehler nur in Development loggen; in Produktion wird der Fehler
  // über das zentrale Error-Tracking (OTel/SDK) erfasst.
  if (metaEnv.env?.DEV === true && error !== undefined) {
    console.error('[ErrorFallback]', error);
  }

  return (
    <div role="alert" className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <CardTitle className="text-5xl text-destructive">{t('shared.errorFallback.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertTitle>{t('shared.errorFallback.heading')}</AlertTitle>
            <AlertDescription>{t('shared.errorFallback.body')}</AlertDescription>
          </Alert>
          <div className="flex justify-center gap-4">
            <Button type="button" onClick={handleRetry}>
              {t('shared.errorFallback.retry')}
            </Button>
            <Button asChild variant="outline">
              <Link to="/">{t('shared.errorFallback.home')}</Link>
            </Button>
          </div>
          {shouldShowDebugDetails && debugErrorMessage ? (
            <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t('shared.errorFallback.diagnosticsLabel')}
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">{debugErrorMessage}</pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
