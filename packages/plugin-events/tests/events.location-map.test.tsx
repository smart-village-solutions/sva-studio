import { render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventMapLibreModule } from '../src/events.location-map.runtime.js';

const state = vi.hoisted(() => ({
  loadRuntime: vi.fn(),
  useLocationMap: vi.fn(),
}));

vi.mock('../src/events.location-map.runtime.js', () => ({
  loadEventLocationMapRuntime: state.loadRuntime,
}));

vi.mock('../src/events.location-map.hook.js', () => ({
  useEventLocationMap: state.useLocationMap,
}));

import { EventsLocationMap } from '../src/events.location-map.js';

const runtime = { Marker: class Marker {}, Map: class Map {} } as unknown as EventMapLibreModule;

describe('EventsLocationMap', () => {
  beforeEach(() => {
    state.loadRuntime.mockReset();
    state.useLocationMap.mockReset();
    state.useLocationMap.mockReturnValue({ containerRef: React.createRef<HTMLDivElement>() });
  });

  it('loads the map runtime and passes it into the location map hook', async () => {
    const onCoordinatesChange = vi.fn();
    const onError = vi.fn();
    state.loadRuntime.mockResolvedValue(runtime);

    render(
      <EventsLocationMap
        styleUrl="https://tiles.example.test/style.json"
        latitude="51.5"
        longitude="7.4"
        onCoordinatesChange={onCoordinatesChange}
        onError={onError}
      />
    );

    expect(state.useLocationMap).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: null,
        styleUrl: 'https://tiles.example.test/style.json',
      })
    );
    await waitFor(() => {
      expect(state.useLocationMap).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime,
          latitude: '51.5',
          longitude: '7.4',
          onCoordinatesChange,
          onError,
        })
      );
    });
  });

  it('reports loader failures only while mounted', async () => {
    const mountedError = vi.fn();
    state.loadRuntime.mockRejectedValueOnce(new Error('boom'));

    render(
      <EventsLocationMap
        styleUrl="https://tiles.example.test/style.json"
        onCoordinatesChange={vi.fn()}
        onError={mountedError}
      />
    );

    await waitFor(() => {
      expect(mountedError).toHaveBeenCalledWith('map_error');
    });

    const unmountedError = vi.fn();
    let rejectRuntime: (error: Error) => void = () => undefined;
    state.loadRuntime.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectRuntime = reject;
      })
    );

    const view = render(
      <EventsLocationMap
        styleUrl="https://tiles.example.test/style.json"
        onCoordinatesChange={vi.fn()}
        onError={unmountedError}
      />
    );
    view.unmount();
    rejectRuntime(new Error('late boom'));

    await Promise.resolve();

    expect(unmountedError).not.toHaveBeenCalled();
  });
});
