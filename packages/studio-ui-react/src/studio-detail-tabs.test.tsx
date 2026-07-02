import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioDetailTabs } from './studio-detail-tabs.js';

describe('StudioDetailTabs', () => {
  afterEach(() => {
    cleanup();
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

  it('switches the active tab when arrow-key roving focus changes the Radix value', () => {
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

    fireEvent.keyDown(baseTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Inhalte' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Inhalte Panel')).toBeTruthy();
  });

  it('supports reverse and boundary keyboard navigation across enabled tabs', () => {
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
    fireEvent.keyDown(baseTab, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('data-state')).toBe('active');

    const historyTab = screen.getByRole('tab', { name: 'Historie' });
    fireEvent.keyDown(historyTab, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Inhalte' }).getAttribute('data-state')).toBe('active');

    const contentTab = screen.getByRole('tab', { name: 'Inhalte' });
    fireEvent.keyDown(contentTab, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
  });

  it('switches tabs on pointer clicks inside a form without submitting it', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <StudioDetailTabs
          ariaLabel="Detailbereiche"
          tabs={[
            { id: 'base', label: 'Basis', panel: <p>Basis Panel</p> },
            { id: 'content', label: 'Inhalte', panel: <p>Inhalte Panel</p> },
          ]}
        />
      </form>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Inhalte' }));

    expect(onSubmit).not.toHaveBeenCalled();
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), { target: { value: 'history' } });

    expect(screen.getByText('Basis Panel')).toBeTruthy();
    expect(screen.getByText('Historie Panel')).toBeTruthy();
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), { target: { value: 'history' } });

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
    expect(screen.getByRole('tablist').className).toContain('ml-[10px]');
    expect(screen.getByRole('tablist').className).toContain('gap-10');
    expect(screen.getByRole('heading', { name: 'Freigabe' }).className).toContain('text-base');
    expect(screen.getByText('Steuert den Veröffentlichungsstatus.').className).toContain('leading-relaxed');
    expect(screen.getByRole('tabpanel').firstElementChild?.className).toContain('bg-[rgb(var(--waste-panel-surface))]');
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), { target: { value: 'content' } });

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Bitte zuerst speichern.');
    expect(screen.getByRole('tab', { name: 'Basis' }).getAttribute('data-state')).toBe('active');
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), { target: { value: 'history' } });

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

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), { target: { value: 'history' } });

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

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), { target: { value: 'history' } });

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

    fireEvent.change(screen.getByRole('combobox', { name: 'Detailbereiche' }), { target: { value: 'history' } });

    expect(screen.getByRole('status').textContent).toContain('Save changes before leaving this tab.');
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
