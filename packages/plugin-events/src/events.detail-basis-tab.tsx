import type React from 'react';
import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { useFormContext, useWatch } from 'react-hook-form';
import { Input, StudioField } from '@sva/studio-ui-react';

import type { EventsDetailFormValues } from './events.detail-form.js';
import type { EventContentItem } from './events.types.js';

const formatMetaDate = (value?: string) => (value ? formatDateTimeInEditorTimeZone(value) ?? value : '--.--.-- --:--');

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

export function EventsDetailBasisTab({
  loadedItem,
  mode,
  pt,
}: Readonly<{
  loadedItem: EventContentItem | null;
  mode: 'create' | 'edit';
  pt: (key: string) => string;
}>) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const title = useWatch({ control, name: 'title' }) ?? '';
  const categoryName = useWatch({ control, name: 'basis.categoryName' }) ?? '';

  return (
    <div className="space-y-6">
      <SectionCard title={pt('cards.basis.identity.title')} description={pt('cards.basis.identity.description')}>
        <StudioField id="event-title" label={pt('fields.title')} required>
          <Input
            id="event-title"
            required
            value={title}
            onChange={(event) => setValue('title', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="event-category" label={pt('fields.categoryName')}>
          <Input
            id="event-category"
            value={categoryName}
            onChange={(event) => setValue('basis.categoryName', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </SectionCard>

      {mode === 'edit' ? (
        <SectionCard title={pt('cards.basis.meta.title')} description={pt('cards.basis.meta.description')}>
          <dl className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-2">
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.createdAt')}</dt>
              <dd className="text-muted-foreground">{formatMetaDate(loadedItem?.createdAt)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.updatedAt')}</dt>
              <dd className="text-muted-foreground">{formatMetaDate(loadedItem?.updatedAt)}</dd>
            </div>
          </dl>
        </SectionCard>
      ) : null}
    </div>
  );
}
