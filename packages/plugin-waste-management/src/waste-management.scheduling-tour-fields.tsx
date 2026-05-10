import type { WasteTourRecord } from '@sva/core';
import { Checkbox, Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

import { wasteFollowUpModeOptions, wasteReasonTypeOptions } from './waste-management.scheduling.options.js';
import type { TourDateShiftFormState } from './waste-management.scheduling.shared.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteSchedulingTourFields = ({
  form,
  tours,
  pt,
  onChange,
}: {
  readonly form: TourDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly pt: Translate;
  readonly onChange: (patch: Partial<TourDateShiftFormState>) => void;
}) => (
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
);
