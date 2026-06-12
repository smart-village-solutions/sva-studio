import type React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { MediaReferenceField } from '@sva/studio-ui-react';

import type { PoiDetailFormValues } from './poi.detail-form.js';

const SectionCard = ({
  title,
  description,
  children,
}: Readonly<{ title: string; description?: string; children: React.ReactNode }>) => (
  <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

export function PoiDetailSettingsTab({
  mediaOptions,
  pt,
}: Readonly<{
  mediaOptions: readonly { assetId: string; label: string }[];
  pt: (key: string) => string;
}>) {
  const { control } = useFormContext<PoiDetailFormValues>();

  return (
    <SectionCard title={pt('cards.settings.media.title')} description={pt('cards.settings.media.description')}>
      <Controller
        name="settings.teaserImageAssetId"
        control={control}
        render={({ field }) => (
          <MediaReferenceField
            id="poi-teaser-image"
            label={pt('fields.teaserImage')}
            value={field.value || null}
            options={mediaOptions}
            onChange={(assetId) => field.onChange(assetId ?? '')}
            placeholder={pt('fields.mediaPlaceholder')}
            clearLabel={pt('actions.clearMedia')}
          />
        )}
      />
    </SectionCard>
  );
}
