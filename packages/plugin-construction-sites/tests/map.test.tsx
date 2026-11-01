import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ config: vi.fn(), options: null as unknown }));
vi.mock('@sva/plugin-sdk', () => ({
  getHostMapGeocodingConfig: host.config,
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('@sva/studio-ui-react', () => ({
  useStudioLocationMap: (options: unknown) => {
    host.options = options;
    return { containerRef: { current: null } };
  },
}));
vi.mock('maplibre-gl', () => ({ Map: vi.fn(), Marker: vi.fn() }));
import { ConstructionSiteMap } from '../src/construction-sites.map.js';
type MapOptions = {
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (point: { latitude: string; longitude: string }) => void;
  onError: (code: string) => void;
};
beforeEach(() => {
  host.config.mockReset();
});
afterEach(cleanup);
describe('construction site configured map', () => {
  it('uses the host style and preserves zero coordinates, including readonly behavior', async () => {
    host.config.mockResolvedValue({
      styleUrl: 'https://maps.test/style.json',
      killSwitchEnabled: false,
    });
    const change = vi.fn();
    const { rerender } = render(
      <ConstructionSiteMap latitude={0} longitude={0} onChange={change} />
    );
    await waitFor(() =>
      expect((host.options as MapOptions).styleUrl).toBe('https://maps.test/style.json')
    );
    expect(host.options).toMatchObject({ latitude: '0', longitude: '0' });
    act(() => (host.options as MapOptions).onCoordinatesChange({ latitude: '1', longitude: '2' }));
    expect(change).toHaveBeenCalledWith(1, 2);
    rerender(<ConstructionSiteMap latitude={null} longitude={null} onChange={change} disabled />);
    act(() => (host.options as MapOptions).onCoordinatesChange({ latitude: '3', longitude: '4' }));
    expect(change).toHaveBeenCalledTimes(1);
    expect(host.options).toMatchObject({ latitude: undefined, longitude: undefined });
    act(() => (host.options as MapOptions).onError('failed'));
    expect(screen.getByRole('status').textContent).toBe('messages.mapUnavailable');
  });
  it.each([
    { killSwitchEnabled: true, styleUrl: 'https://maps.test/style.json' },
    { killSwitchEnabled: false, styleUrl: '' },
  ])('falls back to manual coordinates when the map is disabled', async (config) => {
    host.config.mockResolvedValue(config);
    render(<ConstructionSiteMap latitude={null} longitude={null} onChange={vi.fn()} />);
    await screen.findByRole('status');
  });
});
