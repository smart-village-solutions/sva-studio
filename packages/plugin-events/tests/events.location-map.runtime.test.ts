import { describe, expect, it, vi } from 'vitest';

import { createEventLocationMapRuntimeLoader } from '../src/events.location-map.runtime.js';
import type { EventMapLibreModule } from '../src/events.location-map.runtime.js';

describe('createEventLocationMapRuntimeLoader', () => {
  it('fails fast when the browser runtime is unavailable', async () => {
    const loadCss = vi.fn();
    const loadRuntime = vi.fn();
    const load = createEventLocationMapRuntimeLoader({
      hasWindow: () => false,
      loadCss,
      loadRuntime,
    });

    await expect(load()).rejects.toThrow('map_runtime_unavailable');
    expect(loadCss).not.toHaveBeenCalled();
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it('loads css and runtime once for concurrent calls', async () => {
    const runtime = { Marker: class Marker {}, Map: class Map {} } as unknown as EventMapLibreModule;
    const loadCss = vi.fn(async () => undefined);
    const loadRuntime = vi.fn(async () => runtime);
    const load = createEventLocationMapRuntimeLoader({
      hasWindow: () => true,
      loadCss,
      loadRuntime,
    });

    await expect(Promise.all([load(), load()])).resolves.toEqual([runtime, runtime]);
    await expect(load()).resolves.toBe(runtime);
    expect(loadCss).toHaveBeenCalledTimes(1);
    expect(loadRuntime).toHaveBeenCalledTimes(1);
  });

  it('retries css imports after failed attempts', async () => {
    const runtime = { Marker: class Marker {}, Map: class Map {} } as unknown as EventMapLibreModule;
    const loadCss = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('css failed'))
      .mockResolvedValue(undefined);
    const loadRuntime = vi.fn<() => Promise<EventMapLibreModule>>().mockResolvedValue(runtime);
    const load = createEventLocationMapRuntimeLoader({
      hasWindow: () => true,
      loadCss,
      loadRuntime,
    });

    await expect(load()).rejects.toThrow('css failed');
    await expect(load()).resolves.toBe(runtime);
    expect(loadCss).toHaveBeenCalledTimes(2);
    expect(loadRuntime).toHaveBeenCalledTimes(1);
  });

  it('retries runtime imports after failed attempts', async () => {
    const runtime = { Marker: class Marker {}, Map: class Map {} } as unknown as EventMapLibreModule;
    const loadCss = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    const loadRuntime = vi
      .fn<() => Promise<EventMapLibreModule>>()
      .mockRejectedValueOnce(new Error('runtime failed'))
      .mockResolvedValue(runtime);
    const load = createEventLocationMapRuntimeLoader({
      hasWindow: () => true,
      loadCss,
      loadRuntime,
    });

    await expect(load()).rejects.toThrow('runtime failed');
    await expect(load()).resolves.toBe(runtime);
    expect(loadCss).toHaveBeenCalledTimes(1);
    expect(loadRuntime).toHaveBeenCalledTimes(2);
  });
});
