import React from 'react';
import {
  IconCopy as Copy,
  IconDownload as Download,
  IconExternalLink as ExternalLink,
  IconQrcode as QrCode,
} from '@tabler/icons-react';
import * as QRCode from 'qrcode';
import type { MediaFocusPoint } from '@sva/media';
import { ModalDialog } from '../../../components/ModalDialog';
import { Badge } from '../../../components/ui/badge';
import {
  Button,
  StudioPageTitle,
  StudioMediaImageFocus,
  StudioMediaImageExamples,
} from '@sva/studio-ui-react';
import { Card, CardContent } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamMediaDelivery, IamRegisteredMediaAsset } from '../../../lib/iam-api';
import { copyTextToClipboard } from './-media-detail-workspace-header-clipboard';
type MediaDetailWorkspaceHeaderProps = Readonly<{
  asset: IamRegisteredMediaAsset;
  usageCount: number;
  delivery: IamMediaDelivery | null;
  focusPoint: MediaFocusPoint | null;
  onFocusChange: (point: MediaFocusPoint | null) => void;
  canEditFocus: boolean;
  copyAction: React.ReactNode;
}>;
const usageCountLabel = (count: number): string =>
  count === 1 ? t('media.library.usageCountOne') : t('media.library.usageCountOther', { count });
const isVisualPreview = (mimeType: string | undefined): boolean =>
  typeof mimeType === 'string' && mimeType.startsWith('image/');
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
  `${
    trimEdgeCharacters(
      (asset.metadata.title?.trim() || asset.id).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      '-'
    ) || asset.id
  }-qr`;
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
          <div className="mx-auto w-full max-w-[20rem] rounded-lg border border-border-subtle bg-white p-4 shadow-shell">
            <div
              aria-label={t('media.detail.qrPreviewLabel')}
              // fallow-ignore-next-line security-sink -- qrcode erzeugt das SVG lokal; die Delivery-URL wird nur als QR-Nutzlast kodiert.
              dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
              role="img"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('media.messages.loading')}</p>
        )}

        <div className="flex flex-wrap gap-3">
          {qrPngDownloadUrl ? (
            <Button asChild type="button" variant="secondary">
              <a download={`${downloadName}.png`} href={qrPngDownloadUrl}>
                <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                {t('media.actions.downloadQrPng')}
              </a>
            </Button>
          ) : null}
          {qrSvgDownloadUrl ? (
            <Button asChild type="button" variant="secondary">
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
  <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-inset p-4">
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
        <Button asChild size="icon" type="button" variant="secondary">
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
          variant="secondary"
          onClick={onCopy}
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t('media.actions.showQrCode')}
          size="icon"
          type="button"
          variant="secondary"
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
  focusPoint,
  onFocusChange,
  canEditFocus,
  copyAction,
}: MediaDetailWorkspaceHeaderProps) => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-3">
        <StudioPageTitle>{asset.metadata.title?.trim() || asset.id}</StudioPageTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{t(`media.visibility.${asset.visibility}`)}</Badge>
          <span>{usageCountLabel(usageCount)}</span>
        </div>
      </div>
      {copyAction}
    </div>
    <Card className="overflow-hidden border-border-subtle bg-card">
      <CardContent className="space-y-3 p-4 sm:p-6">
        {delivery?.deliveryUrl && isVisualPreview(asset.mimeType) ? (
          <>
            <StudioMediaImageFocus
              url={delivery.deliveryUrl}
              alt={previewAltText(asset)}
              focus={focusPoint ?? { x: 0.5, y: 0.5 }}
              onFocusChange={onFocusChange}
              disabled={!canEditFocus}
            />
            <StudioMediaImageExamples
              url={delivery.deliveryUrl}
              focus={focusPoint ?? { x: 0.5, y: 0.5 }}
            />
            {focusPoint === null ? (
              <p className="text-sm text-muted-foreground">{t('media.editor.focusNotSet')}</p>
            ) : null}
            {canEditFocus && focusPoint ? (
              <Button type="button" variant="tertiary" onClick={() => onFocusChange(null)}>
                {t('media.editor.clearFocus')}
              </Button>
            ) : null}
          </>
        ) : (
          <p className="py-16 text-center text-muted-foreground">{t('media.detail.previewBody')}</p>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {t('media.detail.fileSummary', {
            mimeType: asset.mimeType,
            width:
              typeof asset.technical.width === 'number'
                ? asset.technical.width
                : t('media.values.notAvailable'),
            height:
              typeof asset.technical.height === 'number'
                ? asset.technical.height
                : t('media.values.notAvailable'),
            bytes: asset.byteSize,
          })}
        </p>
      </CardContent>
    </Card>
  </div>
);

export const MediaDetailDeliveryTools = ({
  asset,
  delivery,
  canResolveDelivery,
  onResolveDelivery,
  canDelete,
  onDelete,
}: Readonly<{
  asset: IamRegisteredMediaAsset;
  delivery: IamMediaDelivery | null;
  canResolveDelivery: boolean;
  onResolveDelivery: () => void;
  canDelete: boolean;
  onDelete: () => void;
}>) => (
  <div className="space-y-4">
    {asset.visibility === 'public' && delivery?.deliveryUrl ? (
      <PublicDeliveryTools asset={asset} deliveryUrl={delivery.deliveryUrl} />
    ) : canResolveDelivery ? (
      <Button type="button" variant="secondary" onClick={onResolveDelivery}>
        {t('media.actions.resolveDelivery')}
      </Button>
    ) : null}
    {canDelete ? (
      <Button type="button" variant="destructive" onClick={onDelete}>
        {t('media.actions.delete')}
      </Button>
    ) : null}
  </div>
);
