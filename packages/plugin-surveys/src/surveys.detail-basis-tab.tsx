import { SurveyMetadataCard } from './surveys.detail-metadata-card.js';
// fallow-ignore-file code-duplication
import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';

import { StudioDetailCard } from '@sva/studio-ui-react';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import type { SurveyContentTranslate } from './surveys.question-editor.shared.js';
import type { SurveyContentItem } from './surveys.types.js';

export type SurveyTargetAreaOption = Readonly<{
  id: string;
  label: string;
}>;

export function SurveyIdentityCard({
  pt,
  titleOnly = false,
}: Readonly<{ pt: SurveyContentTranslate; titleOnly?: boolean }>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<SurveyDetailFormValues>();

  if (titleOnly)
    return (
      <StudioField
        id="survey-title"
        label={pt('fields.title')}
        required
        error={errors.title?.message ? pt(`validation.${errors.title.message}`) : undefined}
      >
        <Input id="survey-title" required {...register('title', { required: 'titleRequired' })} />
      </StudioField>
    );
  return (
    <StudioDetailCard
      title={pt('cards.basis.identity.title')}
      description={pt('cards.basis.identity.description')}
    >
      <div className="space-y-4">
        <StudioField
          id="survey-title"
          label={pt('fields.title')}
          required
          error={errors.title?.message ? pt(`validation.${errors.title.message}`) : undefined}
        >
          <Input id="survey-title" required {...register('title', { required: 'titleRequired' })} />
        </StudioField>
        {!titleOnly ? <SurveyStatusField pt={pt} /> : null}
      </div>
    </StudioDetailCard>
  );
}
export function SurveyStatusField({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { control, setValue } = useFormContext<SurveyDetailFormValues>();
  const status = useWatch({ control, name: 'basis.status' }) ?? 'DRAFT';
  return (
    <StudioField id="survey-status" label={pt('fields.status')}>
      <Select
        id="survey-status"
        value={status}
        onChange={(event) =>
          setValue(
            'basis.status',
            event.target.value as SurveyDetailFormValues['basis']['status'],
            {
              shouldDirty: true,
            }
          )
        }
      >
        <option value="DRAFT">{pt('fields.statusOptions.draft')}</option>
        <option value="ACTIVE">{pt('fields.statusOptions.active')}</option>
        <option value="ARCHIVED">{pt('fields.statusOptions.archived')}</option>
      </Select>
    </StudioField>
  );
}
export function SurveyScheduleCard({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { register } = useFormContext<SurveyDetailFormValues>();

  return (
    <StudioDetailCard
      title={pt('cards.basis.schedule.title')}
      description={pt('cards.basis.schedule.description')}
    >
      <div className="space-y-4">
        <StudioField id="survey-start-at" label={pt('fields.startAt')}>
          <Input id="survey-start-at" type="datetime-local" {...register('basis.startAt')} />
        </StudioField>
        <StudioField id="survey-end-at" label={pt('fields.endAt')}>
          <Input id="survey-end-at" type="datetime-local" {...register('basis.endAt')} />
        </StudioField>
        <p className="text-sm text-muted-foreground">{pt('messages.unlimitedScheduleHint')}</p>
      </div>
    </StudioDetailCard>
  );
}
export function SurveyTargetAreaCard({
  availableTargetAreas,
  pt,
}: Readonly<{
  availableTargetAreas: readonly SurveyTargetAreaOption[];
  pt: SurveyContentTranslate;
}>) {
  const { setValue } = useFormContext<SurveyDetailFormValues>();
  const [pendingTargetAreaId, setPendingTargetAreaId] = React.useState('');
  const targetAreaIds = useWatch({ name: 'basis.targetAreaIds' }) ?? [];
  const knownTargetAreas = React.useMemo(
    () => new Map(availableTargetAreas.map((option) => [option.id, option.label])),
    [availableTargetAreas]
  );
  const selectedTargetAreas = targetAreaIds.map((targetAreaId: string) => ({
    id: targetAreaId,
    label: knownTargetAreas.get(targetAreaId) ?? targetAreaId,
  }));

  const addTargetArea = () => {
    const nextId = pendingTargetAreaId.trim();
    if (!nextId || targetAreaIds.includes(nextId)) {
      return;
    }

    setValue('basis.targetAreaIds', [...targetAreaIds, nextId], { shouldDirty: true });
    setPendingTargetAreaId('');
  };
  const removeTargetArea = (targetAreaId: string) =>
    setValue(
      'basis.targetAreaIds',
      targetAreaIds.filter((entry: string) => entry !== targetAreaId),
      { shouldDirty: true }
    );

  return (
    <StudioDetailCard
      title={pt('cards.basis.targetArea.title')}
      description={pt('cards.basis.targetArea.description')}
    >
      <div className="space-y-4">
        <SurveyTargetAreaInput
          availableTargetAreas={availableTargetAreas}
          pendingTargetAreaId={pendingTargetAreaId}
          pt={pt}
          onAddTargetArea={addTargetArea}
          onPendingTargetAreaIdChange={setPendingTargetAreaId}
        />
        {selectedTargetAreas.length > 0 ? (
          <SelectedTargetAreas
            selectedTargetAreas={selectedTargetAreas}
            pt={pt}
            onRemoveTargetArea={removeTargetArea}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{pt('messages.targetAreasEmpty')}</p>
        )}
      </div>
    </StudioDetailCard>
  );
}
function SurveyTargetAreaInput({
  availableTargetAreas,
  pendingTargetAreaId,
  pt,
  onAddTargetArea,
  onPendingTargetAreaIdChange,
}: Readonly<{
  availableTargetAreas: readonly SurveyTargetAreaOption[];
  pendingTargetAreaId: string;
  pt: SurveyContentTranslate;
  onAddTargetArea: () => void;
  onPendingTargetAreaIdChange: (value: string) => void;
}>) {
  return (
    <StudioField id="survey-target-area-select" label={pt('fields.targetAreas')}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="survey-target-area-select"
          aria-label={pt('fields.targetAreasSearch')}
          list="survey-target-area-options"
          value={pendingTargetAreaId}
          placeholder={pt('fields.targetAreasSearchPlaceholder')}
          onChange={(event) => onPendingTargetAreaIdChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onAddTargetArea();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={onAddTargetArea}>
          {pt('actions.addTargetArea')}
        </Button>
      </div>
      <datalist id="survey-target-area-options">
        {availableTargetAreas.map((option) => (
          <option key={option.id} value={option.id} label={option.label} />
        ))}
      </datalist>
    </StudioField>
  );
}
function SelectedTargetAreas({
  selectedTargetAreas,
  pt,
  onRemoveTargetArea,
}: Readonly<{
  selectedTargetAreas: readonly SurveyTargetAreaOption[];
  pt: SurveyContentTranslate;
  onRemoveTargetArea: (targetAreaId: string) => void;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      {selectedTargetAreas.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="secondary"
          size="sm"
          aria-label={pt('actions.removeTargetArea', { name: option.label })}
          onClick={() => onRemoveTargetArea(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
export function SurveyDetailBasisTab({
  mode,
  loadedItem,
  availableTargetAreas,
  pt,
}: Readonly<{
  mode: 'create' | 'edit';
  loadedItem: Pick<
    SurveyContentItem,
    'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt'
  > | null;
  availableTargetAreas: readonly SurveyTargetAreaOption[];
  pt: SurveyContentTranslate;
}>) {
  return (
    <div className="space-y-5">
      <SurveyIdentityCard pt={pt} />
      <SurveyScheduleCard pt={pt} />
      <SurveyTargetAreaCard availableTargetAreas={availableTargetAreas} pt={pt} />
      <SurveyMetadataCard mode={mode} loadedItem={loadedItem} pt={pt} />
    </div>
  );
}
