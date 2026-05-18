import type { FormEvent } from 'react';

import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioPageHeader } from '@sva/studio-ui-react';

import { WasteToursTourFields } from './waste-management.tours-tour-fields.js';
import type { TourFormState } from './waste-management.tours.shared.js';

type WasteToursFormContentProps = {
  readonly mode: 'create' | 'edit';
  readonly form: TourFormState;
  readonly fractions: readonly WasteFractionRecord[];
  readonly saving: boolean;
  readonly onChange: (patch: Partial<TourFormState>) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export const WasteToursFormContent = ({
  mode,
  form,
  fractions,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: WasteToursFormContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const saveLabel = saving ? pt('tours.actions.saving') : mode === 'create' ? pt('tours.actions.create') : pt('tours.actions.save');

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        {pt('tours.actions.cancel')}
      </Button>
      <Button type="submit" form="waste-tour-form" disabled={saving}>
        {saveLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title={mode === 'create' ? pt('tours.dialog.createTitle') : pt('tours.dialog.editTitle')}
        description={mode === 'create' ? pt('tours.dialog.createDescription') : pt('tours.dialog.editDescription')}
        actions={topActions}
      />

      <form id="waste-tour-form" className="space-y-6" onSubmit={(event) => void onSubmit(event)}>
        <WasteToursTourFields form={form} fractions={fractions} pt={pt} onChange={onChange} />

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background px-5 py-4 shadow-shell">
          <Button type="submit" disabled={saving}>
            {saveLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {pt('tours.actions.cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
};
