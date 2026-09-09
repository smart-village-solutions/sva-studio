import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatePicker, type DatePickerLabels, type DatePickerProps } from './date-picker.js';

const labels: DatePickerLabels = {
  openCalendar: 'Datum im Kalender auswählen',
  calendar: 'Datum auswählen',
  navigation: 'Kalendernavigation',
  previousMonth: 'Vorheriger Monat',
  nextMonth: 'Nächster Monat',
  formatHint: 'TT.MM.JJJJ',
  today: 'Heute',
  selected: 'Ausgewählt',
  errors: {
    invalid: 'Ungültiges Datum',
    required: 'Datum erforderlich',
    min: 'Datum zu früh',
    max: 'Datum zu spät',
  },
};
afterEach(cleanup);

function Field(props: Partial<DatePickerProps> = {}) {
  const [value, setValue] = useState<string | null>('2026-09-09');
  return (
    <DatePicker
      id="date"
      label="Datum"
      locale="de-DE"
      labels={labels}
      value={value}
      {...props}
      onChange={(next, error) => {
        setValue(next);
        props.onChange?.(next, error);
      }}
    />
  );
}

describe('DatePicker', () => {
  it('preserves partial input and focus; normalizes only after blur', () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '9.' } });
    expect(input.value).toBe('9.');
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText('Ungültiges Datum')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null, 'invalid');
    fireEvent.change(input, { target: { value: '9.9.2026' } });
    expect(input.value).toBe('9.9.2026');
    fireEvent.blur(input);
    expect(input.value).toBe('09.09.2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-09-09', null);
  });

  it('associates validation messages and blocks invalid native form data', () => {
    render(
      <form>
        <Field name="date" />
      </form>
    );
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '31.02.2026' } });
    fireEvent.blur(input);
    expect(input.getAttribute('aria-describedby')).toBe('date-description date-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.checkValidity()).toBe(false);
    if (!input.form) throw new Error('Missing form');
    expect(new FormData(input.form).get('date')).toBe('');
    fireEvent.change(input, { target: { value: '' } });
    expect(input.checkValidity()).toBe(true);
  });

  it('navigates months without selecting or closing; selects explicitly', async () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: labels.openCalendar }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: labels.nextMonth }));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Donnerstag, 15. Oktober 2026/ }));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-15', null);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByLabelText('Datum') as HTMLInputElement).value).toBe('15.10.2026');
  });

  it('closes with Escape, restores trigger focus and keeps the value', async () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: labels.openCalendar });
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([{ disabled: true }, { readOnly: true }])(
    'prevents calendar editing with %s',
    (props) => {
      render(<Field {...props} />);
      expect(
        (screen.getByRole('button', { name: labels.openCalendar }) as HTMLButtonElement).disabled
      ).toBe(true);
    }
  );

  it('follows external value changes', () => {
    const { rerender } = render(<Field value="2026-09-09" />);
    rerender(<Field value="2026-10-25" />);
    expect((screen.getByLabelText('Datum') as HTMLInputElement).value).toBe('25.10.2026');
  });

  it('revalidates date bounds without silently changing an existing value', async () => {
    const onValidationChange = vi.fn();
    const { rerender } = render(<Field onValidationChange={onValidationChange} />);
    rerender(<Field min="2026-09-10" onValidationChange={onValidationChange} />);
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith('min'));
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    expect(input.value).toBe('09.09.2026');
    fireEvent.blur(input);
    expect(screen.getByText('Datum zu früh')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: labels.openCalendar }));
    // Invalid input opens on today; navigation is still available for any month.
    expect(screen.getByRole('button', { name: labels.nextMonth })).toBeTruthy();
  });

  it('keeps both date bounds inclusive in the calendar', async () => {
    render(<Field min="2026-09-09" max="2026-09-10" />);
    fireEvent.click(screen.getByRole('button', { name: labels.openCalendar }));
    const previous = screen.getByRole('button', {
      name: /Dienstag, 8. September 2026/,
    }) as HTMLButtonElement;
    const allowed = screen.getByRole('button', {
      name: /Donnerstag, 10. September 2026/,
    }) as HTMLButtonElement;
    const later = screen.getByRole('button', {
      name: /Freitag, 11. September 2026/,
    }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(allowed.disabled).toBe(false);
    expect(later.disabled).toBe(true);
  });

  it.each([
    { min: '2090-09-09', month: 'September 2090' },
    { max: '1900-01-01', month: 'Januar 1900' },
  ])('opens an empty bounded field on an available day: %s', async ({ month, ...bounds }) => {
    const onChange = vi.fn();
    render(<Field value={null} {...bounds} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: labels.openCalendar }));
    expect(screen.getByRole('grid', { name: month })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks empty required input after an invalid submit and supports English input', () => {
    render(<Field required locale="en-US" />);
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.invalid(input);
    expect(screen.getByText('Datum erforderlich')).toBeTruthy();
    fireEvent.change(input, { target: { value: '12/31/2026' } });
    expect(input.checkValidity()).toBe(true);
    expect(input.value).toBe('12/31/2026');
  });
});
