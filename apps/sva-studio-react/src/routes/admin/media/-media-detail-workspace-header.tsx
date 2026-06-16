import React from 'react';
import { Copy, Download, ExternalLink, QrCode } from 'lucide-react';
import * as QRCode from 'qrcode';

import { ModalDialog } from '../../../components/ModalDialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamMediaDelivery, IamRegisteredMediaAsset } from '../../../lib/iam-api';

type MediaDetailWorkspaceHeaderProps = Readonly<{
  asset: IamRegisteredMediaAsset;
  usageCount: number;
  delivery: IamMediaDelivery | null;
  onResolveDelivery: () => void;
  onDelete: () => void;
}>;

const usageCountLabel = (count: number): string =>
  count === 1 ? t('media.library.usageCountOne') : t('media.library.usageCountOther', { count });

const isVisualPreview = (mimeType: string | undefined): boolean => typeof mimeType === 'string' && mimeType.startsWith('image/');

const previewAltText = (asset: IamRegisteredMediaAsset): string =>
  asset.metadata.altText?.trim() || asset.metadata.title?.trim() || asset.id;

const trimEdgeCharacters = (value: string, character: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === character) {
    start += 1;
  }

  while (end > start && value[end - 1] === character) {
    end -= 1;
  }

  return value.slice(start, end);
};

const createQrDownloadName = (asset: IamRegisteredMediaAsset) =>
  `${trimEdgeCharacters(
    (asset.metadata.title?.trim() || asset.id).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    '-'
  ) || asset.id}-qr`;

const copyTextToClipboard = async (value: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('clipboard_unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const useQrCodeAssets = (deliveryUrl: string, qrDialogOpen: boolean) => {
  const [qrSvgMarkup, setQrSvgMarkup] = React.useState<string | null>(null);
  const [qrSvgDownloadUrl, setQrSvgDownloadUrl] = React.useState<string | null>(null);
  const [qrPngDownloadUrl, setQrPngDownloadUrl] = React.useState<string | null>(null);
  const [qrGenerationError, setQrGenerationError] = React.useState(false);

  React.useEffect(() => {
    if (!qrDialogOpen) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [svgMarkup, pngDataUrl] = await Promise.all([
          QRCode.toString(deliveryUrl, {
            type: 'svg',
            margin: 1,
            width: 320,
            color: { dark: '#0f172a', light: '#ffffffff' },
          }),
          QRCode.toDataURL(deliveryUrl, {
            type: 'image/png',
            margin: 1,
            width: 640,
            color: { dark: '#0f172a', light: '#ffffffff' },
          }),
        ]);

        if (cancelled) {
          return;
        }

        setQrSvgMarkup(svgMarkup);
        setQrSvgDownloadUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`);
        setQrPngDownloadUrl(pngDataUrl);
        setQrGenerationError(false);
      } catch {
        if (cancelled) {
          return;
        }
        setQrGenerationError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deliveryUrl, qrDialogOpen]);

  return {
    qrSvgMarkup,
    qrSvgDownloadUrl,
    qrPngDownloadUrl,
    qrGenerationError,
  };
};

const PublicDeliveryQrDialog = ({
  asset,
  open,
  qrSvgMarkup,
  qrSvgDownloadUrl,
  qrPngDownloadUrl,
  qrGenerationError,
  onClose,
}: Readonly<{
  asset: IamRegisteredMediaAsset;
  open: boolean;
  qrSvgMarkup: string | null;
  qrSvgDownloadUrl: string | null;
  qrPngDownloadUrl: string | null;
  qrGenerationError: boolean;
  onClose: () => void;
}>) => {
  const downloadName = createQrDownloadName(asset);

  return (
    <ModalDialog
      contentClassName="max-w-xl"
      description={t('media.detail.qrDialogDescription')}
      open={open}
      title={t('media.detail.qrDialogTitle')}
      onClose={onClose}
    >
      <div className="space-y-5">
        {qrGenerationError ? (
          <p className="text-sm text-destructive">{t('media.detail.qrDialogError')}</p>
        ) : qrSvgMarkup ? (
          <div className="mx-auto w-full max-w-[20rem] rounded-3xl border border-border/70 bg-white p-4 shadow-shell">
            <div
              aria-label={t('media.detail.qrPreviewLabel')}
              dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
              role="img"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('media.messages.loading')}</p>
        )}

        <div className="flex flex-wrap gap-3">
          {qrPngDownloadUrl ? (
            <Button asChild type="button" variant="outline">
              <a download={`${downloadName}.png`} href={qrPngDownloadUrl}>
                <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                {t('media.actions.downloadQrPng')}
              </a>
            </Button>
          ) : null}
          {qrSvgDownloadUrl ? (
            <Button asChild type="button" variant="outline">
              <a download={`${downloadName}.svg`} href={qrSvgDownloadUrl}>
                <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                {t('media.actions.downloadQrSvg')}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </ModalDialog>
  );
};

const PublicDeliveryLinkTools = ({
  deliveryUrl,
  copyError,
  copied,
  onCopy,
  onOpenQrDialog,
}: Readonly<{
  deliveryUrl: string;
  copyError: boolean;
  copied: boolean;
  onCopy: () => void;
  onOpenQrDialog: () => void;
}>) => (
  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
      {t('media.detail.publicUrlLabel')}
    </p>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <a
        className="break-all text-sm font-medium text-foreground underline decoration-border underline-offset-4"
        href={deliveryUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {deliveryUrl}
      </a>
      <div className="flex items-center gap-2">
        <Button asChild size="icon" type="button" variant="outline">
          <a
            aria-label={t('media.actions.open')}
            href={deliveryUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        </Button>
        <Button
          aria-label={t('media.actions.copyPublicUrl')}
          size="icon"
          type="button"
          variant="outline"
          onClick={onCopy}
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('media.actions.showQrCode')}
          size="icon"
          type="button"
          variant="outline"
          onClick={onOpenQrDialog}
        >
          <QrCode aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      {copyError
        ? t('media.detail.publicUrlCopyError')
        : copied
          ? t('media.detail.publicUrlCopied')
          : t('media.detail.publicUrlHint')}
    </p>
  </div>
);

const PublicDeliveryTools = ({
  asset,
  deliveryUrl,
}: Readonly<{ asset: IamRegisteredMediaAsset; deliveryUrl: string }>) => {
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const [qrDialogOpen, setQrDialogOpen] = React.useState(false);
  const { qrSvgMarkup, qrSvgDownloadUrl, qrPngDownloadUrl, qrGenerationError } = useQrCodeAssets(
    deliveryUrl,
    qrDialogOpen
  );

  React.useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopied(false);
      setCopyError(false);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = () => {
    void copyTextToClipboard(deliveryUrl)
      .then(() => {
        setCopyError(false);
        setCopied(true);
      })
      .catch(() => {
        setCopied(false);
        setCopyError(true);
      });
  };

  return (
    <>
      <PublicDeliveryLinkTools
        copied={copied}
        copyError={copyError}
        deliveryUrl={deliveryUrl}
        onCopy={handleCopy}
        onOpenQrDialog={() => setQrDialogOpen(true)}
      />
      <PublicDeliveryQrDialog
        asset={asset}
        open={qrDialogOpen}
        qrGenerationError={qrGenerationError}
        qrPngDownloadUrl={qrPngDownloadUrl}
        qrSvgDownloadUrl={qrSvgDownloadUrl}
        qrSvgMarkup={qrSvgMarkup}
        onClose={() => setQrDialogOpen(false)}
      />
    </>
  );
};

export const MediaDetailWorkspaceHeader = ({
  asset,
  usageCount,
  delivery,
  onResolveDelivery,
  onDelete,
}: MediaDetailWorkspaceHeaderProps) => {
  const showPublicDeliveryTools = asset.visibility === 'public' && Boolean(delivery?.deliveryUrl);

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-shell">
      <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,1fr)]">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-muted">
          {delivery?.deliveryUrl && isVisualPreview(asset.mimeType) ? (
            <img
              alt={previewAltText(asset)}
              className="h-full min-h-80 w-full object-cover"
              src={delivery.deliveryUrl}
            />
          ) : (
            <div className="flex min-h-80 items-center bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.2),_transparent_50%),linear-gradient(145deg,rgba(255,255,255,0.96),rgba(226,232,240,0.78))] p-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {t('media.detail.previewEyebrow')}
                </p>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-foreground">{t('media.detail.previewTitle')}</p>
                  <p className="max-w-md text-sm text-muted-foreground">{t('media.detail.previewBody')}</p>
                </div>
                <div className="inline-flex rounded-full border border-foreground/10 bg-white/75 px-3 py-1 text-xs font-medium text-foreground">
                  {asset.mimeType}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-foreground">{asset.metadata.title?.trim() || asset.id}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('media.detail.subtitle')}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{t(`media.visibility.${asset.visibility}`)}</Badge>
              <Badge variant="outline">{t(`media.uploadStatus.${asset.uploadStatus}`)}</Badge>
              <Badge variant="outline">{t(`media.processingStatus.${asset.processingStatus}`)}</Badge>
              <Badge className="border-0 bg-cyan-500/15 text-cyan-700" variant="secondary">
                {usageCountLabel(usageCount)}
              </Badge>
              {delivery ? (
                <Badge className="border-0 bg-emerald-500/15 text-emerald-700" variant="secondary">
                  {t('media.delivery.title')}
                </Badge>
              ) : null}
            </div>
          </div>

          {showPublicDeliveryTools && delivery?.deliveryUrl ? (
            <PublicDeliveryTools asset={asset} deliveryUrl={delivery.deliveryUrl} />
          ) : null}

          <div className="flex flex-wrap gap-3">
            {!showPublicDeliveryTools ? (
              <Button type="button" onClick={onResolveDelivery}>
                {t('media.actions.resolveDelivery')}
              </Button>
            ) : null}
            <Button type="button" variant="destructive" onClick={onDelete}>
              {t('media.actions.delete')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
