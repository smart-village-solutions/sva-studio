/** Native interaction contract: search/selection, cancellation, readonly, errors. */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { IconPicker } from './icon-picker.js';
vi.mock('./tabler-icon.js', () => ({ TablerIcon: () => null }));
afterEach(cleanup);
const props = {
  id: 'icon',
  value: 'calendar',
  label: 'Icon',
  placeholder: 'Auswählen',
  searchLabel: 'Suchen',
  emptyText: 'Keine Treffer',
  moreLabel: 'Mehr',
};
describe('IconPicker', () => {
  it('searches all names and confirms with Enter', () => {
    const onValueChange = vi.fn();
    render(<IconPicker {...props} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Icon' }));
    const search = screen.getByRole('combobox');
    fireEvent.change(search, { target: { value: 'building-community' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledWith('building-community');
  });
  it('retains the value when dismissed and supports an empty result', () => {
    const onValueChange = vi.fn();
    render(<IconPicker {...props} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Icon' }));
    const search = screen.getByRole('combobox');
    fireEvent.change(search, { target: { value: 'not-an-icon-xyz' } });
    expect(screen.getByRole('status').textContent).toBe('Keine Treffer');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(onValueChange).not.toHaveBeenCalled();
  });
  it('provides a readonly presentation without an executable trigger', () => {
    render(<IconPicker {...props} readOnly onValueChange={vi.fn()} />);
    expect(screen.getByRole('textbox').getAttribute('aria-readonly')).toBe('true');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('navigates the three-column grid, loads more results and restores trigger focus after a pointer selection', () => {
    const onValueChange = vi.fn();
    render(<IconPicker {...props} onValueChange={onValueChange} />);
    const trigger = screen.getByRole('button', { name: 'Icon' });
    fireEvent.click(trigger);
    const search = screen.getByRole('combobox');
    for (const [key, index] of [
      ['ArrowDown', 3],
      ['ArrowUp', 0],
      ['ArrowRight', 1],
      ['ArrowLeft', 0],
      ['ArrowLeft', 0],
    ] as const) {
      fireEvent.keyDown(search, { key });
      expect(search.getAttribute('aria-activedescendant')).toBe(`icon-icon-${index}`);
    }
    expect(screen.getAllByRole('option')).toHaveLength(60);
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    expect(screen.getAllByRole('option')).toHaveLength(120);
    fireEvent.change(search, { target: { value: 'building-community' } });
    expect(screen.queryByRole('button', { name: 'Mehr' })).toBeNull();
    const option = screen.getByRole('option', { name: 'building-community' });
    search.focus();
    expect(fireEvent.mouseDown(option)).toBe(false);
    expect(document.activeElement).toBe(search);
    fireEvent.click(option);
    expect(onValueChange).toHaveBeenCalledWith('building-community');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('exposes errors on a disabled field and closes an open picker when it becomes readonly', () => {
    const onValueChange = vi.fn();
    const view = render(
      <IconPicker {...props} disabled error="Ungültig" hint="Hilfe" onValueChange={onValueChange} />
    );
    const disabled = screen.getByRole('button', { name: 'Icon' });
    expect(disabled.hasAttribute('disabled')).toBe(true);
    expect(disabled.getAttribute('aria-invalid')).toBe('true');
    expect(disabled.getAttribute('aria-describedby')).toBe('icon-error');
    expect(screen.getByRole('alert').textContent).toBe('Ungültig');
    expect(screen.getByText('Hilfe')).toBeTruthy();
    fireEvent.click(disabled);
    expect(screen.queryByRole('combobox')).toBeNull();
    view.rerender(<IconPicker {...props} value="" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Icon' }));
    expect(screen.getByRole('combobox')).toBeTruthy();
    view.rerender(<IconPicker {...props} value="" readOnly onValueChange={onValueChange} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('textbox').textContent).toContain('Auswählen');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
