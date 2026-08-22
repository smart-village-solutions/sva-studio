import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const animeState = vi.hoisted(() => ({
  cleanupContentAssembly: vi.fn(),
  cleanupWorkbench: vi.fn(),
  startContentAssemblyAnimation: vi.fn(),
  startWorkbenchAnimation: vi.fn(),
}));

vi.mock('./studio-motion.anime.js', () => ({
  startContentAssemblyAnimation: animeState.startContentAssemblyAnimation,
  startWorkbenchAnimation: animeState.startWorkbenchAnimation,
}));

import { StudioAnimatedLoadingState, StudioWorkbenchScene } from './studio-motion.js';

const installMatchMedia = (reducedMotion: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('Studio motion components', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMatchMedia(false);
    animeState.cleanupContentAssembly.mockReset();
    animeState.cleanupWorkbench.mockReset();
    animeState.startContentAssemblyAnimation.mockReset();
    animeState.startWorkbenchAnimation.mockReset();
    animeState.startContentAssemblyAnimation.mockReturnValue(animeState.cleanupContentAssembly);
    animeState.startWorkbenchAnimation.mockReturnValue(animeState.cleanupWorkbench);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders an accessible loading status while keeping the artwork decorative', () => {
    render(<StudioAnimatedLoadingState>Inhalt wird geladen …</StudioAnimatedLoadingState>);

    expect(screen.getByRole('status').textContent).toContain('Inhalt wird geladen …');
    expect(screen.getByTestId('studio-content-assembly').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('starts the loading animation only after the short entry delay and cleans it up', async () => {
    const view = render(
      <StudioAnimatedLoadingState entryDelayMs={120}>
        Inhalt wird geladen …
      </StudioAnimatedLoadingState>
    );

    expect(animeState.startContentAssemblyAnimation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(119);
    });
    expect(animeState.startContentAssemblyAnimation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(animeState.startContentAssemblyAnimation).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(animeState.cleanupContentAssembly).toHaveBeenCalledTimes(1);
  });

  it('does not start a delayed loading animation after unmount', async () => {
    const view = render(
      <StudioAnimatedLoadingState entryDelayMs={1_000}>
        Inhalt wird geladen …
      </StudioAnimatedLoadingState>
    );

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(animeState.startContentAssemblyAnimation).not.toHaveBeenCalled();
  });

  it('keeps reduced-motion loading artwork static without starting Anime.js', async () => {
    installMatchMedia(true);
    render(<StudioAnimatedLoadingState>Inhalt wird geladen …</StudioAnimatedLoadingState>);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(animeState.startContentAssemblyAnimation).not.toHaveBeenCalled();
    expect(screen.getByTestId('studio-content-assembly').getAttribute('data-motion')).toBe(
      'reduced'
    );
  });

  it('keeps workbench content immediately interactive while the full scene animates', async () => {
    const onClick = vi.fn();
    render(
      <StudioWorkbenchScene mode="full" scene="authenticated">
        <button data-studio-workbench-module type="button" onClick={onClick}>
          Nachricht erstellen
        </button>
      </StudioWorkbenchScene>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nachricht erstellen' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(animeState.startWorkbenchAnimation).toHaveBeenCalledWith(expect.any(HTMLElement), {
      mode: 'full',
      scene: 'authenticated',
    });
  });

  it('cleans up a compact workbench animation on unmount', async () => {
    const view = render(
      <StudioWorkbenchScene mode="compact" scene="anonymous">
        <p>Willkommen</p>
      </StudioWorkbenchScene>
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    view.unmount();

    expect(animeState.cleanupWorkbench).toHaveBeenCalledTimes(1);
  });
});
