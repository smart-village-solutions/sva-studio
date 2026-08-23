import type { WasteAnnualTourTransferTourPreview } from '@sva/plugin-sdk';

type Translate = (key: string, values?: Record<string, string | number>) => string;

const classificationKey = (classification: WasteAnnualTourTransferTourPreview['classification']) =>
  classification === 'transferable'
    ? 'tours.annualTransfer.transferable'
    : classification === 'already-effective'
      ? 'tours.annualTransfer.alreadyEffective'
      : 'tours.annualTransfer.blocked';

const weekdayKeys = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const formatAnnualDate = (value: string, translate: Translate): string => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${value} (${translate(`tours.annualTransfer.weekdays.${weekdayKeys[parsed.getUTCDay()]}`)})`;
};

const blockedReasonKey = (reason: WasteAnnualTourTransferTourPreview['reasonCode']): string => {
  if (reason === 'invalid_planning_data') return 'invalidPlanningData';
  if (reason === 'replacement_date_required') return 'replacementDateRequired';
  if (reason === 'target_date_collision') return 'targetDateCollision';
  if (reason === 'target_identity_conflict') return 'targetIdentityConflict';
  return 'unknown';
};

const conflictFeatures = (tour: WasteAnnualTourTransferTourPreview, translate: Translate): string =>
  [
    ...new Set(
      tour.conflicts.flatMap((conflict) =>
        conflict.matchingFeatures.map((feature) =>
          translate(`tours.annualTransfer.conflictFeatures.${feature}`)
        )
      )
    ),
  ].join(', ');

const formatPeriod = (
  period: Readonly<{ firstDate: string; endDate?: string }>,
  translate: Translate
): string =>
  `${formatAnnualDate(period.firstDate, translate)}${
    period.endDate ? ` – ${formatAnnualDate(period.endDate, translate)}` : ''
  }`;

export const AnnualTourDetails = ({
  tour,
  translate,
}: Readonly<{
  tour: WasteAnnualTourTransferTourPreview;
  translate: Translate;
}>) => (
  <>
    <h3 className="font-semibold">{tour.name}</h3>
    <p className="text-sm font-medium">{translate(classificationKey(tour.classification))}</p>
    {tour.classification === 'already-effective' ? (
      <p className="text-sm text-muted-foreground">
        {translate('tours.annualTransfer.alreadyEffectiveReason')}
      </p>
    ) : null}
    {tour.classification === 'blocked' ? (
      <p className="text-sm text-muted-foreground">
        {translate(`tours.annualTransfer.blockedReasons.${blockedReasonKey(tour.reasonCode)}`)}
      </p>
    ) : null}
    <p className="text-sm text-muted-foreground">
      {translate('tours.annualTransfer.recurrence', {
        value: translate(`tours.recurrence.${tour.recurrence ?? 'onDemand'}`),
      })}
    </p>
    <p className="text-sm text-muted-foreground">
      {translate('tours.annualTransfer.tourCounts', {
        wasteFractions: tour.relationshipCounts.wasteFractions,
        customDates: tour.relationshipCounts.customDates ?? 0,
        locations: tour.relationshipCounts.locations,
        pickupDates: tour.relationshipCounts.pickupDates,
        assignments: tour.relationshipCounts.assignments,
        shifts: tour.relationshipCounts.shifts,
        excluded: tour.relationshipCounts.excluded,
      })}
    </p>
    {tour.sourcePeriod?.firstDate && tour.targetPeriod?.firstDate ? (
      <p className="text-sm text-muted-foreground">
        {translate('tours.annualTransfer.period', {
          source: formatPeriod(
            { firstDate: tour.sourcePeriod.firstDate, endDate: tour.sourcePeriod.endDate },
            translate
          ),
          target: formatPeriod(
            { firstDate: tour.targetPeriod.firstDate, endDate: tour.targetPeriod.endDate },
            translate
          ),
        })}
      </p>
    ) : null}
    {tour.sourcePeriod?.firstDate && tour.firstTargetDate ? (
      <p className="text-sm text-muted-foreground">
        {translate('tours.annualTransfer.dateExample', {
          source: formatAnnualDate(tour.sourcePeriod.firstDate, translate),
          target: formatAnnualDate(tour.firstTargetDate, translate),
        })}
      </p>
    ) : null}
    {tour.conflicts.length > 0 ? (
      <p className="text-sm text-muted-foreground">
        {translate('tours.annualTransfer.conflictDetails', {
          features: conflictFeatures(tour, translate),
        })}
      </p>
    ) : null}
  </>
);
