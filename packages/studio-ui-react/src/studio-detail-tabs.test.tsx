import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioDetailTabs } from './studio-detail-tabs.js';

describe('StudioDetailTabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('lets a panel own its heading and context-bound actions without adding a duplicate heading', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Bereiche"
        tabs={[
          {
            id: 'tours',
            label: 'Touren',
            title: null,
            panel: (
              <section>
                <h2>Touren bearbeiten</h2>
                <button type="button">Neue Tour</button>
              </section>
            ),
          },
        ]}
      />
    );
    expect(screen.getByRole('heading', { name: 'Touren bearbeiten' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Touren', exact: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Neue Tour' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Touren' })).toBeTruthy();
  });

  it('renders an accessible tablist with mobile select fallback and desktop triggers', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        mobileSelectLabel="Bereich auswählen"
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
        ]}
      />
    );

    expect(screen.getByRole('tablist', { name: 'Detailbereiche' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Inhalte' })).toBeTruthy();

    const select = screen.getByRole('combobox', { name: 'Bereich auswählen' });
    fireEvent.change(select, { target: { value: 'content' } });

    expect(screen.getByRole('tab', { name: 'Inhalte' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Inhalte Panel')).toBeTruthy();
  });

  it('renders a decorative icon without changing the accessible tab label', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[{ id: 'base', label: 'Basis', icon: 'basis', panel: <p>Basis Panel</p> }]}
      />
    );

    const tab = screen.getByRole('tab', { name: 'Basis' });
    expect(tab.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('option').getAttribute('label')).toBe('Basis');
  });

  it('supports keyboard-only tab switching and moves focus to the selected trigger', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
        ]}
      />
    );

    const contentTab = screen.getByRole('tab', { name: 'Inhalte' });
    contentTab.focus();
    fireEvent.keyDown(contentTab, { key: 'Enter' });

    expect(contentTab.getAttribute('data-state')).toBe('active');
    expect(document.activeElement).toBe(contentTab);
    expect(screen.getByText('Inhalte Panel')).toBeTruthy();
  });

  it('switches the active tab and focus on repeated arrow keys', async () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
        ]}
      />
    );

    const baseTab = screen.getByRole('tab', { name: 'Basis' });

    baseTab.focus();
    expect(document.activeElement).toBe(baseTab);
    fireEvent.keyDown(baseTab, { key: 'ArrowRight' });
    const contentTab = screen.getByRole('tab', { name: 'Inhalte' });
    await waitFor(() => expect(document.activeElement).toBe(contentTab));
    expect(contentTab.getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Inhalte Panel')).toBeTruthy();
    fireEvent.keyDown(contentTab, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement).toBe(baseTab));
    expect(baseTab.getAttribute('data-state')).toBe('active');
  });

  it('supports reverse and boundary keyboard navigation across enabled tabs', async () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'disabled', label: 'Deaktiviert', disabled: true, panel: <p>Disabled Panel</p> },
          { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    const baseTab = screen.getByRole('tab', { name: 'Basis' });
    baseTab.focus();
    fireEvent.keyDown(baseTab, { key: 'End' });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Historie' }))
    );
    expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('data-state')).toBe('active');

    const historyTab = screen.getByRole('tab', { name: 'Historie' });
    fireEvent.keyDown(historyTab, { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Inhalte' }))
    );
    expect(screen.getByRole('tab', { name: 'Inhalte' }).getAttribute('data-state')).toBe('active');

    const contentTab = screen.getByRole('tab', { name: 'Inhalte' });
    fireEvent.keyDown(contentTab, { key: 'Home' });
    await waitFor(() => expect(document.activeElement).toBe(baseTab));
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
  });

  it('switches tabs on pointer clicks inside a form without submitting it', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const onValueChange = vi.fn<(value: 'base' | 'content') => void>();

    render(
      <form onSubmit={onSubmit}>
        <StudioDetailTabs
          ariaLabel="Detailbereiche"
          onValueChange={onValueChange}
          tabs={[
            { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
            { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
          ]}
        />
      </form>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Inhalte' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('content');
    expect(screen.getByRole('tab', { name: 'Inhalte' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Inhalte Panel')).toBeTruthy();
  });

  it('filters out tabs that are not visible', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'release', label: 'Freigabe', isVisible: false, panel: <p>Freigabe Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Freigabe' })).toBeNull();
    expect(screen.queryByText('Freigabe Panel')).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('keeps visited panels mounted when keepMounted is enabled', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        keepMounted
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), {
      target: { value: 'history' },
    });

    expect(screen.getByText('Basis Panel')).toBeTruthy();
    expect(screen.getByText('Historie Panel')).toBeTruthy();
  });

  it('does not preload unvisited panels on hover by default', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        keepMounted
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <input aria-label="Notiz" /> },
        ]}
      />
    );
    fireEvent.mouseEnter(screen.getByRole('tab', { name: 'Historie' }));
    expect(screen.queryByRole('textbox', { name: 'Notiz', hidden: true })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
  });

  it('preloads on hover without activation and preserves the same panel and input on repeated intent', () => {
    const onValueChange = vi.fn();
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        keepMounted
        preloadOnIntent
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <input aria-label="Notiz" /> },
        ]}
        onValueChange={onValueChange}
      />
    );
    const historyTab = screen.getByRole('tab', { name: 'Historie' });
    fireEvent.mouseEnter(historyTab);
    const input = screen.getByRole('textbox', { name: 'Notiz', hidden: true });
    fireEvent.change(input, { target: { value: 'Entwurf behalten' } });
    fireEvent.mouseEnter(historyTab);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'history' } });
    expect(screen.getByRole('textbox', { name: 'Notiz' })).toBe(input);
    expect((input as HTMLInputElement).value).toBe('Entwurf behalten');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'base' } });
    expect(screen.getByRole('textbox', { name: 'Notiz', hidden: true })).toBe(input);
  });

  it('preserves automatic focus activation and never preloads disabled or hidden panels', () => {
    const onValueChange = vi.fn();
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        keepMounted
        preloadOnIntent
        onValueChange={onValueChange}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
          { id: 'disabled', label: 'Gesperrt', disabled: true, panel: <p>Gesperrtes Panel</p> },
          { id: 'hidden', label: 'Versteckt', isVisible: false, panel: <p>Verstecktes Panel</p> },
        ]}
      />
    );
    fireEvent.mouseEnter(screen.getByRole('tab', { name: 'Gesperrt' }));
    fireEvent.focus(screen.getByRole('tab', { name: 'Gesperrt' }));
    expect(screen.queryByText('Gesperrtes Panel')).toBeNull();
    expect(screen.queryByText('Verstecktes Panel')).toBeNull();
    fireEvent.focus(screen.getByRole('tab', { name: 'Historie' }));
    expect(onValueChange).toHaveBeenCalledWith('history');
    expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('data-state')).toBe('active');
  });

  it('does not keep the previous panel mounted when keepMounted is disabled', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), {
      target: { value: 'history' },
    });

    expect(screen.queryByText('Basis Panel')).toBeNull();
    expect(screen.getByText('Historie Panel')).toBeTruthy();
  });

  it('shows tab-level change markers from hasChanges without using color as the only signal', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          {
            id: 'base',
            label: 'Basis',
            hasChanges: true,
            changeLabel: 'Unsaved',
            panel: <p>Basis Panel</p>,
          },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: /Basis.*Unsaved/i })).toBeTruthy();
    expect(screen.getAllByRole('option')[0].getAttribute('label')).toBe('Basis (Unsaved)');
  });

  it('renders panel header title, description, and actions slot', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          {
            id: 'release',
            label: 'Freigabe',
            description: 'Steuert den Veröffentlichungsstatus.',
            actions: <button type="button">Veröffentlichen</button>,
            panel: <p>Freigabe Panel</p>,
          },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Freigabe' })).toBeTruthy();
    expect(screen.getByText('Steuert den Veröffentlichungsstatus.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Veröffentlichen' })).toBeTruthy();
    expect(screen.getByText('Freigabe Panel')).toBeTruthy();
    expect(screen.getByRole('tablist').className).toContain('overflow-x-auto');
    expect(screen.getByRole('tablist').className).toContain('gap-0');
    expect(screen.getByRole('heading', { name: 'Freigabe' }).className).toContain('text-base');
    expect(screen.getByText('Steuert den Veröffentlichungsstatus.').className).toContain(
      'leading-relaxed'
    );
    expect(screen.getByRole('tabpanel').firstElementChild?.className).toContain('bg-surface-inset');
  });

  it('announces blocked tab switches through an accessible status surface', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        onBeforeTabChange={() => 'Bitte zuerst speichern.'}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), {
      target: { value: 'content' },
    });

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Bitte zuerst speichern.');
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
  });

  it('keeps a blocked keyboard switch on the current panel and announces the reason', async () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        onBeforeTabChange={() => 'Bitte zuerst speichern.'}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
        ]}
      />
    );
    const baseTab = screen.getByRole('tab', { name: 'Basis' });
    baseTab.focus();
    expect(document.activeElement).toBe(baseTab);
    fireEvent.keyDown(baseTab, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Inhalte' }))
    );
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Basis Panel')).toBeTruthy();
    expect(screen.queryByText('Inhalte Panel')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Bitte zuerst speichern.');
  });

  it('keeps a controlled value authoritative until the parent rerenders', () => {
    const onValueChange = vi.fn<(value: 'base' | 'history') => void>();

    const { rerender } = render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        value="base"
        onValueChange={onValueChange}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), {
      target: { value: 'history' },
    });

    expect(onValueChange).toHaveBeenCalledWith('history');
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
    expect(screen.queryByText('Historie Panel')).toBeNull();

    rerender(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        value="history"
        onValueChange={onValueChange}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Historie Panel')).toBeTruthy();
  });

  it('passes the typed tab id to onValueChange on allowed switches', () => {
    const onValueChange = vi.fn<(value: 'base' | 'history') => void>();

    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        onValueChange={onValueChange}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), {
      target: { value: 'history' },
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('history');
  });

  it('does not trigger a state change or onValueChange for disabled tabs', () => {
    const onValueChange = vi.fn<(value: 'base' | 'history') => void>();

    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        onValueChange={onValueChange}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', disabled: true, panel: <p>Historie Panel</p> },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), {
      target: { value: 'history' },
    });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
    expect(screen.queryByText('Historie Panel')).toBeNull();
  });

  it('ignores keyboard navigation events on disabled tab triggers', () => {
    const onValueChange = vi.fn<(value: 'base' | 'history') => void>();

    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        onValueChange={onValueChange}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', disabled: true, panel: <p>Historie Panel</p> },
        ]}
      />
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Historie' }), { key: 'ArrowLeft' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
    expect(screen.queryByText('Historie Panel')).toBeNull();
  });

  it('shows the configured blocked-switch fallback message when onBeforeTabChange returns false', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        blockedTabChangeMessage="Save changes before leaving this tab."
        onBeforeTabChange={() => false}
        tabs={[
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), {
      target: { value: 'history' },
    });

    expect(screen.getByRole('status').textContent).toContain(
      'Save changes before leaving this tab.'
    );
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
    expect(screen.queryByText('Historie Panel')).toBeNull();
  });

  it('supports legacy tab descriptors with content, dirtyLabel, and react-node labels', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        tabs={[
          {
            id: 'legacy',
            label: <span>Legacy Label</span>,
            description: <span>Legacy Beschreibung</span>,
            isDirty: true,
            dirtyLabel: 'Ungespeichert',
            content: <p>Legacy Panel</p>,
          },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: /Legacy Label.*Ungespeichert/i })).toBeTruthy();
    expect(screen.getByText('Legacy Beschreibung')).toBeTruthy();
    expect(screen.getByText('Legacy Panel')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Legacy Label' })).toBeNull();
    expect(screen.getAllByRole('option')[0].getAttribute('label')).toBe('legacy (Ungespeichert)');
  });

  it('falls back to the first visible tab when the provided default value is not renderable', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        defaultValue="release"
        tabs={[
          { id: 'release', label: 'Freigabe', isVisible: false, panel: <p>Freigabe Panel</p> },
          { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
          { id: 'history', label: 'Historie', panel: <p>Historie Panel</p> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Basis Panel')).toBeTruthy();
    expect(screen.queryByText('Freigabe Panel')).toBeNull();
  });
});
