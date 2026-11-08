import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTablerIconName, tablerIconExports, tablerIconNames } from './tabler-icon-catalog.js';
beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('./tabler-icon-glyphs.js');
});
afterEach(() => {
  cleanup();
  vi.doUnmock('./tabler-icon-glyphs.js');
  vi.restoreAllMocks();
});
describe('Tabler catalogue and lazy glyph boundary', () => {
  it('resolves every offered outline name to a shipped glyph and rejects prototype keys', async () => {
    const { iconGlyphs } = await import('./tabler-icon-glyphs.js');
    expect(tablerIconNames.length).toBeGreaterThan(1000);
    expect(
      tablerIconNames.every(
        (name) => !name.endsWith('-filled') && Boolean(iconGlyphs[tablerIconExports[name] ?? ''])
      )
    ).toBe(true);
    expect(isTablerIconName('calendar')).toBe(true);
    expect(isTablerIconName('toString')).toBe(false);
    expect(isTablerIconName('not-a-tabler-icon')).toBe(false);
  });
  it('keeps a decorative fallback, ignores stale loads and shares one lazy import', async () => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = vi.fn(async () => {
      await ready;
      return {
        iconGlyphs: {
          IconCalendar: (props: React.SVGProps<SVGSVGElement>) => (
            <svg {...props} data-testid="calendar" />
          ),
          IconClock: (props: React.SVGProps<SVGSVGElement>) => (
            <svg {...props} data-testid="clock" />
          ),
        },
      };
    });
    vi.doMock('./tabler-icon-glyphs.js', load);
    const { TablerIcon } = await import('./tabler-icon.js');
    const view = render(<TablerIcon name="calendar" stroke={1} />);
    expect(view.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    view.rerender(<TablerIcon name="clock" stroke={1} />);
    await act(async () => {
      release();
      await ready;
    });
    const clock = await screen.findByTestId('clock');
    expect(screen.queryByTestId('calendar')).toBeNull();
    expect(clock.getAttribute('stroke')).toBe('2');
    expect(clock.getAttribute('aria-hidden')).toBe('true');
    render(<TablerIcon name="calendar" />);
    await screen.findByTestId('calendar');
    expect(load).toHaveBeenCalledTimes(1);
    view.rerender(<TablerIcon name="not-a-tabler-icon" />);
    expect(view.container.querySelector('[data-testid]')).toBeNull();
    expect(view.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('retains its fallback after an import failure without retrying on a changed name', async () => {
    const load = vi.fn(async () => {
      throw new Error('glyph fixture unavailable');
    });
    vi.doMock('./tabler-icon-glyphs.js', load);
    const { TablerIcon } = await import('./tabler-icon.js');
    const view = render(<TablerIcon name="calendar" />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await expect(load.mock.results[0]?.value).rejects.toThrow('glyph fixture unavailable');
    await act(async () => {
      await Promise.resolve();
    });
    view.rerender(<TablerIcon name="clock" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
