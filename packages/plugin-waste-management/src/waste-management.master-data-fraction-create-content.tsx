import type { FormEvent } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioPageHeader } from '@sva/studio-ui-react';
import { useMemo, useState } from 'react';

import type { FractionFormState } from './waste-management.master-data.forms.js';
import {
  FractionBasicsSection,
  FractionFormActions,
  FractionPresentationSection,
  FractionReminderSection,
  FractionVisibilitySection,
  validateFractionForm,
} from './waste-management.master-data-fraction-create.parts.js';

type WasteMasterDataFractionCreateContentProps = {
  readonly mode: 'create' | 'edit';
  readonly form: FractionFormState;
  readonly saving: boolean;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>, mode?: 'create' | 'edit') => void | Promise<void>;
};

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
  const cancelLabel = pt('masterData.fractions.createView.actions.cancel');

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        {cancelLabel}
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
          void onSubmit(event, mode);
        }}
      >
        <FractionBasicsSection form={form} submitAttempted={submitAttempted} errors={errors} onChange={onChange} />
        <FractionPresentationSection form={form} submitAttempted={submitAttempted} errors={errors} onChange={onChange} />
        <FractionVisibilitySection form={form} onChange={onChange} />
        <FractionReminderSection form={form} onChange={onChange} />
        <FractionFormActions cancelLabel={cancelLabel} saveLabel={saveLabel} saving={saving} onCancel={onCancel} />
      </form>
    </div>
  );
};
