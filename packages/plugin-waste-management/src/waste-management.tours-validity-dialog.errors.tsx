import { usePluginTranslation } from '@sva/plugin-sdk';

export type InvalidValidityRange = Readonly<{
  tourId: string;
  tourName: string;
  firstDate: string;
  endDate: string;
}>;

export const InvalidValidityRanges = ({
  ranges,
}: Readonly<{ ranges: readonly InvalidValidityRange[] }>) => {
  const pt = usePluginTranslation('wasteManagement');
  if (ranges.length === 0) return null;
  return (
    <div className="text-sm text-destructive" role="alert">
      <p className="font-semibold">{pt('tours.bulkValidityDialog.invalidRangeTitle')}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {ranges.map((range) => (
          <li key={range.tourId}>
            {pt('tours.bulkValidityDialog.invalidRangeItem', {
              name: range.tourName,
              firstDate: range.firstDate,
              endDate: range.endDate,
            })}
          </li>
        ))}
      </ul>
    </div>
  );
};
