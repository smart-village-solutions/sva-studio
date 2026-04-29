import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaReferenceField } from './index.js';

describe('MediaReferenceField', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders available assets and notifies selection changes', () => {
    const onChange = vi.fn();

    render(
      <MediaReferenceField
        id="teaser-image"
        label="Teaserbild"
        value="asset-2"
        options={[
          { assetId: 'asset-1', label: 'Titelbild' },
          { assetId: 'asset-2', label: 'Headerbild' },
        ]}
        onChange={onChange}
      />
    );

    const select = screen.getByLabelText('Teaserbild');
    expect(select).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Titelbild' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Headerbild' })).toBeTruthy();

    fireEvent.change(select, { target: { value: 'asset-1' } });
    expect(onChange).toHaveBeenCalledWith('asset-1');
  });

  it('supports clearing an existing selection', () => {
    const onChange = vi.fn();

    render(
      <MediaReferenceField
        id="hero-image"
        label="Hero"
        value="asset-1"
        options={[{ assetId: 'asset-1', label: 'Hero Bild' }]}
        onChange={onChange}
        clearLabel="Auswahl entfernen"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Auswahl entfernen' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
