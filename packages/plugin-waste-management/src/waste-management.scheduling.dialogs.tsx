import type { WasteTourRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';
import type { FormEvent, ReactNode } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import {
  wasteFollowUpModeOptions,
  wasteReasonTypeOptions,
  type GlobalDateShiftFormState,
  type TourDateShiftFormState,
} from './waste-management.scheduling.shared.js';

export const ShiftCard = ({
  title,
  originalDate,
  actualDate,
  description,
  badges,
  actions,
}: {
  readonly title: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly description?: string;
  readonly badges: readonly string[];
  readonly actions?: ReactNode;
}) => (
  <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{originalDate}</Badge>
      <Badge>{actualDate}</Badge>
      {badges.map((badge) => (
        <Badge key={badge} variant="secondary">
          {badge}
        </Badge>
      ))}
    </div>
  </section>
);

export const TourDateShiftDialog = ({
  open,
  mode,
  form,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TourDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TourDateShiftFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('scheduling.tour.dialog.createTitle') : pt('scheduling.tour.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('scheduling.tour.dialog.createDescription') : pt('scheduling.tour.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-tour-shift-tour" label={pt('scheduling.tour.fields.tourId')}>
              <Select id="waste-tour-shift-tour" value={form.tourId} onChange={(event) => onChange({ tourId: event.target.value })}>
                <option value="">{pt('scheduling.tour.fields.tourUnset')}</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-shift-original-date" label={pt('scheduling.tour.fields.originalDate')}>
              <Input id="waste-tour-shift-original-date" type="date" value={form.originalDate} onChange={(event) => onChange({ originalDate: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-shift-actual-date" label={pt('scheduling.tour.fields.actualDate')}>
              <Input id="waste-tour-shift-actual-date" type="date" value={form.actualDate} onChange={(event) => onChange({ actualDate: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-shift-description" label={pt('scheduling.tour.fields.description')}>
              <Textarea id="waste-tour-shift-description" value={form.description} onChange={(event) => onChange({ description: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-shift-reason-type" label={pt('scheduling.tour.fields.reasonType')}>
              <Select
                id="waste-tour-shift-reason-type"
                value={form.reasonType}
                onChange={(event) => onChange({ reasonType: event.target.value as TourDateShiftFormState['reasonType'] })}
              >
                <option value="">{pt('scheduling.tour.fields.reasonTypeUnset')}</option>
                {wasteReasonTypeOptions.map((reasonType) => (
                  <option key={reasonType} value={reasonType}>
                    {pt(`scheduling.reasonTypes.${reasonType}`)}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-shift-reason-key" label={pt('scheduling.tour.fields.reasonKey')}>
              <Input id="waste-tour-shift-reason-key" value={form.reasonKey} onChange={(event) => onChange({ reasonKey: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-shift-follow-up-mode" label={pt('scheduling.tour.fields.followUpMode')}>
              <Select
                id="waste-tour-shift-follow-up-mode"
                value={form.followUpMode}
                onChange={(event) => onChange({ followUpMode: event.target.value as TourDateShiftFormState['followUpMode'] })}
              >
                <option value="">{pt('scheduling.tour.fields.followUpModeUnset')}</option>
                {wasteFollowUpModeOptions.map((followUpMode) => (
                  <option key={followUpMode} value={followUpMode}>
                    {pt(`scheduling.followUpModes.${followUpMode}`)}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-shift-has-year" label={pt('scheduling.tour.fields.hasYear')}>
              <div className="flex items-center gap-3">
                <Checkbox id="waste-tour-shift-has-year" checked={form.hasYear} onChange={(event) => onChange({ hasYear: event.currentTarget.checked })} />
                <span className="text-sm text-muted-foreground">{form.hasYear ? pt('common.yes') : pt('common.no')}</span>
              </div>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('scheduling.tour.actions.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? pt('scheduling.tour.actions.saving') : mode === 'create' ? pt('scheduling.tour.actions.create') : pt('scheduling.tour.actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const GlobalDateShiftDialog = ({
  open,
  mode,
  form,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: GlobalDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<GlobalDateShiftFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('scheduling.global.dialog.createTitle') : pt('scheduling.global.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('scheduling.global.dialog.createDescription') : pt('scheduling.global.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-global-shift-original-date" label={pt('scheduling.global.fields.originalDate')}>
              <Input id="waste-global-shift-original-date" type="date" value={form.originalDate} onChange={(event) => onChange({ originalDate: event.target.value })} />
            </StudioField>
            <StudioField id="waste-global-shift-actual-date" label={pt('scheduling.global.fields.actualDate')}>
              <Input id="waste-global-shift-actual-date" type="date" value={form.actualDate} onChange={(event) => onChange({ actualDate: event.target.value })} />
            </StudioField>
            <StudioField id="waste-global-shift-description" label={pt('scheduling.global.fields.description')}>
              <Textarea id="waste-global-shift-description" value={form.description} onChange={(event) => onChange({ description: event.target.value })} />
            </StudioField>
            <StudioField id="waste-global-shift-reason-type" label={pt('scheduling.global.fields.reasonType')}>
              <Select
                id="waste-global-shift-reason-type"
                value={form.reasonType}
                onChange={(event) => onChange({ reasonType: event.target.value as GlobalDateShiftFormState['reasonType'] })}
              >
                <option value="">{pt('scheduling.global.fields.reasonTypeUnset')}</option>
                {wasteReasonTypeOptions.map((reasonType) => (
                  <option key={reasonType} value={reasonType}>
                    {pt(`scheduling.reasonTypes.${reasonType}`)}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-global-shift-reason-key" label={pt('scheduling.global.fields.reasonKey')}>
              <Input id="waste-global-shift-reason-key" value={form.reasonKey} onChange={(event) => onChange({ reasonKey: event.target.value })} />
            </StudioField>
            <StudioField id="waste-global-shift-has-year" label={pt('scheduling.global.fields.hasYear')}>
              <div className="flex items-center gap-3">
                <Checkbox id="waste-global-shift-has-year" checked={form.hasYear} onChange={(event) => onChange({ hasYear: event.currentTarget.checked })} />
                <span className="text-sm text-muted-foreground">{form.hasYear ? pt('common.yes') : pt('common.no')}</span>
              </div>
            </StudioField>
            <StudioField id="waste-global-shift-tours" label={pt('scheduling.global.fields.tourIds')}>
              <div className="space-y-2 rounded-md border border-border/70 p-3">
                {tours.length ? (
                  tours.map((tour) => {
                    const checked = form.tourIds.includes(tour.id);
                    return (
                      <label key={tour.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onChange={(event) =>
                            onChange({
                              tourIds: event.currentTarget.checked
                                ? [...form.tourIds, tour.id]
                                : form.tourIds.filter((value) => value !== tour.id),
                            })
                          }
                        />
                        <span>{tour.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">{pt('scheduling.global.fields.noToursAvailable')}</p>
                )}
              </div>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('scheduling.global.actions.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? pt('scheduling.global.actions.saving') : mode === 'create' ? pt('scheduling.global.actions.create') : pt('scheduling.global.actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
