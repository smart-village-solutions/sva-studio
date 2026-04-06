import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioListPageTemplate } from './StudioListPageTemplate';

afterEach(() => {
  cleanup();
});

describe('StudioListPageTemplate', () => {
  it('renders header content and optional primary action', () => {
    const onClick = vi.fn();

    render(
      <StudioListPageTemplate
        title="Abholorte"
        description="Hierarchische Verwaltung der Abholorte."
        primaryAction={{ label: 'Neu erstellen', onClick }}
      >
        <div>Tabelleninhalt</div>
      </StudioListPageTemplate>
    );

    expect(screen.getByRole('heading', { name: 'Abholorte' })).toBeTruthy();
    expect(screen.getByText('Hierarchische Verwaltung der Abholorte.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Neu erstellen' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tabelleninhalt')).toBeTruthy();
  });

  it('renders tabbed content when tabs are configured', () => {
    render(
      <StudioListPageTemplate
        title="Abfallkalender"
        tabs={[
          { id: 'pickup', label: 'Abholorte', content: <div>Abholorte-Inhalt</div> },
          { id: 'dates', label: 'Ausweichtermine', content: <div>Ausweichtermine-Inhalt</div> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: 'Abholorte' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Abholorte-Inhalt')).toBeTruthy();

    expect(screen.getByRole('tab', { name: 'Ausweichtermine' }).getAttribute('data-state')).toBe('inactive');
  });
});
