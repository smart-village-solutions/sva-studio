import { StudioField, Textarea, getStudioFormFieldProps } from '@sva/studio-ui-react';
import { useFormContext } from 'react-hook-form';

import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';

export const GenericItemsDetailSettingsTab = ({
  labels,
}: Readonly<{
  labels: Record<string, string>;
}>) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();

  const payloadField = getStudioFormFieldProps({
    id: 'generic-item-payload',
    error: errors.payloadText,
    hasDescription: true,
  });

  return (
    <div className="space-y-4">
      <GenericItemsDetailCard title={labels.payloadTitle} description={labels.payloadDescription}>
        <StudioField
          {...payloadField}
          label={labels.payload}
          description="Freies JSON-Objekt für plugin-spezifische Zusatzdaten. Dieser Bereich bleibt absichtlich offen."
        >
          <Textarea {...payloadField.controlProps} {...register('payloadText')} className="min-h-40 font-mono" />
        </StudioField>
      </GenericItemsDetailCard>
    </div>
  );
};
