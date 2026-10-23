import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import type {
  StudioMediaPickerMetadataDraft,
  StudioMediaPickerMetadataField,
} from './studio-media-picker-overlay.shared.js';
import * as React from 'react';

import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import type {
  ContentMediaUsageBlockLabels,
  ContentMediaUsageSupportedFields,
} from './content-media-usage-block.js';
import type {
  ContentMediaAssetSnapshot,
  ContentMediaUsage,
  ContentMediaUsagePatch,
} from './content-media-usage.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';

type MetadataKey = keyof ContentMediaAssetSnapshot;
type MetadataUsage = Pick<
  ContentMediaUsage,
  'persistentUrl' | 'altText' | 'caption' | 'credit' | 'license' | 'assetSnapshot'
>;
const metadataKeys = ['persistentUrl', 'altText', 'caption', 'credit', 'license'] as const;
const isVisible = (key: MetadataKey, fields: ContentMediaUsageSupportedFields) =>
  key === 'persistentUrl' ||
  (key === 'altText' && fields.altText) ||
  (key === 'caption' && fields.caption) ||
  (key === 'credit' && fields.credit) ||
  (key === 'license' && fields.license);
const defaultSelection = (usage: MetadataUsage, asset: ContentMediaAssetSnapshot) =>
  Object.fromEntries(
    metadataKeys.map((key) => {
      const original = usage.assetSnapshot?.[key];
      return [key, original !== undefined && usage[key] === original && asset[key] !== usage[key]];
    })
  ) as Readonly<Record<MetadataKey, boolean>>;

export type ContentMediaMetadataSelectionLabels = Readonly<{
  fields: ContentMediaUsageBlockLabels['fields'];
  refresh: ContentMediaUsageBlockLabels['refresh'];
  actions: Pick<ContentMediaUsageBlockLabels['actions'], 'apply' | 'cancel'>;
}>;

type SelectionProps = Readonly<{
  asset: ContentMediaAssetSnapshot;
  labels: ContentMediaMetadataSelectionLabels;
  onApply: (patch: ContentMediaUsagePatch) => void;
  onClose: () => void;
  supportedFields: ContentMediaUsageSupportedFields;
  usage: MetadataUsage;
  includeUrl?: boolean;
}>;

export const ContentMediaMetadataSelection = ({
  asset,
  labels,
  onApply,
  onClose,
  supportedFields,
  usage,
  includeUrl = true,
}: SelectionProps) => {
  const [selection, setSelection] = React.useState(() => defaultSelection(usage, asset));
  const visibleKeys = metadataKeys.filter(
    (key) => isVisible(key, supportedFields) && (includeUrl || key !== 'persistentUrl')
  );
  const apply = () => {
    const patch = Object.fromEntries(
      visibleKeys.filter((key) => selection[key]).map((key) => [key, asset[key]])
    ) as ContentMediaUsagePatch;
    onApply({ ...patch, assetSnapshot: asset });
    onClose();
  };
  return (
    <>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto py-4">
        {visibleKeys.map((key) => (
          <label
            key={key}
            className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-border/60 p-3"
          >
            <Checkbox
              checked={selection[key]}
              onChange={(event) =>
                setSelection((current) => ({ ...current, [key]: event.currentTarget.checked }))
              }
            />
            <span className="min-w-0 space-y-2">
              <span className="block text-sm font-medium text-foreground">
                {key === 'persistentUrl' ? labels.fields.url : labels.fields[key]}
              </span>
              <span className="block break-all text-xs text-muted-foreground">
                {labels.refresh.assetValue}: {asset[key]}
              </span>
              <span className="block break-all text-xs text-muted-foreground">
                {labels.refresh.contentValue}: {usage[key]}
              </span>
            </span>
          </label>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          {labels.actions.cancel}
        </Button>
        <Button type="button" onClick={apply}>
          {labels.actions.apply}
        </Button>
      </DialogFooter>
    </>
  );
};

export const ContentMediaMetadataDialog = (props: SelectionProps) => (
  <Dialog open onOpenChange={(open) => (!open ? props.onClose() : undefined)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{props.labels.refresh.title}</DialogTitle>
        <DialogDescription>{props.labels.refresh.description}</DialogDescription>
      </DialogHeader>
      <ContentMediaMetadataSelection {...props} />
    </DialogContent>
  </Dialog>
);

type StudioMetadataRefreshProps = Readonly<{
  previous: StudioMediaPickerMetadataDraft;
  current: StudioMediaPickerMetadataDraft;
  content: StudioMediaPickerMetadataDraft;
  fields: readonly StudioMediaPickerMetadataField[];
  onChange: (field: StudioMediaPickerMetadataField, value: string) => void;
  onBack: () => void;
}>;

export const StudioMediaMetadataRefresh = ({
  previous,
  current,
  content,
  fields,
  onChange,
  onBack,
}: StudioMetadataRefreshProps) => {
  const t = useContentMediaTranslation();
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => heading.current?.focus(), []);
  const snapshot = (value: StudioMediaPickerMetadataDraft): ContentMediaAssetSnapshot => ({
    persistentUrl: '',
    altText: value.altText,
    caption: value.description,
    credit: value.copyright,
    license: value.license,
  });
  const mappedFields = {
    altText: 'altText',
    caption: 'description',
    credit: 'copyright',
    license: 'license',
  } as const;
  return (
    <section className="space-y-3">
      <h3
        ref={heading}
        tabIndex={-1}
        className="rounded-sm text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('editor.refreshTitle')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('editor.refreshHint')}</p>
      <ContentMediaMetadataSelection
        includeUrl={false}
        asset={snapshot(current)}
        usage={{ ...snapshot(content), assetSnapshot: snapshot(previous) }}
        supportedFields={{
          altText: fields.includes('altText'),
          caption: fields.includes('description'),
          credit: fields.includes('copyright'),
          license: fields.includes('license'),
        }}
        labels={{
          fields: {
            url: t('detail.publicUrlLabel'),
            altText: t('fields.altText'),
            caption: t('fields.description'),
            credit: t('fields.copyright'),
            license: t('fields.license'),
          },
          refresh: {
            title: t('editor.refreshTitle'),
            description: t('editor.refreshHint'),
            assetValue: t('editor.refreshAssetValue'),
            contentValue: t('editor.refreshContentValue'),
          },
          actions: {
            apply: t('editor.applySelectedMetadata'),
            cancel: t('editor.backToSelection'),
          },
        }}
        onClose={onBack}
        onApply={(patch) => {
          for (const [key, field] of Object.entries(mappedFields)) {
            const value = patch[key as keyof typeof mappedFields];
            if (typeof value === 'string') onChange(field, value);
          }
        }}
      />
    </section>
  );
};
