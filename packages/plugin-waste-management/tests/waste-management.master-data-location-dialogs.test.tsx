import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CollectionLocationDialog } from '../src/waste-management.master-data-location-dialogs';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
}));

vi.mock('../src/waste-management.form-switch.js', () => ({
  WasteManagementFormSwitch: ({ checked, onChange }: { readonly checked: boolean; readonly onChange: (checked: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!checked)}>
      {checked ? 'active' : 'inactive'}
    </button>
  ),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Dialog: ({ open, children }: { readonly open: boolean; readonly children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  Input: React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>((props, ref) => <input ref={ref} {...props} />),
  Select: React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>((props, ref) => <select ref={ref} {...props} />),
  StudioField: ({ children, label, error }: { readonly children: React.ReactNode; readonly label: string; readonly error?: string }) => (
    <label>
      <span>{label}</span>
      {children}
      {error ? <span>{error}</span> : null}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CollectionLocationDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('submits RHF values instead of a form event', async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();

    render(
      <CollectionLocationDialog
        open
        mode="create"
        form={{
          id: 'location-1',
          regionId: 'region-1',
          cityId: '',
          streetId: '',
          houseNumberId: '',
          active: true,
        }}
        regions={[{ id: 'region-1', name: 'Nord' }, { id: 'region-2', name: 'Süd' }] as never}
        cities={[
          { id: 'city-1', name: 'Altstadt', regionId: 'region-1' },
          { id: 'city-2', name: 'Neustadt', regionId: 'region-2' },
        ] as never}
        streets={[] as never}
        houseNumbers={[] as never}
        saving={false}
        message={null}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.regionId'), {
      target: { value: 'region-2' },
    });
    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.cityId'), {
      target: { value: 'city-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.actions.create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: 'location-1',
        regionId: 'region-2',
        cityId: 'city-2',
        streetId: '',
        houseNumberId: '',
        active: true,
      });
    });

    expect(onChange).toHaveBeenCalledWith({
      regionId: 'region-2',
      cityId: '',
      streetId: '',
      houseNumberId: '',
    });
  });

  it('shows city validation feedback when submit is blocked by missing city', async () => {
    const onSubmit = vi.fn();

    render(
      <CollectionLocationDialog
        open
        mode="create"
        form={{
          id: 'location-2',
          regionId: 'region-1',
          cityId: '',
          streetId: '',
          houseNumberId: '',
          active: true,
        }}
        regions={[{ id: 'region-1', name: 'Nord' }] as never}
        cities={[{ id: 'city-1', name: 'Altstadt', regionId: 'region-1' }] as never}
        streets={[] as never}
        houseNumbers={[] as never}
        saving={false}
        message={null}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.actions.create' }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('masterData.collectionLocations.fields.cityId')).toBeTruthy();
    });
  });

  it('revalidates city errors when a selection is made after a blocked submit', async () => {
    render(
      <CollectionLocationDialog
        open
        mode="create"
        form={{
          id: 'location-3',
          regionId: 'region-1',
          cityId: '',
          streetId: '',
          houseNumberId: '',
          active: true,
        }}
        regions={[{ id: 'region-1', name: 'Nord' }] as never}
        cities={[{ id: 'city-1', name: 'Altstadt', regionId: 'region-1' }] as never}
        streets={[] as never}
        houseNumbers={[] as never}
        saving={false}
        message={null}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.actions.create' }));

    await waitFor(() => {
      expect(screen.getAllByText('masterData.collectionLocations.fields.cityId')).toHaveLength(2);
    });

    fireEvent.change(screen.getAllByRole('combobox')[1] as HTMLSelectElement, {
      target: { value: 'city-1' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('masterData.collectionLocations.fields.cityId')).toHaveLength(1);
    });
  });

  it('keeps the city validation error when the same dialog context rerenders', async () => {
    const onSubmit = vi.fn();

    const { rerender } = render(
      <CollectionLocationDialog
        open
        mode="create"
        form={{
          id: 'location-4',
          regionId: 'region-1',
          cityId: '',
          streetId: '',
          houseNumberId: '',
          active: true,
        }}
        regions={[{ id: 'region-1', name: 'Nord' }] as never}
        cities={[{ id: 'city-1', name: 'Altstadt', regionId: 'region-1' }] as never}
        streets={[] as never}
        houseNumbers={[] as never}
        saving={false}
        message={null}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.actions.create' }));

    await waitFor(() => {
      expect(screen.getAllByText('masterData.collectionLocations.fields.cityId')).toHaveLength(2);
    });

    rerender(
      <CollectionLocationDialog
        open
        mode="create"
        form={{
          id: 'location-4',
          regionId: 'region-1',
          cityId: '',
          streetId: '',
          houseNumberId: '',
          active: true,
        }}
        regions={[{ id: 'region-1', name: 'Nord' }] as never}
        cities={[{ id: 'city-1', name: 'Altstadt', regionId: 'region-1' }] as never}
        streets={[] as never}
        houseNumbers={[] as never}
        saving={false}
        message={null}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getAllByText('masterData.collectionLocations.fields.cityId')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
