import React from 'react';

import { acceptLegalText, asIamError, getMyPendingLegalTexts, LEGAL_ACCEPTANCE_REQUIRED_EVENT } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import {
  clearLegalAcceptanceReturnTo,
  readLegalAcceptanceReturnTo,
  storeLegalAcceptanceReturnTo,
} from '../lib/legal-acceptance-navigation';
import { t } from '../i18n';
import { sanitizeLegalTextHtml } from '../lib/legal-text-html';
import { useAuth } from '../providers/auth-provider';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ModalDialog } from './ModalDialog';

type LegalTextAcceptanceDialogProps = Readonly<{
  pathname: string;
}>;

const EXEMPT_PATH_PREFIXES = ['/admin/legal-texts'];
const legalAcceptanceLogger = createOperationLogger('legal-acceptance-dialog', 'debug');
const isAcceptedUiReturnTo = (value: string | undefined): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/api/') && !value.startsWith('/auth/');

const isPromptSuppressed = (pathname: string) => EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const formatDateTime = (value?: string) => {
  if (!value) {
    return t('admin.legalAcceptance.missingPublishedAt');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const LegalTextAcceptanceDialog = ({ pathname }: LegalTextAcceptanceDialogProps) => {
  const { isAuthenticated, isLoading: isAuthLoading, invalidatePermissions, logout, user } = useAuth();
  const [pendingTexts, setPendingTexts] = React.useState<Awaited<ReturnType<typeof getMyPendingLegalTexts>>['data']>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoadingPending, setIsLoadingPending] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const promptSuppressed = isPromptSuppressed(pathname);

  const loadPendingTexts = React.useCallback(
    async (silent = false) => {
      if (!isAuthenticated || !user?.instanceId || promptSuppressed) {
        setPendingTexts([]);
        setLoadError(null);
        setIsLoadingPending(false);
        return [] as Awaited<ReturnType<typeof getMyPendingLegalTexts>>['data'];
      }

      if (!silent) {
        setIsLoadingPending(true);
      }

      try {
        logBrowserOperationStart(legalAcceptanceLogger, 'pending_legal_texts_load_started', {
          operation: 'get_my_pending_legal_texts',
          pathname,
          silent,
        });
        const response = await getMyPendingLegalTexts();
        setPendingTexts(response.data);
        setLoadError(null);
        if (response.data.length > 0) {
          storeLegalAcceptanceReturnTo(pathname);
        }
        logBrowserOperationSuccess(
          legalAcceptanceLogger,
          'pending_legal_texts_load_succeeded',
          {
            operation: 'get_my_pending_legal_texts',
            pathname,
            silent,
            pending_count: response.data.length,
          },
          'debug'
        );
        return response.data;
      } catch (error) {
        const iamError = asIamError(error);
        if (iamError.code === 'unauthorized') {
          setPendingTexts([]);
          setLoadError(null);
        } else {
          setLoadError(t('admin.legalAcceptance.errorLoading'));
        }
        logBrowserOperationFailure(legalAcceptanceLogger, 'pending_legal_texts_load_failed', iamError, {
          operation: 'get_my_pending_legal_texts',
          pathname,
          silent,
        });
        return [] as Awaited<ReturnType<typeof getMyPendingLegalTexts>>['data'];
      } finally {
        setIsLoadingPending(false);
      }
    },
    [isAuthenticated, pathname, promptSuppressed, user?.instanceId]
  );

  React.useEffect(() => {
    void loadPendingTexts();
  }, [loadPendingTexts]);

  React.useEffect(() => {
    if (!isAuthenticated || promptSuppressed) {
      return undefined;
    }

    storeLegalAcceptanceReturnTo(pathname);

    const handleFocus = () => {
      void loadPendingTexts(true);
    };
    const handleLegalAcceptanceRequired = (event: Event) => {
      const detail =
        event instanceof CustomEvent && event.detail && typeof event.detail === 'object'
          ? (event.detail as { return_to?: string })
          : undefined;
      logBrowserOperationSuccess(
        legalAcceptanceLogger,
        'legal_acceptance_required_event_received',
        {
          operation: 'handle_legal_acceptance_required',
          pathname,
          return_to: detail?.return_to,
        },
        'debug'
      );
      storeLegalAcceptanceReturnTo(isAcceptedUiReturnTo(detail?.return_to) ? detail.return_to : pathname);
      void loadPendingTexts(true);
    };

    globalThis.addEventListener('focus', handleFocus);
    globalThis.addEventListener(LEGAL_ACCEPTANCE_REQUIRED_EVENT, handleLegalAcceptanceRequired);
    return () => {
      globalThis.removeEventListener('focus', handleFocus);
      globalThis.removeEventListener(LEGAL_ACCEPTANCE_REQUIRED_EVENT, handleLegalAcceptanceRequired);
    };
  }, [isAuthenticated, loadPendingTexts, pathname, promptSuppressed]);

  const handleAcceptAll = React.useCallback(async () => {
    if (!user?.instanceId) {
      setLoadError(t('admin.legalAcceptance.errorAccepting'));
      return;
    }

    setIsSubmitting(true);
    setLoadError(null);

    try {
      logBrowserOperationStart(legalAcceptanceLogger, 'legal_accept_all_started', {
        operation: 'accept_legal_texts',
        instance_id: user.instanceId,
        pending_count: pendingTexts.length,
      });
      for (const legalText of pendingTexts) {
        await acceptLegalText({
          instanceId: user.instanceId,
          legalTextId: legalText.legalTextId,
          legalTextVersion: legalText.legalTextVersion,
          locale: legalText.locale,
        });
      }

      await invalidatePermissions();
      const remaining = await loadPendingTexts(true);
      if (remaining.length === 0 && globalThis.window) {
        const returnTo = readLegalAcceptanceReturnTo();
        clearLegalAcceptanceReturnTo();
        logBrowserOperationSuccess(legalAcceptanceLogger, 'legal_acceptance_redirecting', {
          operation: 'accept_legal_texts',
          instance_id: user.instanceId,
          return_to: returnTo,
        });
        globalThis.window.location.assign(returnTo);
      }
      logBrowserOperationSuccess(legalAcceptanceLogger, 'legal_accept_all_succeeded', {
        operation: 'accept_legal_texts',
        instance_id: user.instanceId,
      });
    } catch (error) {
      setLoadError(t('admin.legalAcceptance.errorAccepting'));
      logBrowserOperationFailure(legalAcceptanceLogger, 'legal_accept_all_failed', error, {
        operation: 'accept_legal_texts',
        instance_id: user.instanceId,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [invalidatePermissions, loadPendingTexts, pendingTexts, user?.instanceId]);

  if (!isAuthenticated || isAuthLoading || promptSuppressed) {
    return null;
  }

  const isOpen = pendingTexts.length > 0 || loadError !== null;

  return (
    <ModalDialog
      open={isOpen}
      title={t('admin.legalAcceptance.title')}
      description={t('admin.legalAcceptance.description')}
      role="alertdialog"
      onClose={() => undefined}
    >
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          {t('admin.legalAcceptance.summary', { count: pendingTexts.length })}
        </p>

        {loadError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {pendingTexts.map((legalText) => (
            <Card key={legalText.id} className="space-y-3 p-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">{legalText.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {legalText.legalTextVersion} · {legalText.locale}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.legalAcceptance.publishedAt', { value: formatDateTime(legalText.publishedAt) })}
                </p>
              </div>
              <div
                className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeLegalTextHtml(legalText.contentHtml) }}
              />
            </Card>
          ))}
          {isLoadingPending && pendingTexts.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">{t('admin.legalAcceptance.loading')}</Card>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => void loadPendingTexts()} disabled={isSubmitting}>
            {t('admin.legalAcceptance.retry')}
          </Button>
          <Button type="button" variant="outline" onClick={() => void logout()} disabled={isSubmitting}>
            {t('admin.legalAcceptance.logout')}
          </Button>
          <Button type="button" onClick={() => void handleAcceptAll()} disabled={isSubmitting || pendingTexts.length === 0}>
            {isSubmitting ? t('admin.legalAcceptance.accepting') : t('admin.legalAcceptance.acceptAll')}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
};
