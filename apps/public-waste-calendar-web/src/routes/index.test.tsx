import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PublicWasteIndexPage } from './index.js';

describe('PublicWasteIndexPage', () => {
  beforeEach(() => {
    document.cookie = 'sva_public_waste_location=; Max-Age=0; Path=/';
  });

  it('resolves a location, stores it as a cookie, and restores the selection on the next render', async () => {
    const { unmount } = render(<PublicWasteIndexPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Musterstadt' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Musterstadt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hauptstraße' }));
    fireEvent.click(screen.getByRole('button', { name: '12' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'iCal abonnieren' })).toBeTruthy();
    });

    expect(document.cookie).toContain('sva_public_waste_location=r-1%3Ac-1%3As-1%3Ah-12');
    expect(screen.getByText('Musterstadt, Hauptstraße 12')).toBeTruthy();

    unmount();
    render(<PublicWasteIndexPage />);

    await waitFor(() => {
      expect(screen.getByText('Gespeicherte Adresse geladen. Sie können die Auswahl ändern.')).toBeTruthy();
    });

    expect(screen.getByText('Musterstadt, Hauptstraße 12')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'iCal abonnieren' })).toBeTruthy();
  });
});
