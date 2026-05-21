import * as React from 'react';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller, type FieldError, useForm } from 'react-hook-form';

import {
  Input,
  Select,
  StudioField,
  StudioFormSummaryErrors,
  getStudioFieldError,
  getStudioFormFieldProps,
  type StudioFormFieldError,
} from './index.js';

afterEach(() => {
  cleanup();
});

type RegisterOnlyValues = Readonly<{
  title: string;
}>;

type ControlledValues = Readonly<{
  category: string;
}>;

function RegisterOnlyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterOnlyValues>({
    defaultValues: {
      title: '',
    },
  });

  const titleField = getStudioFormFieldProps({
    id: 'title',
    error: errors.title,
  });

  const summaryErrors: readonly StudioFormFieldError[] = titleField.summaryError ? [titleField.summaryError] : [];

  return (
    <form onSubmit={handleSubmit(() => undefined)} noValidate>
      <StudioFormSummaryErrors errors={summaryErrors} />
      <StudioField {...titleField} label="Titel">
        <Input {...titleField.controlProps} {...register('title', { required: 'Titel fehlt' })} />
      </StudioField>
      <button type="submit">Speichern</button>
    </form>
  );
}

function ControlledSelectForm({ onSubmit }: Readonly<{ onSubmit: (values: ControlledValues) => void }>) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ControlledValues>({
    defaultValues: {
      category: '',
    },
  });

  const categoryField = getStudioFormFieldProps({
    id: 'category',
    error: errors.category,
  });

  const summaryErrors: readonly StudioFormFieldError[] = categoryField.summaryError ? [categoryField.summaryError] : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StudioFormSummaryErrors errors={summaryErrors} />
      <StudioField {...categoryField} label="Kategorie">
        <Controller
          name="category"
          control={control}
          rules={{ required: 'Kategorie fehlt' }}
          render={({ field }) => (
            <Select {...categoryField.controlProps} {...field}>
              <option value="">Select one</option>
              <option value="news">News</option>
              <option value="events">Events</option>
            </Select>
          )}
        />
      </StudioField>
      <button type="submit">Speichern</button>
    </form>
  );
}

describe('studio-ui-react RHF bridge', () => {
  it('maps a field error to StudioField', () => {
    const error = {
      type: 'required',
      message: 'Titel fehlt',
    } satisfies FieldError;
    const fieldProps = getStudioFormFieldProps({
      id: 'title',
      error,
      hasDescription: true,
    });

    render(
      <StudioField {...fieldProps} label="Titel" description="Pflichtfeld">
        <Input {...fieldProps.controlProps} />
      </StudioField>
    );

    expect(screen.getByText('Titel fehlt')).toBeTruthy();
    expect(screen.getByLabelText('Titel').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Titel').getAttribute('aria-describedby')).toBe('title-description title-error');
  });

  it('renders summary errors with focusable anchor behavior', () => {
    render(
      <>
        <StudioFormSummaryErrors
          errors={[
            { field: 'title', message: 'Titel fehlt' },
            { field: 'category', message: 'Kategorie fehlt' },
          ]}
        />
        <Input id="title" aria-label="Titel" />
        <Input id="category" aria-label="Kategorie" />
      </>
    );

    const link = screen.getByRole('link', { name: 'Titel fehlt' });
    expect(link.getAttribute('href')).toBe('#title');

    fireEvent.click(link);

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Titel' }));
    expect(screen.queryByText(/korrigieren/i)).toBeNull();
  });

  it('supports register-only inputs without Controller', async () => {
    render(<RegisterOnlyForm />);

    const input = screen.getByRole('textbox', { name: 'Titel' });
    const submitButton = screen.getByRole('button', { name: 'Speichern' });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByText('Titel fehlt')).toHaveLength(2);
    });
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(input, { target: { value: 'Neuer Titel' } });

    await waitFor(() => {
      expect(screen.queryByText('Titel fehlt')).toBeNull();
    });
  });

  it('supports Controller for controlled Select components', async () => {
    const onSubmit = vi.fn<(values: ControlledValues) => void>();

    render(<ControlledSelectForm onSubmit={onSubmit} />);

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByText('Kategorie fehlt')).toHaveLength(2);
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Kategorie' }), {
      target: { value: 'news' },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ category: 'news' }, expect.anything());
    });
    expect(screen.queryByText('Kategorie fehlt')).toBeNull();
  });

  it('creates summary items only when a field error message exists', () => {
    const fieldProps = getStudioFormFieldProps({
      id: 'title',
      error: undefined,
      hasDescription: true,
    });

    expect(fieldProps.summaryError).toBeUndefined();
    expect(fieldProps.controlProps['aria-invalid']).toBeUndefined();
    expect(fieldProps.controlProps['aria-describedby']).toBe('title-description');
    expect(getStudioFieldError(undefined)).toBeUndefined();
  });
});
