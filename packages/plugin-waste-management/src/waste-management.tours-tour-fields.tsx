import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

import { WasteToursCustomDatesField } from './waste-management.tours-custom-dates.js';
import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import { WasteToursFractionSelection } from './waste-management.tours.fractions.js';
import type { TourFormState } from './waste-management.tours.shared.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const recurringTourRecurrences = new Set<NonNullable<TourFormState['recurrence']>>(['weekly', 'biweekly', 'fourweekly', 'yearly']);

const TourSection = ({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) => (
  <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {children}
  </div>
);

export const WasteToursTourFields = ({
  form,
  fractions,
  saving = false,
  pt,
  onChange,
}: {
  readonly form: TourFormState;
  readonly fractions: readonly WasteFractionRecord[];
  readonly saving?: boolean;
  readonly pt: Translate;
  readonly onChange: (patch: Partial<TourFormState>) => void;
}) => {
  const showsDateRange = recurringTourRecurrences.has(form.recurrence);
  const showsCustomDates = form.recurrence === 'custom';

  return (
    <div className="space-y-6">
      <TourSection title={pt('tours.sections.basics')} description={pt('tours.sections.basicsHint')}>
        <StudioFieldGroup>
          <StudioField id="waste-tour-name" label={pt('tours.fields.name')} description={pt('tours.fieldHints.name')} required>
            <Input id="waste-tour-name" value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
          </StudioField>
          <StudioField
            id="waste-tour-fractions"
            label={pt('tours.fields.wasteFractions')}
            description={pt('tours.fieldHints.wasteFractions')}
          >
            <WasteToursFractionSelection
              fractions={fractions}
              selectedFractionIds={form.wasteFractionIds}
              disabled={saving}
              pt={pt}
              onChange={(wasteFractionIds) => onChange({ wasteFractionIds })}
            />
          </StudioField>
          <StudioField id="waste-tour-description" label={pt('tours.fields.description')} description={pt('tours.fieldHints.description')}>
            <Textarea id="waste-tour-description" value={form.description} rows={4} maxLength={300} onChange={(event) => onChange({ description: event.target.value })} />
          </StudioField>
        </StudioFieldGroup>
      </TourSection>

      <TourSection title={pt('tours.sections.scheduling')} description={pt('tours.sections.schedulingHint')}>
        <StudioFieldGroup>
          <StudioField id="waste-tour-recurrence" label={pt('tours.fields.recurrence')} description={pt('tours.fieldHints.recurrence')}>
            <Select
              id="waste-tour-recurrence"
              value={form.recurrence}
              onChange={(event) => {
                const recurrence = event.target.value as TourFormState['recurrence'];
                onChange({
                  recurrence,
                  firstDate: recurringTourRecurrences.has(recurrence) ? form.firstDate : '',
                  endDate: recurringTourRecurrences.has(recurrence) ? form.endDate : '',
                  customDates: recurrence === 'custom' ? form.customDates : [],
                });
              }}
            >
              <option value="custom">{pt('tours.recurrence.custom')}</option>
              <option value="weekly">{pt('tours.recurrence.weekly')}</option>
              <option value="biweekly">{pt('tours.recurrence.biweekly')}</option>
              <option value="fourweekly">{pt('tours.recurrence.fourweekly')}</option>
              <option value="yearly">{pt('tours.recurrence.yearly')}</option>
              <option value="on-demand">{pt('tours.recurrence.onDemand')}</option>
            </Select>
          </StudioField>
          {showsDateRange ? (
            <>
              <StudioField id="waste-tour-first-date" label={pt('tours.fields.firstDate')}>
                <Input id="waste-tour-first-date" type="date" value={form.firstDate} onChange={(event) => onChange({ firstDate: event.target.value })} />
              </StudioField>
              <StudioField id="waste-tour-end-date" label={pt('tours.fields.endDate')}>
                <Input id="waste-tour-end-date" type="date" value={form.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
              </StudioField>
            </>
          ) : null}
          {showsCustomDates ? (
            <StudioField id="waste-tour-custom-dates" label={pt('tours.fields.customDates')} description={pt('tours.fieldHints.customDates')}>
              <WasteToursCustomDatesField
                customDates={form.customDates}
                firstDate={form.firstDate}
                endDate={form.endDate}
                disabled={saving}
                onChange={(customDates) => onChange({ customDates })}
              />
            </StudioField>
          ) : null}
        </StudioFieldGroup>
      </TourSection>

      <TourSection title={pt('tours.sections.visibility')} description={pt('tours.sections.visibilityHint')}>
        <div className="flex items-center gap-3">
          <WasteManagementFormSwitch
            checked={form.active}
            ariaLabel={pt('tours.fields.active')}
            onChange={(active) => onChange({ active })}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{form.active ? pt('common.active') : pt('common.inactive')}</p>
            <p className="text-xs text-muted-foreground">
              {form.active ? pt('tours.statusHints.active') : pt('tours.statusHints.inactive')}
            </p>
          </div>
        </div>
      </TourSection>
    </div>
  );
};
