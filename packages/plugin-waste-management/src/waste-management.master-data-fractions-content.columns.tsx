import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { cn, type StudioColumnDef } from '@sva/studio-ui-react';

const createFractionIdentityColumn = (pt: ReturnType<typeof usePluginTranslation>): StudioColumnDef<WasteFractionRecord> => ({
  id: 'nameWithContainerSize',
  header: pt('masterData.fractions.table.nameWithContainerSize'),
  mobileLabel: pt('masterData.fractions.table.nameWithContainerSize'),
  sortable: true,
  sortValue: (fraction) => `${fraction.name.toLocaleLowerCase()}|${fraction.containerSize?.toLocaleLowerCase() ?? ''}`,
  cell: (fraction) => <p className="font-medium">{fraction.containerSize ? `${fraction.name} (${fraction.containerSize})` : fraction.name}</p>,
});

const createFractionColorColumn = (pt: ReturnType<typeof usePluginTranslation>): StudioColumnDef<WasteFractionRecord> => ({
  id: 'color',
  header: pt('masterData.fractions.table.color'),
  mobileLabel: pt('masterData.fractions.table.color'),
  sortable: true,
  sortValue: (fraction) => fraction.color.toLocaleLowerCase(),
  cell: (fraction) => (
    <div className="flex items-center gap-2">
      <span
        aria-label={pt('masterData.fractions.table.colorSwatch', { value: fraction.color })}
        className="inline-block h-6 w-6 shrink-0 rounded-sm border border-border/70"
        style={{ backgroundColor: fraction.color }}
      />
      <span className="font-mono text-sm">{fraction.color}</span>
    </div>
  ),
});

const createFractionDescriptionColumn = (pt: ReturnType<typeof usePluginTranslation>): StudioColumnDef<WasteFractionRecord> => ({
  id: 'description',
  header: pt('masterData.fractions.fields.description'),
  mobileLabel: pt('masterData.fractions.fields.description'),
  sortable: true,
  sortValue: (fraction) => fraction.description?.toLocaleLowerCase() ?? '',
  cell: (fraction) => (
    <span className={fraction.description ? 'text-sm' : 'text-sm text-muted-foreground'}>
      {fraction.description || pt('masterData.fractions.table.noDescription')}
    </span>
  ),
});

const createFractionStatusColumn = ({
  pt,
  saving,
  onToggleFractionStatus,
}: {
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly saving?: boolean;
  readonly onToggleFractionStatus: (fraction: WasteFractionRecord, active: boolean) => void | Promise<void>;
}): StudioColumnDef<WasteFractionRecord> => ({
  id: 'status',
  header: pt('masterData.fractions.table.status'),
  mobileLabel: pt('masterData.fractions.table.status'),
  sortable: true,
  sortValue: (fraction) => (fraction.active ? 'active' : 'inactive'),
  cell: (fraction) => (
    <div className="flex items-center justify-center">
      <button
        type="button"
        role="switch"
        aria-checked={fraction.active}
        aria-label={
          fraction.active
            ? pt('masterData.fractions.actions.deactivateStatus', { value: fraction.name })
            : pt('masterData.fractions.actions.activateStatus', { value: fraction.name })
        }
        disabled={saving}
        className={cn(
          'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          fraction.active ? 'bg-primary' : 'bg-muted'
        )}
        onClick={() => {
          void onToggleFractionStatus(fraction, !fraction.active);
        }}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform',
            fraction.active ? 'translate-x-[16px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  ),
});

export const useFractionColumns = ({
  saving,
  onToggleFractionStatus,
}: {
  readonly saving?: boolean;
  readonly onToggleFractionStatus: (fraction: WasteFractionRecord, active: boolean) => void | Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return [
    createFractionIdentityColumn(pt),
    createFractionColorColumn(pt),
    createFractionDescriptionColumn(pt),
    createFractionStatusColumn({ pt, saving, onToggleFractionStatus }),
  ] satisfies readonly StudioColumnDef<WasteFractionRecord>[];
};
