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
    expect(button.getAttribute('aria-label')).toBe('Speichern');
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

  it('supports caller-disabled buttons and non-text labels without inventing an accessible name', () => {
    render(
      <StudioSaveButton
        type="submit"
        status="idle"
        disabled
        className="custom-save-button"
        labels={{ ...labels, idle: <span>Formular sichern</span> }}
      />
    );

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Formular sichern' });
    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.className).toContain('custom-save-button');
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

  it('supports initial, explicit, reset, and unchanged feedback transitions', () => {
    const { result } = renderHook(() => useStudioSaveFeedback(true));
    expect(result.current.status).toBe('saved');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');

    act(() => result.current.showSaved());
    expect(result.current.status).toBe('saved');

    act(() => result.current.markDirty());
    expect(result.current.status).toBe('idle');

    act(() => result.current.markDirty());
    expect(result.current.status).toBe('idle');

    act(() => {
      const staleOperationId = result.current.beginSaving();
      result.current.reset();
      result.current.markFailed(staleOperationId);
    });
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
        details={<p>Request-ID: request-1</p>}
        retryLabel="Erneut versuchen"
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('Der Server ist nicht erreichbar.');
    expect(screen.getByRole('alert').textContent).toContain('Request-ID: request-1');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders compact errors and keeps a disabled retry action visible', () => {
    const { rerender } = render(<StudioPersistentFormError message="Speichern fehlgeschlagen." />);

    expect(screen.getByRole('alert').textContent).toContain('Speichern fehlgeschlagen.');
    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <StudioPersistentFormError
        message="Speichern fehlgeschlagen."
        retryLabel="Erneut versuchen"
        onRetry={vi.fn()}
        retryDisabled
      />
    );
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Erneut versuchen' }).disabled
    ).toBe(true);
  });
});
