import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioActionMenu, StudioDetailTabs, StudioSection } from './studio-surfaces.js';

describe('studio-surfaces', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the legacy detail tabs surface with descriptions and switches panels', () => {
    const tabs = [
      {
        id: 'general',
        label: 'Allgemein',
        description: 'Allgemeine Beschreibung',
        content: <div>Allgemeiner Inhalt</div>,
      },
      {
        id: 'history',
        label: 'Historie',
        content: <div>Historieninhalt</div>,
      },
    ] as const;

    const { rerender } = render(<StudioDetailTabs ariaLabel="Legacy-Bereiche" value="general" tabs={tabs} />);

    expect(screen.getByRole('tablist', { name: 'Legacy-Bereiche' })).toBeTruthy();
    expect(screen.getByText('Allgemeine Beschreibung')).toBeTruthy();
    expect(screen.getByText('Allgemeiner Inhalt')).toBeTruthy();

    rerender(<StudioDetailTabs ariaLabel="Legacy-Bereiche" value="history" tabs={tabs} />);

    expect(screen.getByText('Historieninhalt')).toBeTruthy();
    expect(screen.queryByText('Allgemeine Beschreibung')).toBeNull();
  });

  it('renders section headers only when metadata exists and supports rendered action menu items', () => {
    const onSelect = vi.fn();

    const { rerender } = render(
      <StudioSection>
        <div>Nur Inhalt</div>
      </StudioSection>
    );

    expect(screen.getByText('Nur Inhalt')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    rerender(
      <>
        <StudioSection title="Metadaten" description="Sektion mit Aktionen" actions={<button type="button">Mehr</button>}>
          <div>Inhalt mit Kopf</div>
        </StudioSection>
        <StudioActionMenu
          items={[
            {
              id: 'custom',
              label: 'Ignoriert',
              render: <span>Eigene Aktion</span>,
            },
            {
              id: 'delete',
              label: 'Löschen',
              onSelect,
            },
          ]}
        />
      </>
    );

    expect(screen.getByRole('heading', { name: 'Metadaten' })).toBeTruthy();
    expect(screen.getByText('Sektion mit Aktionen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mehr' })).toBeTruthy();
    expect(screen.getByText('Eigene Aktion')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
