import { Check } from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from './alert.js';
import { Button, type ButtonProps } from './button.js';
import { cn } from './utils.js';

export type StudioSaveStatus = 'idle' | 'saving' | 'saved';

export type StudioSaveButtonLabels = Readonly<{
  idle: React.ReactNode;
  saving: React.ReactNode;
  saved: React.ReactNode;
}>;

export type StudioSaveButtonProps = Omit<ButtonProps, 'children'> &
  Readonly<{
    status: StudioSaveStatus;
    labels: StudioSaveButtonLabels;
  }>;

export function StudioSaveButton({
  status,
  labels,
  className,
  disabled,
  ...props
}: StudioSaveButtonProps) {
  const label =
    status === 'saving' ? labels.saving : status === 'saved' ? labels.saved : labels.idle;

  return (
    <Button
      className={cn('min-w-36', className)}
      disabled={disabled || status === 'saving'}
      {...props}
    >
      <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
        {status === 'saved' ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
        {label}
      </span>
    </Button>
  );
}

export type StudioPersistentFormErrorProps = Readonly<{
  message: React.ReactNode;
  title?: React.ReactNode;
  retryLabel?: React.ReactNode;
  onRetry?: () => void;
  retryDisabled?: boolean;
  className?: string;
}>;

export function StudioPersistentFormError({
  message,
  title,
  retryLabel,
  onRetry,
  retryDisabled = false,
  className,
}: StudioPersistentFormErrorProps) {
  return (
    <Alert className={cn('border-destructive/40 bg-destructive/10 text-destructive', className)}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className={title ? 'mt-2' : undefined}>
        <div className="space-y-3">
          <p>{message}</p>
          {retryLabel && onRetry ? (
            <Button type="button" variant="outline" disabled={retryDisabled} onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export type StudioSaveFeedbackController = Readonly<{
  status: StudioSaveStatus;
  beginSaving: () => number;
  markSaved: (operationId: number) => void;
  markFailed: (operationId: number) => void;
  showSaved: () => void;
  markDirty: () => void;
  reset: () => void;
}>;

const SAVED_STATUS_DURATION_MS = 2_000;

export function useStudioSaveFeedback(initiallySaved = false): StudioSaveFeedbackController {
  const [status, setStatus] = React.useState<StudioSaveStatus>(initiallySaved ? 'saved' : 'idle');
  const operationIdRef = React.useRef(0);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = React.useCallback(() => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (status !== 'saved') {
      return undefined;
    }

    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setStatus('idle');
    }, SAVED_STATUS_DURATION_MS);

    return clearResetTimer;
  }, [clearResetTimer, status]);

  React.useEffect(() => clearResetTimer, [clearResetTimer]);

  const beginSaving = React.useCallback(() => {
    clearResetTimer();
    const operationId = operationIdRef.current + 1;
    operationIdRef.current = operationId;
    setStatus('saving');
    return operationId;
  }, [clearResetTimer]);

  const markSaved = React.useCallback((operationId: number) => {
    if (operationId === operationIdRef.current) {
      setStatus('saved');
    }
  }, []);

  const markFailed = React.useCallback((operationId: number) => {
    if (operationId === operationIdRef.current) {
      setStatus('idle');
    }
  }, []);

  const showSaved = React.useCallback(() => {
    setStatus('saved');
  }, []);

  const markDirty = React.useCallback(() => {
    setStatus((current) => (current === 'saved' ? 'idle' : current));
  }, []);

  const reset = React.useCallback(() => {
    clearResetTimer();
    operationIdRef.current += 1;
    setStatus('idle');
  }, [clearResetTimer]);

  return { status, beginSaving, markSaved, markFailed, showSaved, markDirty, reset };
}
