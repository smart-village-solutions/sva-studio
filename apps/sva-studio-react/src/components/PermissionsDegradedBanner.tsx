import React from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { t } from '../i18n';
import { useAuth } from '../providers/auth-provider';

export const PermissionsDegradedBanner = () => {
  const { permissionsDegraded, invalidatePermissions, isLoading } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);

  // Wenn der Nutzer Berechtigungen neu lädt und sie jetzt ok sind, Banner ausblenden.
  React.useEffect(() => {
    if (!permissionsDegraded) {
      setDismissed(false);
    }
  }, [permissionsDegraded]);

  if (!permissionsDegraded || dismissed || isLoading) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await invalidatePermissions();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <span className="flex-1">{t('shell.permissionsDegraded.message')}</span>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={isRetrying}
          onClick={() => void handleRetry()}
          className="h-auto gap-1.5 px-2 py-1 text-amber-800 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
        >
          <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
          {t('shell.permissionsDegraded.retry')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('shell.permissionsDegraded.dismiss')}
          onClick={() => setDismissed(true)}
          className="h-auto p-1 text-amber-800 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
