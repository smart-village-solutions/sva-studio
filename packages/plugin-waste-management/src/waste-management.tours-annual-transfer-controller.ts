import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/plugin-sdk';

import {
  createWasteAnnualTourTransfer,
  previewWasteAnnualTourTransfer,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export type AnnualTransferStep = 'source' | 'preview' | 'confirm' | 'result';
export const wasteAnnualCurrentYear = () => new Date().getUTCFullYear();
type ControllerOptions = Readonly<{
  open: boolean;
  onCreated: () => Promise<void>;
  translate: (key: string) => string;
}>;
type LoadOptions = Readonly<{ preserveError?: boolean; nextStep?: 'preview' | 'confirm' }>;

const useAnnualTransferState = () => {
  const summaryRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<AnnualTransferStep>('source');
  const [sourceYear, setSourceYear] = useState(wasteAnnualCurrentYear());
  const [preview, setPreview] = useState<WasteAnnualTourTransferPreview | null>(null);
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const [acknowledgedConflictTourIds, setAcknowledgedConflictTourIds] = useState<readonly string[]>(
    []
  );
  const [replacementDates, setReplacementDates] = useState<Readonly<Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WasteAnnualTourTransferResult | null>(null);
  return {
    summaryRef,
    step,
    setStep,
    sourceYear,
    setSourceYear,
    preview,
    setPreview,
    selectedTourIds,
    setSelectedTourIds,
    acknowledgedConflictTourIds,
    setAcknowledgedConflictTourIds,
    replacementDates,
    setReplacementDates,
    loading,
    setLoading,
    error,
    setError,
    result,
    setResult,
  };
};

type AnnualTransferState = ReturnType<typeof useAnnualTransferState>;

const resetAnnualTransfer = (state: AnnualTransferState) => {
  state.setStep('source');
  state.setSourceYear(wasteAnnualCurrentYear());
  state.setPreview(null);
  state.setSelectedTourIds([]);
  state.setAcknowledgedConflictTourIds([]);
  state.setReplacementDates({});
  state.setLoading(false);
  state.setError(null);
  state.setResult(null);
};

const loadAnnualPreview = async (input: {
  state: AnnualTransferState;
  replacementInput: readonly { sourceResourceId: string; targetDate: string }[];
  options: ControllerOptions;
  load?: LoadOptions;
}) => {
  const { state, replacementInput, options, load = {} } = input;
  state.setLoading(true);
  if (!load.preserveError) state.setError(null);
  try {
    const next = await previewWasteAnnualTourTransfer({
      sourceYear: state.sourceYear,
      selectedTourIds: state.preview ? state.selectedTourIds : undefined,
      replacementDates: replacementInput,
    });
    const selectable = next.tours
      .filter((tour) => tour.classification === 'transferable')
      .map((tour) => tour.sourceTourId);
    const selected = state.preview
      ? state.selectedTourIds.filter((id) => selectable.includes(id))
      : next.tours
          .filter((tour) => tour.classification === 'transferable' && tour.conflicts.length === 0)
          .map((tour) => tour.sourceTourId);
    state.setPreview(next);
    state.setSelectedTourIds(selected);
    state.setAcknowledgedConflictTourIds((current) =>
      current.filter((id) => selected.includes(id))
    );
    state.setStep(load.nextStep ?? 'preview');
    requestAnimationFrame(() => state.summaryRef.current?.focus());
  } catch {
    state.setError(options.translate('tours.annualTransfer.previewError'));
  } finally {
    state.setLoading(false);
  }
};

const createAnnualTransfer = async (input: {
  state: AnnualTransferState;
  replacementInput: readonly { sourceResourceId: string; targetDate: string }[];
  options: ControllerOptions;
  reload: (load?: LoadOptions) => Promise<void>;
}) => {
  const { state, replacementInput, options } = input;
  if (!state.preview) return;
  state.setLoading(true);
  state.setError(null);
  try {
    const created = await createWasteAnnualTourTransfer(
      {
        sourceYear: state.sourceYear,
        selectedTourIds: state.selectedTourIds,
        replacementDates: replacementInput,
        acknowledgedConflictTourIds: state.acknowledgedConflictTourIds,
        previewFingerprint: state.preview.previewFingerprint,
      },
      crypto.randomUUID()
    );
    state.setResult(created);
    state.setStep('result');
    await options.onCreated();
  } catch (error) {
    if (resolveApiErrorCode(error) === 'preview_stale') {
      await input.reload({ preserveError: true });
      state.setError(options.translate('tours.annualTransfer.stale'));
    } else state.setError(options.translate('tours.annualTransfer.createError'));
  } finally {
    state.setLoading(false);
    requestAnimationFrame(() => state.summaryRef.current?.focus());
  }
};

export const useWasteAnnualTransferController = (options: ControllerOptions) => {
  const state = useAnnualTransferState();
  useEffect(() => {
    if (options.open) resetAnnualTransfer(state);
  }, [options.open]);
  const replacementInput = useMemo(
    () =>
      Object.entries(state.replacementDates)
        .filter(([, date]) => date.length > 0)
        .map(([sourceResourceId, targetDate]) => ({ sourceResourceId, targetDate })),
    [state.replacementDates]
  );
  const loadPreview = (load?: LoadOptions) =>
    loadAnnualPreview({ state, replacementInput, options, load });
  const createTransfer = () =>
    createAnnualTransfer({ state, replacementInput, options, reload: loadPreview });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.step === 'source') void loadPreview();
    else if (state.step === 'preview') void loadPreview({ nextStep: 'confirm' });
    else if (state.step === 'confirm') void createTransfer();
  };
  const unacknowledgedConflict =
    state.preview?.tours.some(
      (tour) =>
        state.selectedTourIds.includes(tour.sourceTourId) &&
        tour.conflicts.length > 0 &&
        !state.acknowledgedConflictTourIds.includes(tour.sourceTourId)
    ) ?? false;
  return { ...state, replacementInput, submit, loadPreview, unacknowledgedConflict } as const;
};

export type WasteAnnualTransferController = ReturnType<typeof useWasteAnnualTransferController>;
