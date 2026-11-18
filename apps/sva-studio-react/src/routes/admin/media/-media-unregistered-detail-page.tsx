import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button, StudioPageTitle } from '@sva/studio-ui-react';
import { Card, CardContent } from '../../../components/ui/card';
import {
  deriveMimeTypeFromUnregisteredMedia,
  useRegisterBucketMedia,
} from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamRegisteredMediaAsset, IamUnregisteredMediaAsset } from '../../../lib/iam-api';
import { useAccessDecision } from '../../../providers/effective-access-provider';

const importFailureMessage = (message?: string) =>
  message === 'storage_quota_exceeded' ? 'media.unregistered.quota' : 'media.unregistered.failed';

export const MediaUnregisteredDetailPage = ({
  asset,
}: Readonly<{ asset: IamUnregisteredMediaAsset | null }>) => {
  const createDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.read', 'media.create'] },
  });
  const readDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.read'] },
  });
  const canRead = readDecision.status === 'allowed';
  const canPrepare = canRead && createDecision.status === 'allowed';
  const navigate = useNavigate();
  const { registerMedia, mutationError } = useRegisterBucketMedia();
  const pendingRequest = React.useRef<{
    identity: string;
    promise: Promise<IamRegisteredMediaAsset | null>;
  } | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const storageKey = asset?.storageKey;
  const fileName = asset?.fileName;
  const byteSize = asset?.byteSize;
  const mimeType = asset ? deriveMimeTypeFromUnregisteredMedia(asset) : undefined;

  React.useEffect(() => {
    if (!storageKey || !fileName || byteSize === undefined || !mimeType || !canPrepare) {
      pendingRequest.current = null;
      return;
    }
    let cancelled = false;
    setFailed(false);
    void (async () => {
      // This component mounts only after deliberate route navigation; loaders and prefetches stay read-only.
      const identity = JSON.stringify([storageKey, fileName, byteSize, mimeType, attempt]);
      if (pendingRequest.current?.identity !== identity) {
        pendingRequest.current = {
          identity,
          promise: registerMedia({
            storageKey,
            fileName,
            byteSize,
            mimeType,
            visibility: 'public',
            metadata: { title: fileName.replace(/\.[^.]+$/, '') },
          }),
        };
      }
      const registered = await pendingRequest.current.promise;
      if (cancelled) return;
      if (!registered) {
        setFailed(true);
        return;
      }
      try {
        await navigate({
          to: '/admin/media/$mediaId',
          params: { mediaId: registered.id },
          replace: true,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, fileName, byteSize, mimeType, canPrepare, registerMedia, navigate, attempt]);

  if (!asset)
    return (
      <section data-testid="media-unregistered-detail-page">
        <Alert>
          <AlertDescription>{t('media.errors.notFound')}</AlertDescription>
        </Alert>
      </section>
    );
  const blocked =
    mutationError?.message === 'media_import_source_untrusted' || mutationError?.status === 403;
  const failureMessage = importFailureMessage(mutationError?.message);
  return (
    <section className="space-y-6" data-testid="media-unregistered-detail-page">
      <StudioPageTitle>{asset.fileName}</StudioPageTitle>
      <Card className="overflow-hidden border-border-subtle bg-card">
        <CardContent className="space-y-4 p-6">
          {canRead && !canPrepare && asset.previewUrl ? (
            <img
              src={asset.previewUrl}
              alt={asset.fileName}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="mx-auto h-auto max-h-[50dvh] max-w-full rounded-lg object-contain"
            />
          ) : null}
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-border-subtle bg-muted/20 p-8 text-center">
            <p
              role={failed ? 'alert' : 'status'}
              className="max-w-xl text-sm text-muted-foreground"
            >
              {t(
                !canPrepare
                  ? 'media.unregistered.readOnly'
                  : failed
                    ? blocked
                      ? 'media.unregistered.blocked'
                      : failureMessage
                    : 'media.unregistered.preparing'
              )}
            </p>
          </div>
          {failed && canPrepare && !blocked ? (
            <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
              {t('media.unregistered.retry')}
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">{t('media.unregistered.sourcePreserved')}</p>
          <details className="rounded-lg border border-border-subtle p-4">
            <summary className="cursor-pointer font-medium">
              {t('media.detail.moreInformation')}
            </summary>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('media.meta.storageKey')}</dt>
                <dd className="break-all">{asset.storageKey}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('media.meta.mimeType')}</dt>
                <dd>{mimeType}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('media.meta.byteSize')}</dt>
                <dd>{asset.byteSize}</dd>
              </div>
            </dl>
          </details>
        </CardContent>
      </Card>
    </section>
  );
};
