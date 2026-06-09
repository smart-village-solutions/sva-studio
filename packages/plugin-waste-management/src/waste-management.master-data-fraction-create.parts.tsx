import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type { FractionFormState } from './waste-management.master-data.forms.js';

export type FractionFormErrors = {
  readonly name?: string;
  readonly pdfShortLabel?: string;
  readonly color?: string;
};

const normalizeColor = (value: string) => value.trim().toLowerCase();
const isHexColor = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

export const validateFractionForm = (
  form: FractionFormState,
  pt: ReturnType<typeof usePluginTranslation>
): FractionFormErrors => ({
  name: form.name.trim() ? undefined : pt('masterData.fractions.createView.validation.nameRequired'),
  pdfShortLabel: form.pdfShortLabel.trim()
    ? undefined
    : pt('masterData.fractions.createView.validation.pdfShortLabelRequired'),
  color: isHexColor(form.color) ? undefined : pt('masterData.fractions.createView.validation.colorRequired'),
});

export const FractionSection = ({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) => (
  <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {children}
  </section>
);

export const FractionFormActions = ({
  cancelLabel,
  saveLabel,
  saving,
  onCancel,
}: {
  readonly cancelLabel: string;
  readonly saveLabel: string;
  readonly saving: boolean;
  readonly onCancel: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background px-5 py-4 shadow-shell">
    <Button type="submit" disabled={saving}>
      {saveLabel}
    </Button>
    <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
      {cancelLabel}
    </Button>
  </div>
);

const FractionDescriptionHint = ({
  count,
  pt,
}: {
  readonly count: number;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => (
  <span className="flex items-center justify-between gap-3">
    <span>{pt('masterData.fractions.createView.fieldHints.description')}</span>
    <span className="shrink-0">{pt('masterData.fractions.createView.meta.descriptionCounter', { count })}</span>
  </span>
);

const FractionBasicsFields = ({
  form,
  submitAttempted,
  errors,
  onChange,
  pt,
}: {
  readonly form: FractionFormState;
  readonly submitAttempted: boolean;
  readonly errors: FractionFormErrors;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => (
  <StudioFieldGroup>
    <StudioField
      id="waste-fraction-name"
      label={pt('masterData.fractions.fields.name')}
      description={pt('masterData.fractions.createView.fieldHints.name')}
      error={submitAttempted ? errors.name : undefined}
      required
    >
      <Input
        id="waste-fraction-name"
        value={form.name}
        aria-invalid={submitAttempted && errors.name ? 'true' : undefined}
        onChange={(event) => onChange({ name: event.target.value })}
      />
    </StudioField>
    <StudioField
      id="waste-fraction-description"
      label={pt('masterData.fractions.fields.description')}
      description={<FractionDescriptionHint count={form.description.length} pt={pt} />}
    >
      <Textarea
        id="waste-fraction-description"
        value={form.description}
        rows={4}
        maxLength={300}
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </StudioField>
    <StudioField
      id="waste-fraction-pdf-short-label"
      label={pt('masterData.fractions.fields.pdfShortLabel')}
      description={pt('masterData.fractions.createView.fieldHints.pdfShortLabel')}
      error={submitAttempted ? errors.pdfShortLabel : undefined}
      required
    >
      <Input
        id="waste-fraction-pdf-short-label"
        value={form.pdfShortLabel}
        maxLength={12}
        aria-invalid={submitAttempted && errors.pdfShortLabel ? 'true' : undefined}
        onChange={(event) => onChange({ pdfShortLabel: event.target.value })}
      />
    </StudioField>
    <StudioField
      id="waste-fraction-container-size"
      label={pt('masterData.fractions.fields.containerSize')}
      description={pt('masterData.fractions.createView.fieldHints.containerSize')}
    >
      <Input
        id="waste-fraction-container-size"
        value={form.containerSize}
        onChange={(event) => onChange({ containerSize: event.target.value })}
      />
    </StudioField>
  </StudioFieldGroup>
);

export const FractionBasicsSection = ({
  form,
  submitAttempted,
  errors,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly submitAttempted: boolean;
  readonly errors: FractionFormErrors;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.basics')}
      description={pt('masterData.fractions.createView.sections.basicsHint')}
    >
      <FractionBasicsFields form={form} submitAttempted={submitAttempted} errors={errors} onChange={onChange} pt={pt} />
    </FractionSection>
  );
};

export const FractionPresentationSection = ({
  form,
  submitAttempted,
  errors,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly submitAttempted: boolean;
  readonly errors: FractionFormErrors;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.presentation')}
      description={pt('masterData.fractions.createView.sections.presentationHint')}
    >
      <StudioFieldGroup>
        <StudioField
          id="waste-fraction-color-text"
          label={pt('masterData.fractions.fields.color')}
          description={pt('masterData.fractions.createView.fieldHints.color')}
          error={submitAttempted ? errors.color : undefined}
          required
        >
          <div className="flex items-center gap-3">
            <Input
              id="waste-fraction-color-picker"
              type="color"
              value={isHexColor(form.color) ? normalizeColor(form.color) : '#4f6d7a'}
              className="h-11 w-14 p-1"
              aria-label={pt('masterData.fractions.createView.colorPickerLabel')}
              onChange={(event) => onChange({ color: event.target.value })}
            />
            <Input
              id="waste-fraction-color-text"
              value={form.color}
              aria-invalid={submitAttempted && errors.color ? 'true' : undefined}
              onChange={(event) => onChange({ color: event.target.value })}
            />
          </div>
        </StudioField>
      </StudioFieldGroup>
    </FractionSection>
  );
};

export const FractionVisibilitySection = ({
  form,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.visibility')}
      description={pt('masterData.fractions.createView.sections.visibilityHint')}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <WasteManagementFormSwitch
            checked={form.active}
            ariaLabel={pt('masterData.fractions.fields.active')}
            onChange={(active) => onChange({ active })}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{form.active ? pt('common.active') : pt('common.inactive')}</p>
            <p className="text-xs text-muted-foreground">
              {form.active ? pt('masterData.fractions.createView.statusHints.active') : pt('masterData.fractions.createView.statusHints.inactive')}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{pt('masterData.fractions.createView.fieldHints.active')}</p>
      </div>
    </FractionSection>
  );
};
