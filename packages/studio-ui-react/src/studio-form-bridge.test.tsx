import * as React from 'react';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller, type FieldError, useForm } from 'react-hook-form';

import { Input, Select, StudioField, StudioFormFieldError, StudioFormSummaryErrors, getStudioFieldError } from './index.js';

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

  const summaryErrors = errors.title
    ? [
        {
          field: 'title',
          message: getStudioFieldError(errors.title) ?? 'Titel fehlt',
        },
      ]
    : [];

  return (
    <form onSubmit={handleSubmit(() => undefined)} noValidate>
      <StudioFormSummaryErrors errors={summaryErrors} />
      <StudioField id="title" label="Titel" error={<StudioFormFieldError error={errors.title} />}>
        <Input
          id="title"
          aria-invalid={errors.title ? 'true' : 'false'}
          aria-describedby={errors.title ? 'title-error' : undefined}
          {...register('title', { required: 'Titel fehlt' })}
        />
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

  const summaryErrors = errors.category
    ? [
        {
          field: 'category',
          message: getStudioFieldError(errors.category) ?? 'Kategorie fehlt',
        },
      ]
    : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StudioFormSummaryErrors errors={summaryErrors} />
      <StudioField id="category" label="Kategorie" error={<StudioFormFieldError error={errors.category} />}>
        <Controller
          name="category"
          control={control}
          rules={{ required: 'Kategorie fehlt' }}
          render={({ field }) => (
            <Select
              {...field}
              id="category"
              aria-invalid={errors.category ? 'true' : 'false'}
              aria-describedby={errors.category ? 'category-error' : undefined}
            >
              <option value="">Bitte wählen</option>
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

    render(
      <StudioField id="title" label="Titel" error={<StudioFormFieldError error={error} />}>
        <Input id="title" aria-invalid={getStudioFieldError(error) ? 'true' : 'false'} aria-describedby="title-error" />
      </StudioField>
    );

    expect(screen.getByText('Titel fehlt')).toBeTruthy();
    expect(screen.getByLabelText('Titel').getAttribute('aria-invalid')).toBe('true');
  });

  it('renders summary errors with focusable anchor behavior', () => {
    render(
      <>
        <StudioFormSummaryErrors
          title="Bitte korrigieren"
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
    expect(screen.getByText('Bitte korrigieren')).toBeTruthy();
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
});
