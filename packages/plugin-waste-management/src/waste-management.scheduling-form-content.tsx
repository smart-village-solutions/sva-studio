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
    };

export const WasteSchedulingFormContent = (props: WasteSchedulingFormContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const copy = resolveWasteSchedulingFormCopy(props.variant, props.mode);
  const saveLabel = props.saving
    ? pt(copy.savingKey)
    : pt(copy.submitKey);

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.saving}>
        {pt(copy.cancelKey)}
      </Button>
      <Button type="submit" form="waste-scheduling-form" disabled={props.saving}>
        {saveLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title={pt(copy.titleKey)}
        description={pt(copy.descriptionKey)}
        actions={topActions}
      />

      <form id="waste-scheduling-form" className="space-y-6" onSubmit={(event) => void props.onSubmit(event)}>
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
          <Button type="submit" disabled={props.saving}>
            {saveLabel}
          </Button>
          <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.saving}>
            {pt(copy.cancelKey)}
          </Button>
        </div>
      </form>
    </div>
  );
};
