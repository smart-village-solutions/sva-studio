/** Selection and impact details used only by the existing single-fraction deletion dialog. */
import type {
  WasteFractionDeleteMode,
  WasteFractionDeletePreview,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Select } from '@sva/studio-ui-react';

type ContentProps = {
  preview: WasteFractionDeletePreview | null;
  mode: WasteFractionDeleteMode | '';
  targetFractionId: string;
  pending: boolean;
  loading: boolean;
  source: string;
  onMode: (mode: WasteFractionDeleteMode | '') => void;
  onTarget: (id: string) => void;
  onRefresh: () => void;
};

const DeletionChoices = ({
  preview,
  mode,
  pending,
  loading,
  targetFractionId,
  onMode,
  onTarget,
}: ContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      {preview?.tours.length !== 0 ? (
        <label className="flex flex-col gap-2">
          <span>{pt('masterData.fractions.deleteOptions.mode')}</span>
          <Select
            value={mode}
            disabled={pending || loading}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === '' ||
                value === 'detach' ||
                value === 'delete-tours' ||
                value === 'replace'
              )
                onMode(value);
            }}
          >
            <option value="">{pt('masterData.fractions.deleteOptions.choose')}</option>
            {preview?.canDetach ? (
              <option value="detach">{pt('masterData.fractions.deleteOptions.detach')}</option>
            ) : null}
            <option value="delete-tours">
              {pt('masterData.fractions.deleteOptions.delete-tours')}
            </option>
            {preview?.targets.length ? (
              <option value="replace">{pt('masterData.fractions.deleteOptions.replace')}</option>
            ) : null}
          </Select>
        </label>
      ) : null}
      {mode === 'replace' ? (
        <label className="flex flex-col gap-2">
          <span>{pt('masterData.fractions.deleteOptions.target')}</span>
          <Select
            value={targetFractionId}
            disabled={pending || loading}
            onChange={(event) => onTarget(event.target.value)}
          >
            <option value="">{pt('masterData.fractions.deleteOptions.chooseTarget')}</option>
            {preview?.targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
    </>
  );
};

const DeletionTours = ({
  preview,
  mode,
}: {
  preview: WasteFractionDeletePreview;
  mode: ContentProps['mode'];
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <ul className="space-y-1">
      {preview.tours.map((tour) => (
        <li key={tour.id}>
          {pt('masterData.fractions.deleteOptions.tour', {
            name: tour.name,
            status: pt(`tours.status.${tour.status}`),
          })}
          {tour.otherFractions.length ? (
            <p
              className={
                mode === 'delete-tours' ? 'font-medium text-destructive' : 'text-muted-foreground'
              }
            >
              {pt('masterData.fractions.deleteOptions.shared', {
                fractions: tour.otherFractions.join(', '),
              })}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const DeletionConflicts = ({ preview }: { preview: WasteFractionDeletePreview }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <ul className="space-y-1">
      {preview.conflicts.map((conflict) => (
        <li key={`${conflict.tourIds.join('-')}-${conflict.locationId}-${conflict.pickupDate}`}>
          {pt('masterData.fractions.deleteOptions.conflict', {
            tours: (
              conflict.tourNames ??
              conflict.tourIds.map((id) => preview.tours.find((tour) => tour.id === id)?.name ?? id)
            ).join(', '),
            location: conflict.locationLabel ?? conflict.locationId,
            date: conflict.pickupDate,
          })}
        </li>
      ))}
    </ul>
  );
};

const DeletionImpact = ({
  preview,
  mode,
  source,
  targetFractionId,
}: ContentProps & { preview: WasteFractionDeletePreview }) => {
  const pt = usePluginTranslation('wasteManagement');
  const target = preview.targets.find((item) => item.id === targetFractionId)?.name ?? '';
  return (
    <section aria-label={pt('masterData.fractions.deleteOptions.impact')} className="space-y-3">
      {mode ? (
        <p className="font-medium">
          {pt(`masterData.fractions.deleteOptions.summary.${mode}`, { source, target })}
        </p>
      ) : null}
      <p>{pt('masterData.fractions.deleteOptions.tourCount', { count: preview.tours.length })}</p>
      <DeletionTours preview={preview} mode={mode} />
      <p>
        {pt(
          mode === 'delete-tours'
            ? 'masterData.fractions.deleteOptions.removeDates'
            : 'masterData.fractions.deleteOptions.keepDates'
        )}
      </p>
      <dl className="grid grid-cols-2 gap-2">
        {Object.entries(preview.counts).map(([key, value]) => (
          <div key={key}>
            <dt className="text-muted-foreground">
              {pt(`masterData.fractions.deleteOptions.counts.${key}`)}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>{pt('masterData.fractions.deleteOptions.reminders')}</p>
      {preview.blockedReason && mode !== '' && (mode !== 'replace' || targetFractionId) ? (
        <p role="alert" className="text-destructive">
          {pt(`masterData.fractions.deleteOptions.blocked.${preview.blockedReason}`)}
        </p>
      ) : null}
      <DeletionConflicts preview={preview} />
    </section>
  );
};

export const FractionDeletionContent = (props: ContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm" aria-busy={props.loading}>
      <DeletionChoices {...props} />
      {props.loading ? (
        <p role="status">{pt('masterData.fractions.deleteOptions.loading')}</p>
      ) : null}
      {props.preview ? <DeletionImpact {...props} preview={props.preview} /> : null}
      <Button
        type="button"
        variant="secondary"
        disabled={props.pending || props.loading}
        onClick={props.onRefresh}
      >
        {pt('masterData.fractions.deleteOptions.refresh')}
      </Button>
    </div>
  );
};
