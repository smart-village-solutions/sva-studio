import {
  mapDatesToInput,
  mapOpeningHoursToInput,
} from './generic-items.detail-form.write-helpers.js';
import { useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsContentOpeningHours } from './generic-items.content-schedule-openinghours.js';
import { GenericItemsContentDates } from './generic-items.content-schedule-dates.js';

export const GenericItemsContentSchedule = ({
  labels,
  createMode = false,
}: Readonly<{ labels: Record<string, string>; createMode?: boolean }>) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const dates = useWatch({ control, name: 'dates' });
  const openingHours = useWatch({ control, name: 'openingHours' });
  return createMode ? (
    <div className="space-y-4">
      <GenericItemsDetailCard
        title={labels.dates}
        collapsible
        invalid={Boolean(errors.dates)}
        summary={`${labels.optional} (${mapDatesToInput(dates).length})`}
      >
        <GenericItemsContentDates labels={labels} />
      </GenericItemsDetailCard>
      <GenericItemsDetailCard
        title={labels.openingHours}
        collapsible
        invalid={Boolean(errors.openingHours)}
        summary={`${labels.optional} (${mapOpeningHoursToInput(openingHours).length})`}
      >
        <GenericItemsContentOpeningHours labels={labels} />
      </GenericItemsDetailCard>
    </div>
  ) : (
    <GenericItemsDetailCard title={labels.scheduleTitle} description={labels.scheduleDescription}>
      <GenericItemsContentOpeningHours labels={labels} />
      <GenericItemsContentDates labels={labels} />
    </GenericItemsDetailCard>
  );
};
