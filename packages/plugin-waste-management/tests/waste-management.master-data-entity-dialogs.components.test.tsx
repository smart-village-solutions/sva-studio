import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CityDialog,
  FractionDialog,
  HouseNumberDialog,
  RegionDialog,
  StreetDialog,
} from '../src/waste-management.master-data-entity-dialogs.js';

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
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioField: ({ children, label }: { readonly children: React.ReactNode; readonly label: string }) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
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
          translations: { de: 'Rest', en: '' },
          color: '#111111',
          containerSize: '120L',
          description: 'Hausmüll',
          active: true,
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
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.cancel' }));
    fireEvent.submit(screen.getByRole('button', { name: 'masterData.fractions.actions.create' }).closest('form')!);

    expect(onChange).toHaveBeenCalledWith({
      translations: { de: 'Rest', en: 'Residual waste' },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).toHaveBeenCalled();
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
});
