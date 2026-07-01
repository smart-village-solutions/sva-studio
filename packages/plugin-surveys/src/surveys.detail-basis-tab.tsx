import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';

import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import type { SurveyContentItem } from './surveys.types.js';

type SurveyTargetAreaOption = Readonly<{
  id: string;
  label: string;
}>;

const formatMetadataDate = (value?: string) =>
  value ? (formatDateTimeInEditorTimeZone(value) ?? value) : '--.--.-- --:--';

export function SurveyDetailBasisTab({
  mode,
  loadedItem,
  availableTargetAreas,
  pt,
}: Readonly<{
  mode: 'create' | 'edit';
  loadedItem: Pick<SurveyContentItem, 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt'> | null;
  availableTargetAreas: readonly SurveyTargetAreaOption[];
  pt: (key: string) => string;
}>) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<SurveyDetailFormValues>();
  const status = useWatch({ name: 'basis.status' }) ?? 'DRAFT';
  const targetAreaIds = useWatch({ name: 'basis.targetAreaIds' }) ?? [];

  const selectedTargetAreas = availableTargetAreas.filter((option) => targetAreaIds.includes(option.id));

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.basis.identity.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.basis.identity.description')}</p>
        </div>
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          <StudioField
            id="survey-title"
            label={pt('fields.title')}
            required
            error={errors.title?.message ? pt(`validation.${errors.title.message}`) : undefined}
          >
            <Input id="survey-title" required {...register('title', { required: 'titleRequired' })} />
          </StudioField>
          <StudioField id="survey-status" label={pt('fields.status')}>
            <Select
              id="survey-status"
              value={status}
              onChange={(event) =>
                setValue('basis.status', event.target.value as SurveyDetailFormValues['basis']['status'], {
                  shouldDirty: true,
                })
              }
            >
              <option value="DRAFT">{pt('fields.statusOptions.draft')}</option>
              <option value="ACTIVE">{pt('fields.statusOptions.active')}</option>
              <option value="ARCHIVED">{pt('fields.statusOptions.archived')}</option>
            </Select>
          </StudioField>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.basis.schedule.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.basis.schedule.description')}</p>
        </div>
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          <StudioField id="survey-start-at" label={pt('fields.startAt')}>
            <Input id="survey-start-at" type="datetime-local" {...register('basis.startAt')} />
          </StudioField>
          <StudioField id="survey-end-at" label={pt('fields.endAt')}>
            <Input id="survey-end-at" type="datetime-local" {...register('basis.endAt')} />
          </StudioField>
          <p className="text-sm text-muted-foreground">{pt('messages.unlimitedScheduleHint')}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.basis.targetArea.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.basis.targetArea.description')}</p>
        </div>
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          <StudioField id="survey-target-area-select" label={pt('fields.targetAreas')}>
            <Select
              id="survey-target-area-select"
              aria-label={pt('fields.targetAreasSearch')}
              value=""
              onChange={(event) => {
                const nextId = event.target.value;
                if (!nextId || targetAreaIds.includes(nextId)) {
                  return;
                }
                setValue('basis.targetAreaIds', [...targetAreaIds, nextId], { shouldDirty: true });
              }}
            >
              <option value="">{pt('fields.targetAreasSearchPlaceholder')}</option>
              {availableTargetAreas.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </StudioField>
          {selectedTargetAreas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedTargetAreas.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={pt('actions.removeTargetArea').replace('{{name}}', option.label)}
                  onClick={() =>
                    setValue(
                      'basis.targetAreaIds',
                      targetAreaIds.filter((entry: string) => entry !== option.id),
                      { shouldDirty: true }
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{pt('messages.targetAreasEmpty')}</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{pt('cards.basis.metadata.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pt('cards.basis.metadata.description')}</p>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          {mode === 'create' ? (
            <p className="text-sm text-muted-foreground">{pt('messages.metadataCreateHint')}</p>
          ) : (
            <dl className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <dt className="font-medium text-foreground">{pt('fields.createdAt')}</dt>
                <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.createdAt)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium text-foreground">{pt('fields.updatedAt')}</dt>
                <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.updatedAt)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium text-foreground">{pt('fields.publishedAt')}</dt>
                <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.publishedAt)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium text-foreground">{pt('fields.archivedAt')}</dt>
                <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.archivedAt)}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}
