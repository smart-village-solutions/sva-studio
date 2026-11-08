import type { WasteFractionRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioSwitch, type StudioColumnDef } from '@sva/studio-ui-react';

const createFractionIdentityColumn = (
  pt: ReturnType<typeof usePluginTranslation>
): StudioColumnDef<WasteFractionRecord> => ({
  id: 'nameWithContainerSize',
  header: pt('masterData.fractions.table.nameWithContainerSize'),
  mobileLabel: pt('masterData.fractions.table.nameWithContainerSize'),
  sortable: true,
  sortLabel: pt('masterData.fractions.table.nameWithContainerSize'),
  sortValue: (fraction) =>
    `${fraction.name.toLocaleLowerCase()}|${fraction.containerSize?.toLocaleLowerCase() ?? ''}`,
  cell: (fraction) => (
    <p className="font-medium">
      {fraction.containerSize ? `${fraction.name} (${fraction.containerSize})` : fraction.name}
    </p>
  ),
});

const createFractionShortLabelColumn = (
  pt: ReturnType<typeof usePluginTranslation>
): StudioColumnDef<WasteFractionRecord> => ({
  id: 'pdfShortLabel',
  header: pt('masterData.fractions.table.shortLabel'),
  mobileLabel: pt('masterData.fractions.table.shortLabel'),
  cell: (fraction) =>
    fraction.pdfShortLabel ? (
      <span className="font-mono text-sm uppercase">{fraction.pdfShortLabel}</span>
    ) : null,
});

const createFractionColorColumn = (
  pt: ReturnType<typeof usePluginTranslation>
): StudioColumnDef<WasteFractionRecord> => ({
  id: 'color',
  header: pt('masterData.fractions.table.color'),
  mobileLabel: pt('masterData.fractions.table.color'),
  sortable: true,
  sortLabel: pt('masterData.fractions.table.color'),
  sortValue: (fraction) => fraction.color.toLocaleLowerCase(),
  cell: (fraction) => (
    <div className="flex items-center gap-2">
      <span
        role="img"
        aria-label={pt('masterData.fractions.table.colorSwatch', { value: fraction.color })}
        className="inline-block h-6 w-6 shrink-0 rounded-sm border border-border/70"
        style={{ backgroundColor: fraction.color }}
      />
      <span className="font-mono text-sm">{fraction.color}</span>
    </div>
  ),
});

const createFractionDescriptionColumn = (
  pt: ReturnType<typeof usePluginTranslation>
): StudioColumnDef<WasteFractionRecord> => ({
  id: 'description',
  header: pt('masterData.fractions.fields.description'),
  mobileLabel: pt('masterData.fractions.fields.description'),
  sortable: true,
  sortLabel: pt('masterData.fractions.fields.description'),
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
  readonly onToggleFractionStatus: (
    fraction: WasteFractionRecord,
    active: boolean
  ) => void | Promise<void>;
}): StudioColumnDef<WasteFractionRecord> => ({
  id: 'status',
  header: pt('masterData.fractions.table.status'),
  mobileLabel: pt('masterData.fractions.table.status'),
  sortable: true,
  sortLabel: pt('masterData.fractions.table.status'),
  sortValue: (fraction) => (fraction.active ? 'active' : 'inactive'),
  cell: (fraction) => (
    <div className="flex items-center justify-center">
      <StudioSwitch
        checked={fraction.active}
        aria-label={pt('masterData.fractions.actions.toggleStatus', { value: fraction.name })}
        disabled={saving}
        onCheckedChange={(active) => {
          void onToggleFractionStatus(fraction, active);
        }}
      />
    </div>
  ),
});

export const useFractionColumns = ({
  saving,
  onToggleFractionStatus,
}: {
  readonly saving?: boolean;
  readonly onToggleFractionStatus: (
    fraction: WasteFractionRecord,
    active: boolean
  ) => void | Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return [
    createFractionIdentityColumn(pt),
    createFractionShortLabelColumn(pt),
    createFractionColorColumn(pt),
    createFractionDescriptionColumn(pt),
    createFractionStatusColumn({ pt, saving, onToggleFractionStatus }),
  ] satisfies readonly StudioColumnDef<WasteFractionRecord>[];
};
