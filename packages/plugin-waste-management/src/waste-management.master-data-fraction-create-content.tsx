import type { FormEvent } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  StudioField,
  StudioFieldGroup,
  StudioPageHeader,
  Textarea,
} from '@sva/studio-ui-react';
import { useMemo, useState } from 'react';

import type { FractionFormState } from './waste-management.master-data.forms.js';

type WasteMasterDataFractionCreateContentProps = {
  readonly mode: 'create' | 'edit';
  readonly form: FractionFormState;
  readonly saving: boolean;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

type FractionFormErrors = {
  readonly name?: string;
  readonly color?: string;
};

const normalizeColor = (value: string) => value.trim().toLowerCase();

const isHexColor = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

const validateFractionForm = (
  form: FractionFormState,
  pt: ReturnType<typeof usePluginTranslation>
): FractionFormErrors => ({
  name: form.name.trim() ? undefined : pt('masterData.fractions.createView.validation.nameRequired'),
  color: isHexColor(form.color) ? undefined : pt('masterData.fractions.createView.validation.colorRequired'),
});

export const WasteMasterDataFractionCreateContent = ({
  mode,
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: WasteMasterDataFractionCreateContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const errors = useMemo(() => validateFractionForm(form, pt), [form, pt]);
  const hasErrors = Boolean(errors.name || errors.color);
  const descriptionLength = form.description.length;
  const title = mode === 'create' ? pt('masterData.fractions.createView.title') : pt('masterData.fractions.dialog.editTitle');
  const description =
    mode === 'create'
      ? pt('masterData.fractions.createView.description')
      : pt('masterData.fractions.dialog.editDescription');

  const saveLabel = saving
    ? pt('masterData.fractions.actions.saving')
    : mode === 'create'
      ? pt('masterData.fractions.createView.actions.savePrimary')
      : pt('masterData.fractions.actions.save');

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        {pt('masterData.fractions.createView.actions.cancel')}
      </Button>
      <Button type="submit" form="waste-fraction-create-form" disabled={saving}>
        {saveLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title={title}
        description={description}
        actions={topActions}
      />

      <form
        id="waste-fraction-create-form"
        className="space-y-6"
        onSubmit={(event) => {
          setSubmitAttempted(true);
          if (hasErrors) {
            event.preventDefault();
            return;
          }
          void onSubmit(event);
        }}
      >
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{pt('masterData.fractions.createView.sections.basics')}</p>
            <p className="text-sm text-muted-foreground">{pt('masterData.fractions.createView.sections.basicsHint')}</p>
          </div>
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
              description={
                <span className="flex items-center justify-between gap-3">
                  <span>{pt('masterData.fractions.createView.fieldHints.description')}</span>
                  <span className="shrink-0">{pt('masterData.fractions.createView.meta.descriptionCounter', { count: descriptionLength })}</span>
                </span>
              }
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
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{pt('masterData.fractions.createView.sections.presentation')}</p>
            <p className="text-sm text-muted-foreground">{pt('masterData.fractions.createView.sections.presentationHint')}</p>
          </div>
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
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{pt('masterData.fractions.createView.sections.visibility')}</p>
            <p className="text-sm text-muted-foreground">{pt('masterData.fractions.createView.sections.visibilityHint')}</p>
          </div>
          <StudioField
            id="waste-fraction-active"
            label={pt('masterData.fractions.fields.active')}
            description={pt('masterData.fractions.createView.fieldHints.active')}
          >
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
              <Checkbox
                id="waste-fraction-active"
                checked={form.active}
                onChange={(event) => onChange({ active: event.currentTarget.checked })}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {form.active ? pt('common.active') : pt('common.inactive')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {form.active
                    ? pt('masterData.fractions.createView.statusHints.active')
                    : pt('masterData.fractions.createView.statusHints.inactive')}
                </p>
              </div>
            </div>
          </StudioField>
        </section>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 shadow-shell">
          <Button type="submit" disabled={saving}>
            {saveLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {pt('masterData.fractions.createView.actions.cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
};
