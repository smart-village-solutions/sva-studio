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
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(onValueChange).not.toHaveBeenCalled();
  });
  it('provides a readonly presentation without an executable trigger', () => {
    render(<IconPicker {...props} readOnly onValueChange={vi.fn()} />);
    expect(screen.getByRole('textbox').getAttribute('aria-readonly')).toBe('true');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
