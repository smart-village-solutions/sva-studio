import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button, buttonVariants } from './button.js';

describe('Button', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a hover tooltip for icon buttons using the aria-label', () => {
    render(
      <Button type="button" size="icon" aria-label="Suche" tooltip="Suche">
        <span aria-hidden="true">S</span>
      </Button>
    );

    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Suche' }));

    expect(screen.getByRole('tooltip').textContent).toContain('Suche');
  });

  it('shows a hover tooltip for icon links rendered via asChild using the child title', () => {
    render(
      <Button asChild size="icon" type="button" variant="secondary" tooltip="Datensatz bearbeiten">
        <a href="/foo" aria-label="Bearbeiten" title="Datensatz bearbeiten">
          <span aria-hidden="true">B</span>
        </a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Bearbeiten' });

    fireEvent.mouseEnter(link);

    expect(screen.getByRole('tooltip').textContent).toContain('Datensatz bearbeiten');
  });

  it('shows a hover tooltip for icon-only table action buttons that use size sm', () => {
    render(
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        aria-label="Bearbeiten"
        tooltip="Bearbeiten"
        className="h-8 w-8 px-0"
      >
        <svg aria-hidden="true" className="h-4 w-4" />
      </Button>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Bearbeiten' }));

    expect(screen.getByRole('tooltip').textContent).toContain('Bearbeiten');
  });

  it('shows an associated tooltip when an icon button receives keyboard focus', () => {
    render(
      <Button type="button" size="icon" aria-label="Suche" tooltip="Suche">
        <span aria-hidden="true">S</span>
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Suche' });
    fireEvent.focus(button);

    const tooltip = screen.getByRole('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);

    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('preserves an existing description while the tooltip is visible', () => {
    render(
      <>
        <p id="existing-description">Bestehende Beschreibung</p>
        <Button
          type="button"
          size="icon"
          aria-label="Suche"
          aria-describedby="existing-description"
          tooltip="Suche"
        >
          <span aria-hidden="true">S</span>
        </Button>
      </>
    );

    const button = screen.getByRole('button', { name: 'Suche' });
    fireEvent.focus(button);

    expect(button.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'existing-description',
      screen.getByRole('tooltip').id,
    ]);
  });

  it('uses primary as the default and exposes explicit semantic variants', () => {
    expect(buttonVariants()).toContain('bg-action-primary');
    expect(buttonVariants({ variant: 'secondary' })).toContain('bg-action-secondary');
    expect(buttonVariants({ variant: 'tertiary' })).toContain('bg-transparent');
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-action-destructive');
  });

  it('keeps icon and compact buttons at the 44 pixel minimum target size', () => {
    expect(buttonVariants({ size: 'icon' })).toContain('min-h-11');
    expect(buttonVariants({ size: 'icon' })).toContain('min-w-11');
    expect(buttonVariants({ size: 'sm' })).toContain('min-h-11');
    expect(buttonVariants({ size: 'sm' })).toContain('min-w-11');
  });

  it('marks loading buttons busy and prevents activation', () => {
    const onClick = vi.fn();
    render(
      <Button type="button" loading onClick={onClick}>
        Wird gespeichert…
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Wird gespeichert…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(true);

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('removes disabled asChild links from activation and keyboard order', () => {
    const onClick = vi.fn();
    render(
      <Button asChild disabled onClick={onClick}>
        <a href="/geschuetzt">Geschützte Aktion</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Geschützte Aktion' });
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.tabIndex).toBe(-1);
    expect(link.dispatchEvent(clickEvent)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('prevents a disabled asChild link handler before Radix Slot composes it', () => {
    const childOnClick = vi.fn();
    render(
      <Button asChild disabled>
        <a href="/geschuetzt" onClick={childOnClick}>
          Geschützte Aktion
        </a>
      </Button>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Geschützte Aktion' }));

    expect(childOnClick).not.toHaveBeenCalled();
  });
});
