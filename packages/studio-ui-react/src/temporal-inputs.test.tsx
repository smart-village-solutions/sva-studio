import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DateInput,
  FormDateInput,
  InstantInput,
  LocalDateTimeInput,
  TimeInput,
} from './temporal-inputs.js';

afterEach(cleanup);
describe('shared temporal inputs', () => {
  it('retains invalid drafts and prevents noValidate forms from submitting them', () => {
    const save = vi.fn();
    function Form() {
      const [value, setValue] = useState('2026-01-01');
      return (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save(value);
          }}
        >
          <label htmlFor="day">Day</label>
          <DateInput id="day" value={value} onValueChange={setValue} />
          <button type="submit">Save</button>
        </form>
      );
    }
    render(<Form />);
    const input = screen.getByLabelText('Day') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '31.02.2026' } });
    expect(input.value).toBe('31.02.2026');
    fireEvent.submit(input.form!);
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '28.02.2026' } });
    fireEvent.submit(input.form!);
    expect(save).toHaveBeenCalledWith('2026-02-28');
  });
  it('keeps ISO values in React Hook Form and supports a loaded form reset', async () => {
    const save = vi.fn();
    function Form() {
      const form = useForm({ defaultValues: { day: '2026-01-01' } });
      return (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(save)}>
            <label htmlFor="day">Day</label>
            <FormDateInput<{ day: string }> id="day" name="day" />
            <button type="button" onClick={() => form.reset({ day: '2026-07-01' })}>
              Reset
            </button>
            <button type="submit">Save</button>
          </form>
        </FormProvider>
      );
    }
    render(<Form />);
    fireEvent.click(screen.getByText('Reset'));
    expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('01.07.2026');
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '02.07.2026' } });
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toEqual({ day: '2026-07-02' });
  });
  it('does not discard seconds from native local time values', () => {
    render(
      <>
        <TimeInput aria-label="Time" defaultValue="12:30:45" />
        <LocalDateTimeInput
          id="local"
          aria-label="Local"
          value="2026-07-01T12:30:45"
          onValueChange={() => undefined}
        />
      </>
    );
    expect((screen.getByLabelText('Time') as HTMLInputElement).value).toBe('12:30:45');
    expect((screen.getByLabelText('Local') as HTMLInputElement).value).toBe('01.07.2026');
    expect((document.getElementById('local-time') as HTMLInputElement).value).toBe('12:30:45');
  });
});

describe('instant input', () => {
  it('emits an explicit UTC payload and preserves the original until an edit', () => {
    const change = vi.fn();
    render(
      <InstantInput
        id="instant"
        aria-label="Instant"
        value="2026-10-25T01:30:45.123Z"
        onValueChange={change}
      />
    );
    expect((screen.getByLabelText('Instant') as HTMLInputElement).value).toBe('25.10.2026');
    expect((document.getElementById('instant-time') as HTMLInputElement).value).toBe(
      '02:30:45.123'
    );
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById('instant-time')!, {
      target: { value: '02:31:12' },
    });
    expect(change).toHaveBeenCalledWith('2026-10-25T00:31:12.000Z');
  });
  it('does not convert a nonexistent DST time into an empty timestamp', () => {
    const change = vi.fn();
    render(
      <InstantInput
        id="instant"
        aria-label="Instant"
        value="2026-03-29T00:30:00.000Z"
        onValueChange={change}
      />
    );
    fireEvent.change(document.getElementById('instant-time')!, { target: { value: '02:30' } });
    expect(change).toHaveBeenCalledWith('2026-03-29T02:30');
  });
});

it('blocks invalid local and absolute timestamps in noValidate forms', () => {
  const save = vi.fn();
  render(
    <form noValidate onSubmit={save}>
      <InstantInput aria-label="Gap" value="2026-03-29T02:30" onValueChange={() => undefined} />
    </form>
  );
  fireEvent.submit((screen.getByLabelText('Gap') as HTMLInputElement).form!);
  expect(save).not.toHaveBeenCalled();
});

it('composes a localized date and a clock value without changing the local API contract', () => {
  const change = vi.fn();
  function Form() {
    const [value, setValue] = useState('2026-07-01T12:30:45');
    return (
      <form>
        <LocalDateTimeInput
          id="local"
          aria-label="Local"
          name="local"
          value={value}
          onValueChange={(next) => {
            setValue(next);
            change(next);
          }}
        />
      </form>
    );
  }
  render(<Form />);
  fireEvent.change(screen.getByLabelText('Local'), { target: { value: '02.07.2026' } });
  fireEvent.change(document.getElementById('local-time')!, { target: { value: '13:45:12.123' } });
  expect(change).toHaveBeenLastCalledWith('2026-07-02T13:45:12.123');
  expect(
    new FormData((screen.getByLabelText('Local') as HTMLInputElement).form!).get('local')
  ).toBe('2026-07-02T13:45:12.123');
});

it('keeps a nonexistent instant invalid when correcting its calendar draft', () => {
  const save = vi.fn();
  function Form() {
    const [value, setValue] = useState('2026-03-29T00:30:00.000Z');
    return (
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save(value);
        }}
      >
        <InstantInput id="instant" aria-label="Instant" value={value} onValueChange={setValue} />
      </form>
    );
  }
  render(<Form />);
  const day = screen.getByLabelText('Instant') as HTMLInputElement;
  fireEvent.change(day, { target: { value: '31.02.2026' } });
  fireEvent.change(document.getElementById('instant-time')!, { target: { value: '02:30' } });
  fireEvent.change(day, { target: { value: '29.03.2026' } });
  fireEvent.submit(day.form!);
  expect(save).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(document.getElementById('instant-time'));
  fireEvent.change(document.getElementById('instant-time')!, { target: { value: '03:30' } });
  fireEvent.submit(day.form!);
  expect(save).toHaveBeenCalledWith('2026-03-29T01:30:00.000Z');
});

it('retains calendar bounds when an instant edit is otherwise valid', () => {
  const save = vi.fn();
  function Form() {
    const [value, setValue] = useState('2026-07-01T10:30:00.000Z');
    return (
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save(value);
        }}
      >
        <InstantInput
          id="instant"
          aria-label="Instant"
          min="2026-07-01T00:00"
          value={value}
          onValueChange={setValue}
        />
      </form>
    );
  }
  render(<Form />);
  const day = screen.getByLabelText('Instant') as HTMLInputElement;
  fireEvent.change(day, { target: { value: '2026-06-30' } });
  fireEvent.submit(day.form!);
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(day, { target: { value: '01.07.2026' } });
  fireEvent.submit(day.form!);
  expect(save).toHaveBeenCalledWith('2026-07-01T10:30:00.000Z');
});
