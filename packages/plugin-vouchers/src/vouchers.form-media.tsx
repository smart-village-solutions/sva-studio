import { Button, Input, StudioField } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { VoucherMediaLibrary } from './vouchers.media.js';
import { useVoucherAccess } from './vouchers.access.js';
import type { VoucherFormProps } from './vouchers.form-fields.js';
import type { VoucherInput } from './vouchers.types.js';
type Media = VoucherInput['mediaContents'][number];
type MediaKey = 'url' | 'description' | 'captionText' | 'copyright';
const mediaValue = (media: Media, key: MediaKey) =>
  key === 'url' || key === 'description' ? (media.sourceUrl[key] ?? '') : (media[key] ?? '');
const updateMedia = (media: Media, key: MediaKey, value: string): Media => {
  if (key === 'url')
    return { ...media, hostMediaAssetId: undefined, sourceUrl: { ...media.sourceUrl, url: value } };
  if (key === 'description')
    return { ...media, sourceUrl: { ...media.sourceUrl, description: value } };
  return { ...media, [key]: value };
};
const fields: readonly Readonly<{
  key: MediaKey;
  label: string;
}>[] = [
  { key: 'url', label: 'media.url' },
  { key: 'description', label: 'messages.mediaPickerAltText' },
  { key: 'captionText', label: 'media.caption' },
  { key: 'copyright', label: 'media.copyright' },
];
function VoucherImageFields({
  media,
  index,
  onChange,
  onRemove,
}: Readonly<{
  media: Media;
  index: number;
  onChange: (media: Media) => void;
  onRemove: () => void;
}>) {
  const t = usePluginTranslation('vouchers');
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      {fields.map(({ key, label }) => (
        <StudioField
          key={key}
          id={`voucher-media-${key}-${index}`}
          label={t(label)}
          required={key === 'url'}
        >
          <Input
            id={`voucher-media-${key}-${index}`}
            type={key === 'url' ? 'url' : 'text'}
            required={key === 'url'}
            value={mediaValue(media, key)}
            onChange={(event) => onChange(updateMedia(media, key, event.target.value))}
          />
        </StudioField>
      ))}
      <Button type="button" variant="secondary" onClick={onRemove}>
        {t('media.remove')}
      </Button>
    </div>
  );
}
export function VoucherMediaFields({ draft, change }: VoucherFormProps) {
  const t = usePluginTranslation('vouchers');
  const access = useVoucherAccess();
  const canSelect =
    access.permissionActions.includes('media.read') &&
    access.permissionActions.includes('media.reference.manage');
  return (
    <div className="space-y-3">
      <h3 className="font-medium">{t('fields.media')}</h3>
      {canSelect && (
        <VoucherMediaLibrary
          onSelect={(media) => change('mediaContents', [...draft.mediaContents, media])}
        />
      )}
      {draft.mediaContents.map((media, index) => (
        <VoucherImageFields
          key={index}
          index={index}
          media={media}
          onChange={(value) =>
            change(
              'mediaContents',
              draft.mediaContents.map((item, i) => (i === index ? value : item))
            )
          }
          onRemove={() =>
            change(
              'mediaContents',
              draft.mediaContents.filter((_, i) => i !== index)
            )
          }
        />
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          change('mediaContents', [
            ...draft.mediaContents,
            { contentType: 'image', sourceUrl: { url: '' } },
          ])
        }
      >
        {t('media.add')}
      </Button>
    </div>
  );
}
