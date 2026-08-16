import type { FormEvent, ReactNode } from 'react';

import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioPageHeader } from '@sva/studio-ui-react';

import { WasteSchedulingGlobalFields } from './waste-management.scheduling-global-fields.js';
import { resolveWasteSchedulingFormCopy } from './waste-management.scheduling-form.copy.js';
import { WasteSchedulingTourFields } from './waste-management.scheduling-tour-fields.js';
import type {
  GlobalDateShiftFormState,
  TourDateShiftFormState,
} from './waste-management.scheduling.shared.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';

type WasteSchedulingFormContentProps =
  | {
      readonly variant: 'global';
      readonly mode: 'create' | 'edit';
      readonly form: GlobalDateShiftFormState;
      readonly tours: readonly WasteTourRecord[];
      readonly saving: boolean;
      readonly onChange: (patch: Partial<GlobalDateShiftFormState>) => void;
      readonly onCancel: () => void;
      readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
      readonly beforeFields?: ReactNode;
      readonly message?: StatusMessage | null;
    }
  | {
      readonly variant: 'tour';
      readonly mode: 'create' | 'edit';
      readonly form: TourDateShiftFormState;
      readonly tours: readonly WasteTourRecord[];
      readonly saving: boolean;
      readonly onChange: (patch: Partial<TourDateShiftFormState>) => void;
      readonly onCancel: () => void;
      readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
      readonly beforeFields?: ReactNode;
      readonly message?: StatusMessage | null;
    };

export const WasteSchedulingFormContent = (props: WasteSchedulingFormContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const copy = resolveWasteSchedulingFormCopy(props.variant, props.mode);
  const saveLabel = props.saving ? pt(copy.savingKey) : pt(copy.submitKey);

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="secondary" onClick={props.onCancel} disabled={props.saving}>
        {pt(copy.cancelKey)}
      </Button>
      <WastePendingSaveButton
        type="submit"
        form="waste-scheduling-form"
        saving={props.saving}
        label={saveLabel}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title={pt(copy.titleKey)}
        description={pt(copy.descriptionKey)}
        actions={topActions}
      />
      <StatusNotice message={props.message ?? null} />

      <form
        id="waste-scheduling-form"
        className="space-y-6"
        onSubmit={(event) => void props.onSubmit(event)}
      >
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
          {props.beforeFields}
          {props.variant === 'global' ? (
            <WasteSchedulingGlobalFields
              form={props.form}
              tours={props.tours}
              pt={pt}
              onChange={props.onChange}
            />
          ) : (
            <WasteSchedulingTourFields
              form={props.form}
              tours={props.tours}
              pt={pt}
              onChange={props.onChange}
            />
          )}
        </section>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background px-5 py-4 shadow-shell">
          <WastePendingSaveButton type="submit" saving={props.saving} label={saveLabel} />
          <Button
            type="button"
            variant="secondary"
            onClick={props.onCancel}
            disabled={props.saving}
          >
            {pt(copy.cancelKey)}
          </Button>
        </div>
      </form>
    </div>
  );
};
