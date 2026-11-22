import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataEntityDialogs } from '../src/waste-management.master-data.entity-dialogs.js';
import { wasteManagementPluginTranslationsDEMasterDataLocationsWorkspace } from '../src/plugin.translations.de.masterData.locations-workspace.js';

type DialogProps = {
  readonly message: unknown;
  readonly regions?: readonly unknown[];
  readonly cities?: readonly unknown[];
  readonly streets?: readonly unknown[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Record<string, unknown>) => void;
  readonly onSubmit: () => void;
};

const dialogProps = vi.hoisted(() => ({
  fraction: [] as DialogProps[],
  region: [] as DialogProps[],
  city: [] as DialogProps[],
  street: [] as DialogProps[],
  houseNumber: [] as DialogProps[],
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, string | number>) => {
    const addressKey = key.split('.').at(-1);
    const translations = wasteManagementPluginTranslationsDEMasterDataLocationsWorkspace.addresses;
    const template = translations[addressKey as keyof typeof translations];
    return typeof template === 'string'
      ? template.replaceAll(/{{(\w+)}}/g, (_, variable: string) => String(values?.[variable] ?? ''))
      : key;
  },
}));

vi.mock('../src/waste-management.master-data-entity-dialogs.js', () => {
  const createMockDialog = (bucket: DialogProps[]) => (props: DialogProps) => {
    bucket.push(props);
    return <div />;
  };

  return {
    FractionDialog: createMockDialog(dialogProps.fraction),
    RegionDialog: createMockDialog(dialogProps.region),
    CityDialog: createMockDialog(dialogProps.city),
    StreetDialog: createMockDialog(dialogProps.street),
    HouseNumberDialog: createMockDialog(dialogProps.houseNumber),
  };
});

describe('WasteMasterDataEntityDialogs', () => {
  beforeEach(() => {
    for (const props of Object.values(dialogProps)) props.length = 0;
  });
  afterEach(cleanup);

  it.each([0, 3])('describes the move and requires the appropriate confirmation for %i affected subscriptions', async (emailReminderSubscriptions) => {
    const onConfirm = vi.fn(async () => undefined);
    const controller = {
      pendingAddressMove: {
        entityLabel: 'Ortsteil Ost',
        sourceLabel: 'Gemeinde A',
        targetLabel: 'Stadt B',
        preview: {
          counts: {
            collectionLocations: 1,
            locationTourLinks: 10,
            locationTourPickupDates: 0,
            emailReminderSubscriptions,
            emailReminderSubscriptionItems: emailReminderSubscriptions,
            emailReminderOutbox: emailReminderSubscriptions,
            sentEmailReminderOutbox: 0,
          },
        },
        onConfirm,
      },
      setSaving: vi.fn(),
      setPendingAddressMove: vi.fn(),
    };
    const renderDialogs = () => <WasteMasterDataEntityDialogs controller={controller as never} />;
    const { rerender } = render(renderDialogs());
    expect(screen.getByRole('alertdialog').getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Die Zuordnung für „Ortsteil Ost“ von „Gemeinde A“ nach „Stadt B“ ändern?')).toBeTruthy();
    expect(screen.getByText('10 bestehende Tourzuordnungen bleiben erhalten.')).toBeTruthy();
    expect(screen.getByText(new RegExp(`^${emailReminderSubscriptions} betroffene E-Mail-Abos`))).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(controller.setPendingAddressMove).toHaveBeenCalledWith(null);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(renderDialogs());
    const confirmLabel = emailReminderSubscriptions > 0
      ? 'Verschiebung und Abo-Löschung bestätigen'
      : 'Verschiebung bestätigen';
    fireEvent.click(screen.getByRole('button', { name: confirmLabel }));
    await waitFor(() => expect(controller.setSaving).toHaveBeenLastCalledWith(false));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('passes visibility-based messages, fallback collections, and reset-aware handlers to all dialogs', () => {
    const controller = {
      pendingAddressMove: null,
      dialogOpen: true,
      dialogMode: 'create',
      fractionForm: { id: 'fraction-1', name: 'Rest' },
      regionDialogOpen: false,
      regionDialogMode: 'edit',
      regionForm: { id: 'region-1', name: 'Mitte' },
      cityDialogOpen: true,
      cityDialogMode: 'create',
      cityForm: { id: 'city-1', name: 'Stadt', regionId: 'region-1' },
      streetDialogOpen: false,
      streetDialogMode: 'edit',
      streetForm: { id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' },
      houseNumberDialogOpen: true,
      houseNumberDialogMode: 'create',
      houseNumberForm: { id: 'house-1', number: '12', streetId: 'street-1' },
      overview: {
        regions: [{ id: 'region-1', name: 'Region 1' }],
        cities: [{ id: 'city-1', name: 'City 1' }],
        streets: [{ id: 'street-1', name: 'Street 1' }],
      },
      saving: false,
      message: { kind: 'success', text: 'saved' },
      setDialogOpen: vi.fn(),
      resetFractionForm: vi.fn(),
      setFractionForm: vi.fn(),
      onSubmitFraction: vi.fn(),
      setRegionDialogOpen: vi.fn(),
      resetRegionForm: vi.fn(),
      setRegionForm: vi.fn(),
      onSubmitRegion: vi.fn(),
      setCityDialogOpen: vi.fn(),
      resetCityForm: vi.fn(),
      setCityForm: vi.fn(),
      onSubmitCity: vi.fn(),
      setStreetDialogOpen: vi.fn(),
      resetStreetForm: vi.fn(),
      setStreetForm: vi.fn(),
      onSubmitStreet: vi.fn(),
      setHouseNumberDialogOpen: vi.fn(),
      resetHouseNumberForm: vi.fn(),
      setHouseNumberForm: vi.fn(),
      onSubmitHouseNumber: vi.fn(),
    };

    render(<WasteMasterDataEntityDialogs controller={controller as never} />);

    expect(dialogProps.fraction[0]?.message).toEqual(controller.message);
    expect(dialogProps.region[0]?.message).toBeNull();
    expect(dialogProps.city[0]?.message).toEqual(controller.message);
    expect(dialogProps.street[0]?.message).toBeNull();
    expect(dialogProps.houseNumber[0]?.message).toEqual(controller.message);
    expect(dialogProps.city[0]?.regions).toEqual(controller.overview.regions);
    expect(dialogProps.street[0]?.cities).toEqual(controller.overview.cities);
    expect(dialogProps.houseNumber[0]?.streets).toEqual(controller.overview.streets);

    dialogProps.fraction[0]?.onOpenChange(false);
    dialogProps.fraction[0]?.onOpenChange(true);
    dialogProps.region[0]?.onOpenChange(true);
    dialogProps.region[0]?.onOpenChange(false);
    dialogProps.city[0]?.onOpenChange(false);
    dialogProps.city[0]?.onOpenChange(true);
    dialogProps.street[0]?.onOpenChange(false);
    dialogProps.street[0]?.onOpenChange(true);
    dialogProps.houseNumber[0]?.onOpenChange(false);
    dialogProps.houseNumber[0]?.onOpenChange(true);

    expect(controller.setDialogOpen).toHaveBeenNthCalledWith(1, false);
    expect(controller.setDialogOpen).toHaveBeenNthCalledWith(2, true);
    expect(controller.resetFractionForm).toHaveBeenCalledTimes(1);
    expect(controller.setRegionDialogOpen).toHaveBeenNthCalledWith(1, true);
    expect(controller.setRegionDialogOpen).toHaveBeenNthCalledWith(2, false);
    expect(controller.resetRegionForm).toHaveBeenCalledTimes(1);
    expect(controller.setCityDialogOpen).toHaveBeenNthCalledWith(1, false);
    expect(controller.setCityDialogOpen).toHaveBeenNthCalledWith(2, true);
    expect(controller.resetCityForm).toHaveBeenCalledTimes(1);
    expect(controller.setStreetDialogOpen).toHaveBeenNthCalledWith(1, false);
    expect(controller.setStreetDialogOpen).toHaveBeenNthCalledWith(2, true);
    expect(controller.resetStreetForm).toHaveBeenCalledTimes(1);
    expect(controller.setHouseNumberDialogOpen).toHaveBeenNthCalledWith(1, false);
    expect(controller.setHouseNumberDialogOpen).toHaveBeenNthCalledWith(2, true);
    expect(controller.resetHouseNumberForm).toHaveBeenCalledTimes(1);

    dialogProps.fraction[0]?.onChange({ active: true });
    dialogProps.region[0]?.onChange({ name: 'Nord' });
    dialogProps.city[0]?.onChange({ regionId: 'region-2' });
    dialogProps.street[0]?.onChange({ cityId: 'city-2' });
    dialogProps.houseNumber[0]?.onChange({ number: '42a' });

    expect(controller.setFractionForm).toHaveBeenCalledTimes(1);
    expect(controller.setRegionForm).toHaveBeenCalledTimes(1);
    expect(controller.setCityForm).toHaveBeenCalledTimes(1);
    expect(controller.setStreetForm).toHaveBeenCalledTimes(1);
    expect(controller.setHouseNumberForm).toHaveBeenCalledTimes(1);

    const fractionUpdater = controller.setFractionForm.mock.calls[0]?.[0] as (current: Record<string, unknown>) => Record<string, unknown>;
    const regionUpdater = controller.setRegionForm.mock.calls[0]?.[0] as (current: Record<string, unknown>) => Record<string, unknown>;
    const cityUpdater = controller.setCityForm.mock.calls[0]?.[0] as (current: Record<string, unknown>) => Record<string, unknown>;
    const streetUpdater = controller.setStreetForm.mock.calls[0]?.[0] as (current: Record<string, unknown>) => Record<string, unknown>;
    const houseNumberUpdater = controller.setHouseNumberForm.mock.calls[0]?.[0] as (current: Record<string, unknown>) => Record<string, unknown>;

    expect(fractionUpdater({ name: 'Rest', color: '#111' })).toEqual({ name: 'Rest', color: '#111', active: true });
    expect(regionUpdater({ id: 'region-1' })).toEqual({ id: 'region-1', name: 'Nord' });
    expect(cityUpdater({ id: 'city-1', name: 'City 1' })).toEqual({ id: 'city-1', name: 'City 1', regionId: 'region-2' });
    expect(streetUpdater({ id: 'street-1', name: 'Main' })).toEqual({ id: 'street-1', name: 'Main', cityId: 'city-2' });
    expect(houseNumberUpdater({ id: 'house-1', streetId: 'street-1' })).toEqual({ id: 'house-1', streetId: 'street-1', number: '42a' });

    dialogProps.fraction[0]?.onSubmit();
    dialogProps.region[0]?.onSubmit();
    dialogProps.city[0]?.onSubmit();
    dialogProps.street[0]?.onSubmit();
    dialogProps.houseNumber[0]?.onSubmit();

    expect(controller.onSubmitFraction).toHaveBeenCalledTimes(1);
    expect(controller.onSubmitRegion).toHaveBeenCalledTimes(1);
    expect(controller.onSubmitCity).toHaveBeenCalledTimes(1);
    expect(controller.onSubmitStreet).toHaveBeenCalledTimes(1);
    expect(controller.onSubmitHouseNumber).toHaveBeenCalledTimes(1);
  });

  it('uses empty overview fallbacks when related lists are unavailable', () => {
    dialogProps.city.length = 0;
    dialogProps.street.length = 0;
    dialogProps.houseNumber.length = 0;

    render(
      <WasteMasterDataEntityDialogs
        controller={
          {
            pendingAddressMove: null,
            dialogOpen: false,
            dialogMode: 'create',
            fractionForm: {},
            regionDialogOpen: false,
            regionDialogMode: 'create',
            regionForm: {},
            cityDialogOpen: false,
            cityDialogMode: 'create',
            cityForm: {},
            streetDialogOpen: false,
            streetDialogMode: 'create',
            streetForm: {},
            houseNumberDialogOpen: false,
            houseNumberDialogMode: 'create',
            houseNumberForm: {},
            overview: null,
            saving: false,
            message: null,
            setDialogOpen: vi.fn(),
            resetFractionForm: vi.fn(),
            setFractionForm: vi.fn(),
            onSubmitFraction: vi.fn(),
            setRegionDialogOpen: vi.fn(),
            resetRegionForm: vi.fn(),
            setRegionForm: vi.fn(),
            onSubmitRegion: vi.fn(),
            setCityDialogOpen: vi.fn(),
            resetCityForm: vi.fn(),
            setCityForm: vi.fn(),
            onSubmitCity: vi.fn(),
            setStreetDialogOpen: vi.fn(),
            resetStreetForm: vi.fn(),
            setStreetForm: vi.fn(),
            onSubmitStreet: vi.fn(),
            setHouseNumberDialogOpen: vi.fn(),
            resetHouseNumberForm: vi.fn(),
            setHouseNumberForm: vi.fn(),
            onSubmitHouseNumber: vi.fn(),
          } as never
        }
      />
    );

    expect(dialogProps.city[0]?.regions).toEqual([]);
    expect(dialogProps.street[0]?.cities).toEqual([]);
    expect(dialogProps.houseNumber[0]?.streets).toEqual([]);
  });
});
