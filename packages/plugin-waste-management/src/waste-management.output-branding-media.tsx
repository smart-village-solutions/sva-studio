import { contentMediaUploadPhaseMessageKey } from '@sva/plugin-sdk';
import {
  Input,
  isPersistableContentMediaUrl,
  StudioField,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerOverlayLabels,
} from '@sva/studio-ui-react';
import { useMemo } from 'react';

import { useWasteBrandingMediaController } from './waste-management.output-branding-media.logic.js';
import {
  BrandingMediaPickerControls,
  BrandingPreview,
} from './waste-management.output-branding-media.views.js';

export type WasteOutputTranslate = (
  key: string,
  variables?: Record<string, string | number>
) => string;

const createMediaPickerLabels = (
  translate: WasteOutputTranslate
): StudioMediaPickerOverlayLabels => ({
  title: translate('output.pdf.mediaPicker.title'),
  description: translate('output.pdf.mediaPicker.description'),
  modes: {
    library: translate('output.pdf.mediaPicker.libraryAction'),
    upload: translate('output.pdf.mediaPicker.uploadAction'),
    manual: translate('output.pdf.mediaPicker.manualAction'),
    review: translate('output.pdf.mediaPicker.reviewMode'),
  },
  library: {
    searchLabel: translate('output.pdf.mediaPicker.searchLabel'),
    empty: translate('output.pdf.mediaPicker.empty'),
    select: translate('output.pdf.mediaPicker.select'),
  },
  upload: {
    regionLabel: translate('output.pdf.mediaPicker.uploadRegionLabel'),
    title: translate('output.pdf.mediaPicker.uploadTitle'),
    description: translate('output.pdf.mediaPicker.uploadDescription'),
    browseAction: translate('output.pdf.mediaPicker.selectFile'),
    supportLabel: translate('output.pdf.mediaPicker.uploadSupportLabel'),
  },
  review: {
    title: translate('output.pdf.mediaPicker.reviewTitle'),
    description: translate('output.pdf.mediaPicker.reviewDescription'),
  },
  fields: {
    title: translate('output.pdf.mediaPicker.fields.title'),
    altText: translate('output.pdf.mediaPicker.fields.altText'),
    description: translate('output.pdf.mediaPicker.fields.description'),
    copyright: translate('output.pdf.mediaPicker.fields.copyright'),
    license: translate('output.pdf.mediaPicker.fields.license'),
  },
  actions: {
    cancel: translate('output.pdf.mediaPicker.cancel'),
    backToLibrary: translate('output.pdf.mediaPicker.backToLibrary'),
    backToUpload: translate('output.pdf.mediaPicker.backToUpload'),
    openMediaManagement: translate('output.pdf.mediaPicker.openMediaManagement'),
    useMedia: translate('output.pdf.mediaPicker.useMedia'),
  },
});

const resolvePickerFeedback = (
  translate: WasteOutputTranslate,
  errorCode: StudioMediaPickerErrorCode | null,
  uploadPhase: Parameters<typeof contentMediaUploadPhaseMessageKey>[0]
) => {
  const errorKeyByCode: Partial<Record<StudioMediaPickerErrorCode, string>> = {
    unsupported_upload_type: 'output.pdf.mediaPicker.unsupportedType',
    upload_failed: 'output.pdf.mediaPicker.uploadFailed',
    asset_load_failed: 'output.pdf.mediaPicker.assetLoadFailed',
    asset_unavailable: 'output.pdf.mediaPicker.assetUnavailable',
    metadata_save_failed: 'output.pdf.mediaPicker.metadataSaveFailed',
  };
  const errorKey = errorCode ? errorKeyByCode[errorCode] : undefined;
  if (errorKey) {
    return { message: translate(errorKey), tone: 'error' as const };
  }

  const phaseKey = contentMediaUploadPhaseMessageKey(uploadPhase);
  const phaseMessageKey = phaseKey ? phaseKey.slice(phaseKey.lastIndexOf('.') + 1) : null;
  return phaseKey
    ? {
        message: translate(`output.pdf.mediaPicker.${phaseMessageKey}`),
        tone: uploadPhase === 'success' ? ('success' as const) : ('default' as const),
      }
    : { message: null, tone: 'default' as const };
};

type WasteOutputBrandingMediaFieldProps = {
  readonly error?: string;
  readonly onChange: (value: string) => void;
  readonly translate: WasteOutputTranslate;
  readonly value: string;
};

export const WasteOutputBrandingMediaField = (props: WasteOutputBrandingMediaFieldProps) => {
  const { error, onChange, translate, value } = props;
  const controller = useWasteBrandingMediaController(onChange);

  const labels = useMemo(() => createMediaPickerLabels(translate), [translate]);
  const feedback = useMemo(
    () =>
      resolvePickerFeedback(
        translate,
        controller.mediaPicker.errorCode,
        controller.mediaPicker.uploadPhase
      ),
    [controller.mediaPicker.errorCode, controller.mediaPicker.uploadPhase, translate]
  );
  const hasPreview = isPersistableContentMediaUrl(value);

  return (
    <StudioField
      id="content-media-branding-url"
      label={translate('output.pdf.fields.brandingAssetUrl')}
      description={translate('output.pdf.fieldHints.brandingAssetUrl')}
      error={error}
    >
      <div className="space-y-3">
        {hasPreview ? (
          <BrandingPreview value={value} translate={translate} onRemove={() => onChange('')} />
        ) : null}
        <Input
          id="content-media-branding-url"
          type="url"
          aria-describedby={
            error
              ? 'content-media-branding-url-description content-media-branding-url-error'
              : 'content-media-branding-url-description'
          }
          aria-invalid={error ? true : undefined}
          placeholder={translate('output.pdf.mediaPicker.urlPlaceholder')}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <BrandingMediaPickerControls
          controller={controller}
          feedback={feedback}
          labels={labels}
          translate={translate}
        />
      </div>
    </StudioField>
  );
};
