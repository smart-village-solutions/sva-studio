import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type {
  WasteAnnualTourTransferCreateInput,
  WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import type { WasteAnnualTourTransferInternalTourPreview } from './waste-management-annual-tour-transfer.internal.js';
import { sortWasteAnnualItems } from './waste-management-annual-tour-transfer.sort.js';

const sourceFingerprintState = (
  tours: readonly WasteTourRecord[],
  source: WasteAnnualTourTransferSource
) => {
  const ids = new Set(tours.map((tour) => tour.id));
  const relevant = <T extends { readonly id: string; readonly tourId: string }>(items: readonly T[]) =>
    sortWasteAnnualItems(items.filter((item) => ids.has(item.tourId)), (item) => item.id);
  return {
    tours: sortWasteAnnualItems(tours, (tour) => tour.id),
    locationTourLinks: relevant(source.locationTourLinks),
    locationTourPickupDates: relevant(source.locationTourPickupDates),
    tourAssignments: relevant(source.tourAssignments),
    tourDateShifts: relevant(source.tourDateShifts),
  };
};

export const buildWasteAnnualTourTransferPreviewFingerprint = async (input: {
  instanceId: string;
  sourceYear: number;
  targetYear: number;
  selectedTourIds: ReadonlySet<string>;
  replacementDates: WasteAnnualTourTransferCreateInput['replacementDates'];
  firstTargetDates?: WasteAnnualTourTransferCreateInput['firstTargetDates'];
  relevantTours: readonly WasteTourRecord[];
  source: WasteAnnualTourTransferSource;
  previews: readonly WasteAnnualTourTransferInternalTourPreview[];
}): Promise<string> =>
  buildWasteAnnualTourTransferFingerprint({
    instanceId: input.instanceId,
    sourceYear: input.sourceYear,
    targetYear: input.targetYear,
    selectedTourIds: [...input.selectedTourIds].sort((left, right) => left.localeCompare(right)),
    replacementDates: sortWasteAnnualItems(input.replacementDates, (item) => item.sourceResourceId),
    firstTargetDates: sortWasteAnnualItems(input.firstTargetDates ?? [], (item) => item.sourceTourId),
    sourceState: sourceFingerprintState(input.relevantTours, input.source),
    tours: input.previews.map((item) => ({
      ...item,
      conflicts: sortWasteAnnualItems(item.conflicts, (conflict) => `${conflict.kind}:${conflict.targetTourId}`),
    })),
  });

export const stableWasteAnnualSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableWasteAnnualSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableWasteAnnualSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const sha256 = async (value: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const buildWasteAnnualTourTransferFingerprint = async (value: unknown): Promise<string> =>
  `sha256:${await sha256(stableWasteAnnualSerialize(value))}`;

const toStableUuid = (hash: string): string => {
  const chars = hash.slice(0, 32).split('');
  chars[12] = '5';
  chars[16] = ((Number.parseInt(chars[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const compact = chars.join('');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`;
};

export const deriveWasteAnnualTourTransferId = async (
  ...parts: readonly string[]
): Promise<string> => toStableUuid(await sha256(parts.join('\u001f')));
