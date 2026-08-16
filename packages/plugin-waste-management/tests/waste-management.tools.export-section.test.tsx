import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
  wasteManagementDataProfiles: [
    { profileId: 'waste-management.fraktionen' },
    { profileId: 'waste-management.touren' },
  ],
}));

import { WasteToolsExportSection } from '../src/waste-management.tools.export-section.js';

afterEach(cleanup);

describe('WasteToolsExportSection', () => {
  it('starts individual JSON exports and switches multi-profile selections to ZIP', () => {
    const onStartExport = vi.fn(async () => null);
    render(<WasteToolsExportSection running={false} onStartExport={onStartExport} />);

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.startExport' }));
    expect(onStartExport).toHaveBeenLastCalledWith({
      profileIds: ['waste-management.fraktionen'],
      targetFormat: 'application/json',
    });

    fireEvent.click(screen.getByLabelText('tools.exports.profiles.tours'));
    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.startExport' }));
    expect(onStartExport).toHaveBeenLastCalledWith({
      profileIds: ['waste-management.fraktionen', 'waste-management.touren'],
      targetFormat: 'application/zip',
    });
  });

  it('blocks an export without a selected profile', () => {
    render(<WasteToolsExportSection running={false} onStartExport={vi.fn(async () => null)} />);
    fireEvent.click(screen.getByLabelText('tools.exports.profiles.fractions'));
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'tools.actions.startExport' }).disabled
    ).toBe(true);
  });
});
