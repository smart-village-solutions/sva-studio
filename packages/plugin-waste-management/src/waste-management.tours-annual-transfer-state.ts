import { useRef, useState } from 'react';
import type {
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/waste-management-contracts';

export type AnnualTransferStep = 'source' | 'preview' | 'confirm' | 'result';
export const wasteAnnualCurrentYear = () => new Date().getUTCFullYear();

export const useAnnualTransferState = () => {
  const summaryRef = useRef<HTMLDivElement>(null);
  const confirmationRequestRef = useRef<{
    payloadIdentity: string;
    idempotencyKey: string;
  } | null>(null);
  const [step, setStep] = useState<AnnualTransferStep>('source');
  const [sourceYear, setSourceYear] = useState(wasteAnnualCurrentYear());
  const [preview, setPreview] = useState<WasteAnnualTourTransferPreview | null>(null);
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const [acknowledgedConflictTourIds, setAcknowledgedConflictTourIds] = useState<readonly string[]>([]);
  const [replacementDates, setReplacementDates] = useState<Readonly<Record<string, string>>>({});
  const [firstTargetDates, setFirstTargetDates] = useState<Readonly<Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WasteAnnualTourTransferResult | null>(null);
  return {
    summaryRef,
    confirmationRequestRef,
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
    firstTargetDates,
    setFirstTargetDates,
    loading,
    setLoading,
    error,
    setError,
    result,
    setResult,
  };
};

export type AnnualTransferState = ReturnType<typeof useAnnualTransferState>;
