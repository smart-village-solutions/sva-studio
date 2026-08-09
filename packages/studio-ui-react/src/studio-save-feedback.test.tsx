import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudioPersistentFormError, StudioSaveButton, useStudioSaveFeedback } from './index.js';

const labels = {
  idle: 'Speichern',
  saving: 'Wird gespeichert…',
  saved: 'Gespeichert',
};

describe('Studio save feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the controlled save states and disables only while saving', () => {
    const { rerender } = render(<StudioSaveButton type="submit" status="idle" labels={labels} />);

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
    button.focus();
    expect(button.disabled).toBe(false);

    rerender(<StudioSaveButton type="submit" status="saving" labels={labels} />);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Wird gespeichert…' }).disabled
    ).toBe(true);

    rerender(<StudioSaveButton type="submit" status="saved" labels={labels} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Gespeichert' }).disabled).toBe(
      false
    );
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('button').querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
  });

  it('returns from saved to idle after two seconds and resets immediately when changed', () => {
    const { result } = renderHook(() => useStudioSaveFeedback());

    act(() => {
      const operationId = result.current.beginSaving();
      result.current.markSaved(operationId);
    });
    expect(result.current.status).toBe('saved');

    act(() => vi.advanceTimersByTime(1_999));
    expect(result.current.status).toBe('saved');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBe('idle');

    act(() => {
      const operationId = result.current.beginSaving();
      result.current.markSaved(operationId);
      result.current.markDirty();
    });
    expect(result.current.status).toBe('idle');
  });

  it('ignores stale request completions', () => {
    const { result } = renderHook(() => useStudioSaveFeedback());
    let staleOperationId = 0;
    let currentOperationId = 0;

    act(() => {
      staleOperationId = result.current.beginSaving();
      currentOperationId = result.current.beginSaving();
      result.current.markSaved(staleOperationId);
    });
    expect(result.current.status).toBe('saving');

    act(() => result.current.markFailed(currentOperationId));
    expect(result.current.status).toBe('idle');
  });

  it('cleans up a pending success timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useStudioSaveFeedback());

    act(() => {
      const operationId = result.current.beginSaving();
      result.current.markSaved(operationId);
    });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('keeps a technical error visible and offers an explicit retry', () => {
    const onRetry = vi.fn();
    render(
      <StudioPersistentFormError
        title="Speichern fehlgeschlagen"
        message="Der Server ist nicht erreichbar."
        retryLabel="Erneut versuchen"
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('Der Server ist nicht erreichbar.');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
