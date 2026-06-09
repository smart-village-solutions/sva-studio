import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CityDialog,
  FractionDialog,
  HouseNumberDialog,
  RegionDialog,
  StreetDialog,
} from '../src/waste-management.master-data-entity-dialogs';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => message ? <div>{message.text}</div> : null,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Checkbox: ({ checked, onChange, ...props }: React.ComponentProps<'input'>) => (
    <input
      {...props}
      type="checkbox"
      checked={checked as boolean | undefined}
      onChange={(event) => onChange?.(event)}
    />
  ),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  Dialog: ({
    open,
    children,
  }: {
    readonly open: boolean;
    readonly children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  Input: React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>((props, ref) => <input ref={ref} {...props} />),
  Select: React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>((props, ref) => <select ref={ref} {...props} />),
  StudioFormSummaryErrors: ({ errors }: { readonly errors: readonly { field: string; message: string }[] }) =>
    errors.length > 0 ? (
      <div role="alert">
        {errors.map((error) => (
          <a key={`${error.field}:${error.message}`} href={`#${error.field}`}>
            {error.message}
          </a>
        ))}
      </div>
    ) : null,
  StudioField: ({ children, label }: { readonly children: React.ReactNode; readonly label: string }) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  getStudioFormFieldProps: ({ id, error }: { readonly id: string; readonly error?: { readonly message?: string } }) => ({
    id,
    error: error?.message,
    errorId: `${id}-error`,
    descriptionId: `${id}-description`,
    controlProps: {
      id,
      'aria-invalid': error?.message ? true : undefined,
      'aria-describedby': error?.message ? `${id}-error` : undefined,
    },
    summaryError: error?.message ? { field: id, message: error.message } : undefined,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('waste-management.master-data-entity-dialogs components', () => {
  it('renders the fraction dialog in create mode and propagates value changes', () => {
    const onOpenChange = vi.fn();
    const onChange = vi.fn();
    const onSubmit = vi.fn((event?: Event) => event?.preventDefault());

    render(
      <FractionDialog
        open
        mode="create"
        form={{
          name: 'Restmüll',
          pdfShortLabel: 'RES',
          translations: { de: 'Rest', en: '' },
          color: '#111111',
          containerSize: '120L',
          description: 'Hausmüll',
          active: true,
          reminderCount: 'none',
          firstReminderMaxLeadDays: 1,
          secondReminderMaxLeadDays: 1,
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
        } as never}
        saving={false}
        message={{ kind: 'success', text: 'gespeichert' } as never}
        onOpenChange={onOpenChange}
        onChange={onChange}
        onSubmit={onSubmit as never}
      />
    );

    expect(screen.getByText('masterData.fractions.dialog.createTitle')).toBeTruthy();
    expect(screen.getByText('masterData.fractions.dialog.createDescription')).toBeTruthy();
    expect(screen.getByText('gespeichert')).toBeTruthy();
    expect(screen.getByText('common.active')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('masterData.fractions.fields.translationEn'), {
      target: { value: 'Residual waste' },
    });
    fireEvent.change(screen.getByLabelText('masterData.fractions.fields.pdfShortLabel'), {
      target: { value: 'RSD' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.cancel' }));
    const submitButton = screen.getByRole('button', { name: 'masterData.fractions.actions.create' });
    fireEvent.click(submitButton);

    expect(onChange).toHaveBeenCalledWith({
      translations: { de: 'Rest', en: 'Residual waste' },
    });
    expect(onChange).toHaveBeenCalledWith({
      pdfShortLabel: 'RSD',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('surfaces missing required values through the RHF bridge before submit', async () => {
    const onSubmit = vi.fn();
    const onBeforeSubmit = vi.fn();

    render(
      <RegionDialog
        open
        mode="create"
        form={{ id: 'region-1', name: '' } as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={vi.fn()}
        onBeforeSubmit={onBeforeSubmit}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.regions.actions.create' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('masterData.regions.fields.name');
    expect(screen.getByLabelText('masterData.regions.fields.name').getAttribute('aria-invalid')).toBe('true');
    expect(onBeforeSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps validation feedback when the same region dialog context rerenders', async () => {
    const onSubmit = vi.fn();

    const { rerender } = render(
      <RegionDialog
        open
        mode="create"
        form={{ id: 'region-1', name: '' } as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.regions.actions.create' }));

    expect(await screen.findByRole('alert')).toBeTruthy();

    rerender(
      <RegionDialog
        open
        mode="create"
        form={{ id: 'region-1', name: '' } as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('masterData.regions.fields.name');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders edit and saving branches for the region and city dialogs', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <RegionDialog
        open
        mode="edit"
        form={{ name: 'Mitte' } as never}
        saving
        message={null}
        onOpenChange={() => undefined}
        onChange={onChange}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByText('masterData.regions.dialog.editTitle')).toBeTruthy();
    expect(screen.getByText('masterData.regions.dialog.editDescription')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'masterData.regions.actions.saving' }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <CityDialog
        open
        mode="create"
        form={{ name: 'Musterstadt', regionId: '' } as never}
        regions={[{ id: 'region-1', name: 'Region 1' }] as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={onChange}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByText('masterData.cities.dialog.createTitle')).toBeTruthy();
    expect(screen.getByText('masterData.cities.fields.regionUnset')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('masterData.cities.fields.regionId'), {
      target: { value: 'region-1' },
    });

    expect(onChange).toHaveBeenCalledWith({ regionId: 'region-1' });
  });

  it('uses single-option fallbacks for street and house number selections', () => {
    const onStreetChange = vi.fn();
    const onHouseNumberChange = vi.fn();

    const { rerender } = render(
      <StreetDialog
        open
        mode="edit"
        form={{ name: 'Hauptstraße', cityId: '' } as never}
        cities={[{ id: 'city-1', name: 'Musterstadt' }] as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={onStreetChange}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByText('masterData.streets.dialog.editTitle')).toBeTruthy();
    expect((screen.getByLabelText('masterData.streets.fields.cityId') as HTMLSelectElement).value).toBe('city-1');

    rerender(
      <HouseNumberDialog
        open
        mode="edit"
        form={{ number: '12a', streetId: '' } as never}
        streets={[{ id: 'street-1', name: 'Hauptstraße' }] as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={onHouseNumberChange}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByText('masterData.houseNumbers.dialog.editTitle')).toBeTruthy();
    expect((screen.getByLabelText('masterData.houseNumbers.fields.streetId') as HTMLSelectElement).value).toBe('street-1');

    fireEvent.change(screen.getByLabelText('masterData.houseNumbers.fields.streetId'), {
      target: { value: 'street-1' },
    });
    expect(onHouseNumberChange).toHaveBeenCalledWith({ streetId: 'street-1' });
  });

  it('blocks submit in fraction, city, street and house-number dialogs when required names are missing', async () => {
    const onSubmit = vi.fn();

    const { rerender } = render(
      <FractionDialog
        open
        mode="create"
        form={{
          name: '',
          pdfShortLabel: '',
          translations: { de: '', en: '' },
          color: '',
          containerSize: '',
          description: '',
          active: true,
          reminderCount: 'none',
          firstReminderMaxLeadDays: 1,
          secondReminderMaxLeadDays: 1,
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
        } as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={vi.fn()}
        onSubmit={onSubmit as never}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.create' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('masterData.fractions.fields.name');
    expect(screen.getByRole('alert').textContent).toContain('masterData.fractions.fields.pdfShortLabel');

    rerender(
      <CityDialog
        open
        mode="create"
        form={{ id: 'city-1', name: '', regionId: '' } as never}
        regions={[{ id: 'region-1', name: 'Region 1' }] as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.cities.actions.create' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('masterData.cities.fields.name');

    rerender(
      <StreetDialog
        open
        mode="create"
        form={{ id: 'street-1', name: '', cityId: '' } as never}
        cities={[{ id: 'city-1', name: 'Musterstadt' }] as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.streets.actions.create' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('masterData.streets.fields.name');

    rerender(
      <HouseNumberDialog
        open
        mode="create"
        form={{ id: 'house-1', number: '', streetId: '' } as never}
        streets={[{ id: 'street-1', name: 'Hauptstraße' }] as never}
        saving={false}
        message={null}
        onOpenChange={() => undefined}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.houseNumbers.actions.create' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('masterData.houseNumbers.fields.number');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
