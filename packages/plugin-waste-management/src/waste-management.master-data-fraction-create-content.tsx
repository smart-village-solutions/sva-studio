import type { FormEvent } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioPageHeader } from '@sva/studio-ui-react';
import { useMemo, useState } from 'react';

import type { FractionFormState } from './waste-management.master-data.forms.js';
import {
  FractionBasicsSection,
  FractionFormActions,
  FractionPresentationSection,
  FractionVisibilitySection,
} from './waste-management.master-data-fraction-create.parts.js';
import { FractionReminderSection } from './waste-management.master-data-fraction-reminder-section.js';
import { validateFractionForm } from './waste-management.master-data-fraction-validation.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';

type WasteMasterDataFractionCreateContentProps = {
  readonly mode: 'create' | 'edit';
  readonly form: FractionFormState;
  readonly saving: boolean;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (
    event: FormEvent<HTMLFormElement>,
    mode?: 'create' | 'edit'
  ) => void | Promise<void>;
};

const getFractionCreateCopy = (
  mode: WasteMasterDataFractionCreateContentProps['mode'],
  saving: boolean,
  pt: ReturnType<typeof usePluginTranslation>
) => ({
  title: pt(
    mode === 'create'
      ? 'masterData.fractions.createView.title'
      : 'masterData.fractions.dialog.editTitle'
  ),
  description: pt(
    mode === 'create'
      ? 'masterData.fractions.createView.description'
      : 'masterData.fractions.dialog.editDescription'
  ),
  saveLabel: pt(
    saving
      ? 'masterData.fractions.actions.saving'
      : mode === 'create'
        ? 'masterData.fractions.createView.actions.savePrimary'
        : 'masterData.fractions.actions.save'
  ),
  cancelLabel: pt('masterData.fractions.createView.actions.cancel'),
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
  const hasErrors = Boolean(errors.name || errors.pdfShortLabel || errors.color);
  const { cancelLabel, description, saveLabel, title } = getFractionCreateCopy(mode, saving, pt);

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        {cancelLabel}
      </Button>
      <WastePendingSaveButton
        type="submit"
        form="waste-fraction-create-form"
        saving={saving}
        label={saveLabel}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <StudioPageHeader title={title} description={description} actions={topActions} />

      <form
        id="waste-fraction-create-form"
        className="space-y-6"
        onSubmit={(event) => {
          setSubmitAttempted(true);
          if (hasErrors) {
            event.preventDefault();
            return;
          }
          void onSubmit(event, mode);
        }}
      >
        <FractionBasicsSection
          form={form}
          submitAttempted={submitAttempted}
          errors={errors}
          onChange={onChange}
        />
        <FractionPresentationSection
          form={form}
          submitAttempted={submitAttempted}
          errors={errors}
          onChange={onChange}
        />
        <FractionVisibilitySection form={form} onChange={onChange} />
        <FractionReminderSection form={form} onChange={onChange} />
        <FractionFormActions
          cancelLabel={cancelLabel}
          saveLabel={saveLabel}
          saving={saving}
          onCancel={onCancel}
        />
      </form>
    </div>
  );
};
