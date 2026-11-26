import { useRef, useState } from 'react';
import type {
  WasteLocationTourLinkRecord,
  WasteTourMergePreview,
  WasteTourMergeResult,
  WasteTourRecord,
} from '@sva/waste-management-contracts';

import { mergeWasteManagementTours } from './waste-management.api.operations.tours.js';
import { WasteManagementApiError } from './waste-management.api.shared.js';

type MergeSuccess = Extract<WasteTourMergeResult, { kind: 'merged' }>;
type MergeIssue = 'stale' | 'rolled-back' | 'unknown' | 'load' | 'forbidden' | 'missing';

export type MergeDialogProps = {
  tours: readonly WasteTourRecord[];
  filteredTours: readonly WasteTourRecord[];
  locationLinks?: readonly WasteLocationTourLinkRecord[];
  onClose: () => void;
  onRestoreFocus: () => void;
  onMerged: (name: string, result: MergeSuccess) => Promise<void>;
};

const getMergeIssue = (error: unknown, confirming: boolean): MergeIssue => {
  if (error instanceof WasteManagementApiError) {
    if (error.code === 'forbidden') return 'forbidden';
    if (error.code === 'not_found') return 'missing';
  }
  return confirming ? 'unknown' : 'load';
};

const initialSelection = ({ tours, filteredTours, locationLinks }: MergeDialogProps) => {
  const visible = new Set(filteredTours.map((tour) => tour.id));
  const hidden = new Set(tours.filter((tour) => !visible.has(tour.id)).map((tour) => tour.id));
  if (!locationLinks) return { tours, hidden };

  const pointsByTour = new Map<string, Set<string>>();
  for (const link of locationLinks) {
    const ids = pointsByTour.get(link.tourId) ?? new Set<string>();
    ids.add(link.locationId);
    pointsByTour.set(link.tourId, ids);
  }
  return {
    hidden,
    tours: tours.map((tour) => ({ ...tour, locationCount: pointsByTour.get(tour.id)?.size ?? 0 })),
  };
};

export const useWasteTourMergeController = (props: MergeDialogProps) => {
  const [initial] = useState(() => initialSelection(props));
  const [targetId, setTargetId] = useState<string>();
  const [preview, setPreview] = useState<WasteTourMergePreview>();
  const [issue, setIssue] = useState<MergeIssue>();
  const [activity, setActivity] = useState<'preview' | 'submit'>();
  const saving = useRef(false);
  const requestGeneration = useRef(0);
  const verifiedTours = new Map(preview?.tours.map((tour) => [tour.id, tour]));
  const options = initial.tours.map((tour) => verifiedTours.get(tour.id) ?? tour);
  const target = options.find((tour) => tour.id === targetId);
  const conflicts = preview?.conflicts ?? [];

  const request = async (id: string, confirmationToken?: string) => {
    if (saving.current) return;
    const confirming = confirmationToken !== undefined;
    const generation = ++requestGeneration.current;
    saving.current = confirming;
    setActivity(confirming ? 'submit' : 'preview');
    setIssue(undefined);
    if (!confirming) setPreview(undefined);
    try {
      const result = await mergeWasteManagementTours({
        tourIds: initial.tours.map((tour) => tour.id),
        targetTourId: id,
        confirmationToken,
      });
      if (generation !== requestGeneration.current) return;
      if (result.kind === 'preview') setPreview(result.preview);
      else if (result.kind === 'merged') await props.onMerged(target?.name ?? id, result);
      else setIssue(result.kind);
    } catch (error) {
      if (generation === requestGeneration.current) setIssue(getMergeIssue(error, confirming));
    } finally {
      if (generation === requestGeneration.current) {
        saving.current = false;
        setActivity(undefined);
      }
    }
  };

  const select = (id: string) => {
    if (saving.current) return;
    setTargetId(id);
    void request(id);
  };
  const close = () => {
    if (saving.current) return;
    requestGeneration.current++;
    props.onClose();
  };
  return {
    activity,
    options,
    target,
    conflicts,
    issue,
    preview,
    hidden: initial.hidden,
    select,
    close,
    request,
  };
};
