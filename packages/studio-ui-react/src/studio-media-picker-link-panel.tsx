import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import * as React from 'react';

import { Button } from './button.js';
import { ContentMediaUrlField } from './content-media-url-field.js';
import { isPersistableManualContentMediaUrl } from './content-media-url.js';

export const StudioMediaPickerLinkPanel = ({
  value,
  onChange,
  onCancel,
  onConfirm,
  disabled,
}: Readonly<{
  value: string;
  onChange: (url: string) => void;
  onCancel: () => void;
  onConfirm: (url: string) => void;
  disabled: boolean;
}>) => {
  const t = useContentMediaTranslation();
  const id = React.useId();
  React.useEffect(() => {
    globalThis.document?.getElementById(`content-media-${id}-url`)?.focus();
  }, [id]);
  const [valid, setValid] = React.useState(false);
  const [failedPreviewUrl, setFailedPreviewUrl] = React.useState<string | null>(null);
  const url = value.trim();
  const showPreview = isPersistableManualContentMediaUrl(url) && failedPreviewUrl !== url;

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      <div className="min-h-0 overflow-y-auto pr-1">
        <fieldset disabled={disabled} className="min-w-0 space-y-4 border-0 p-0">
          <p className="text-sm text-muted-foreground">{t('picker.linkHint')}</p>
          <ContentMediaUrlField
            usageId={id}
            value={value}
            onUpdate={(patch) => onChange(patch.persistentUrl ?? '')}
            onValidityChange={setValid}
            labels={{
              fields: { url: t('picker.url') },
              urlFeedback: {
                upgradedToHttps: t('picker.urlUpgradedToHttps'),
                insecureHttp: t('picker.urlInsecureHttp'),
                httpsUnavailable: t('picker.urlHttpsUnavailable'),
                invalid: t('picker.urlInvalid'),
              },
            }}
          />
          <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/20">
            {showPreview ? (
              <img
                src={url}
                alt={t('picker.preview')}
                className="h-full w-full object-contain"
                onError={() => setFailedPreviewUrl(url)}
              />
            ) : (
              <p role="status" className="px-4 text-center text-sm text-muted-foreground">
                {t('picker.previewUnavailable')}
              </p>
            )}
          </div>
        </fieldset>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="secondary" disabled={disabled} onClick={onCancel}>
          {t('picker.cancel')}
        </Button>
        <Button
          type="button"
          disabled={disabled || !valid || !isPersistableManualContentMediaUrl(url)}
          onClick={() => onConfirm(url)}
        >
          {t('picker.useMedia')}
        </Button>
      </div>
    </div>
  );
};
