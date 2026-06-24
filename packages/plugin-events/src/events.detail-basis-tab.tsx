import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Button, Checkbox, Input, Select, StudioField } from '@sva/studio-ui-react';

import { EventsCategoryMultiselect } from './events.category-multiselect.js';
import { EventsPoiSelect } from './events.poi-select.js';
import type { EventsDetailFormValues } from './events.detail-form.js';
import type { EventCategoryOption, EventContentItem, PoiSelectItem } from './events.types.js';
import { EventsDetailCard } from './events.detail-card.js';

const formatMetaDate = (value?: string) => (value ? formatDateTimeInEditorTimeZone(value) ?? value : '--.--.-- --:--');

export function EventsDetailBasisTab({
  availableCategories,
  availablePois,
  categoryOptionsError,
  categoryOptionsLoading,
  loadedItem,
  mode,
  poiOptionsError,
  poiOptionsLoading,
  pt,
}: Readonly<{
  availableCategories: readonly EventCategoryOption[];
  availablePois: readonly PoiSelectItem[];
  categoryOptionsError?: string | null;
  categoryOptionsLoading: boolean;
  loadedItem: EventContentItem | null;
  mode: 'create' | 'edit';
  poiOptionsError?: string | null;
  poiOptionsLoading: boolean;
  pt: (key: string) => string;
}>) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const title = useWatch({ control, name: 'title' }) ?? '';
  const repeat = useWatch({ control, name: 'basis.repeat' }) ?? false;
  const recurringType = useWatch({ control, name: 'basis.recurringType' }) ?? '';
  const recurringInterval = useWatch({ control, name: 'basis.recurringInterval' }) ?? '';
  const recurringWeekdays = useWatch({ control, name: 'basis.recurringWeekdays' }) ?? [];
  const recurringTypeOptions = [
    { value: '', label: pt('fields.recurringTypePlaceholder') },
    { value: '0', label: pt('fields.recurringTypeOptions.days') },
    { value: '1', label: pt('fields.recurringTypeOptions.weeks') },
    { value: '2', label: pt('fields.recurringTypeOptions.months') },
    { value: '3', label: pt('fields.recurringTypeOptions.years') },
  ];
  const recurringWeekdayOptions = [
    { value: 'MO', label: pt('fields.recurringWeekdayOptions.monday'), shortLabel: pt('fields.recurringWeekdayShortOptions.monday') },
    { value: 'TU', label: pt('fields.recurringWeekdayOptions.tuesday'), shortLabel: pt('fields.recurringWeekdayShortOptions.tuesday') },
    { value: 'WE', label: pt('fields.recurringWeekdayOptions.wednesday'), shortLabel: pt('fields.recurringWeekdayShortOptions.wednesday') },
    { value: 'TH', label: pt('fields.recurringWeekdayOptions.thursday'), shortLabel: pt('fields.recurringWeekdayShortOptions.thursday') },
    { value: 'FR', label: pt('fields.recurringWeekdayOptions.friday'), shortLabel: pt('fields.recurringWeekdayShortOptions.friday') },
    { value: 'SA', label: pt('fields.recurringWeekdayOptions.saturday'), shortLabel: pt('fields.recurringWeekdayShortOptions.saturday') },
    { value: 'SU', label: pt('fields.recurringWeekdayOptions.sunday'), shortLabel: pt('fields.recurringWeekdayShortOptions.sunday') },
  ];

  return (
    <div className="space-y-6">
      <EventsDetailCard title={pt('cards.basis.identity.title')} description={pt('cards.basis.identity.description')}>
        <StudioField id="event-title" label={pt('fields.title')} required>
          <Input
            id="event-title"
            required
            value={title}
            onChange={(event) => setValue('title', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="event-categories" label={pt('fields.categories')} description={pt('fields.categoriesHelp')}>
          <Controller
            name="basis.categories"
            control={control}
            render={({ field }) => (
              <EventsCategoryMultiselect
                availableCategories={availableCategories}
                errorMessage={categoryOptionsError ?? undefined}
                loading={categoryOptionsLoading}
                helpText={pt('fields.categoriesHelp')}
                inputId="event-category"
                inputPlaceholder={pt('fields.categoriesSearchPlaceholder')}
                loadingText={pt('messages.categoryOptionsLoading')}
                searchLabel={pt('fields.categoriesSearch')}
                addLabel={pt('actions.addCategory')}
                removeLabel={(name) => pt('actions.removeCategory').replace('{{name}}', name)}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </StudioField>
      </EventsDetailCard>

      <EventsDetailCard title={pt('cards.basis.recurrence.title')} description={pt('cards.basis.recurrence.description')}>
        <StudioField id="event-repeat" label={pt('fields.repeat')}>
          <Checkbox
            id="event-repeat"
            checked={repeat}
            onChange={(event) => {
              const nextRepeat = event.target.checked;
              setValue('basis.repeat', nextRepeat, { shouldDirty: true });
              if (!nextRepeat) {
                setValue('basis.recurringType', '', { shouldDirty: true });
                setValue('basis.recurringInterval', '', { shouldDirty: true });
                setValue('basis.recurringWeekdays', [], { shouldDirty: true });
              }
            }}
          />
        </StudioField>
        {repeat ? (
          <>
            <StudioField id="event-recurring-type" label={pt('fields.recurringType')}>
              <Select
                id="event-recurring-type"
                value={recurringType}
                onChange={(event) => {
                  const nextRecurringType = event.target.value;
                  setValue('basis.recurringType', nextRecurringType, { shouldDirty: true });
                  if (nextRecurringType !== '1') {
                    setValue('basis.recurringWeekdays', [], { shouldDirty: true });
                  }
                }}
              >
                {recurringTypeOptions.map((option) => (
                  <option key={option.value || 'empty'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="event-recurring-interval" label={pt('fields.recurringInterval')}>
              <Input
                id="event-recurring-interval"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={recurringInterval}
                onChange={(event) => setValue('basis.recurringInterval', event.target.value, { shouldDirty: true })}
              />
            </StudioField>
            {recurringType === '1' ? (
              <StudioField id="event-recurring-weekdays" label={pt('fields.recurringWeekdays')}>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                  {recurringWeekdayOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={recurringWeekdays.includes(option.value) ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={recurringWeekdays.includes(option.value)}
                      aria-label={option.label}
                      className="min-w-10 rounded-full px-3"
                      onClick={() => {
                        const nextWeekdays = recurringWeekdays.includes(option.value)
                          ? recurringWeekdays.filter((entry) => entry !== option.value)
                          : [...recurringWeekdays, option.value];
                        setValue('basis.recurringWeekdays', nextWeekdays, { shouldDirty: true });
                      }}
                    >
                      {option.shortLabel}
                    </Button>
                  ))}
                </div>
              </StudioField>
            ) : null}
          </>
        ) : null}
      </EventsDetailCard>

      <EventsDetailCard title={pt('cards.basis.relations.title')} description={pt('cards.basis.relations.description')}>
        <StudioField id="event-poi-link" label={pt('fields.pointOfInterestId')}>
          <Controller
            name="basis.pointOfInterestId"
            control={control}
            render={({ field }) => (
              <EventsPoiSelect
                availablePois={availablePois}
                clearLabel={pt('actions.clearPoiSelection')}
                emptyText={pt('messages.poiOptionsEmpty')}
                errorMessage={poiOptionsError ?? undefined}
                inputId="event-poi"
                inputPlaceholder={pt('fields.pointOfInterestSearchPlaceholder')}
                loading={poiOptionsLoading}
                loadingText={pt('messages.poiOptionsLoading')}
                searchLabel={pt('fields.pointOfInterestSearch')}
                value={field.value}
                onChange={(nextValue) => {
                  setValue('basis.pointOfInterestId', nextValue, { shouldDirty: true });
                }}
              />
            )}
          />
        </StudioField>
      </EventsDetailCard>

      {mode === 'edit' ? (
        <EventsDetailCard title={pt('cards.basis.meta.title')} description={pt('cards.basis.meta.description')}>
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
        </EventsDetailCard>
      ) : null}
    </div>
  );
}
