import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsContentOpeningHours } from './generic-items.content-schedule-openinghours.js';
import { GenericItemsContentDates } from './generic-items.content-schedule-dates.js';

export const GenericItemsContentSchedule = ({
  labels,
}: Readonly<{ labels: Record<string, string> }>) => (
  <GenericItemsDetailCard title={labels.scheduleTitle} description={labels.scheduleDescription}>
    <GenericItemsContentOpeningHours labels={labels} />
    <GenericItemsContentDates labels={labels} />
  </GenericItemsDetailCard>
);
