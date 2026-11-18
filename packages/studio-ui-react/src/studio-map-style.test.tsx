import * as React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapstickResourcePath } from '@sva/core';
import { StudioMapStyleControl, useStudioMapStyle } from './studio-map-style.js';
const base = `${mapstickResourcePath}/styles/osm-bright/style.json`;
const keyA = 'sva:map-style:tenant-a:user-a';
const keyB = 'sva:map-style:tenant-a:user-b';
beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('map style choice', () => {
  it('persists only a valid choice and isolates accounts', () => {
    const { result, unmount } = renderHook(() => useStudioMapStyle(base, keyA));
    act(() => result.current.chooseStyle('fiord-color'));
    expect(result.current.styleUrl).toBe(`${mapstickResourcePath}/styles/fiord-color/style.json`);
    expect(window.localStorage.getItem('sva:map-style:tenant-a:user-a')).toBe('fiord-color');
    act(() => result.current.chooseStyle('https://evil.example'));
    expect(result.current.styleUrl).toContain('/fiord-color/');
    unmount();
    const restored = renderHook(({ storageKey }) => useStudioMapStyle(base, storageKey), {
      initialProps: { storageKey: keyA },
    });
    expect(restored.result.current.styleUrl).toContain('/fiord-color/');
    restored.rerender({ storageKey: keyB });
    expect(restored.result.current.styleUrl).toBe(base);
  });
  it('keeps selection usable when storage is blocked and leaves custom providers unchanged', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useStudioMapStyle(base, keyA));
    act(() => result.current.chooseStyle('maptiler-basic'));
    expect(result.current.styleUrl).toContain('/maptiler-basic/');
    const custom = renderHook(() => useStudioMapStyle('https://custom.example/style.json', keyA));
    act(() => custom.result.current.chooseStyle('fiord-color'));
    expect(custom.result.current.styleUrl).toBe('https://custom.example/style.json');
  });
  it('exposes a named native selector and returns focus to the trigger on Escape', async () => {
    const change = vi.fn();
    render(
      <StudioMapStyleControl styleUrl={base} onChange={change} t={(key) => `shared.${key}`} />
    );
    const trigger = screen.getByRole('button', { name: 'shared.studioMap.chooseStyle' });
    fireEvent.click(trigger);
    const select = screen.getByRole('combobox', { name: 'shared.studioMap.chooseStyle' });
    expect(screen.getAllByRole('option')).toHaveLength(5);
    fireEvent.change(select, { target: { value: 'fiord-color' } });
    expect(change).toHaveBeenCalledWith('fiord-color');
    fireEvent.keyDown(select, { key: 'Escape' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(trigger);
  });
});
