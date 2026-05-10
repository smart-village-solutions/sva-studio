import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WasteManagementApiError } from '../src/waste-management.api.js';
import {
  createWasteMasterDataEntityActions,
} from '../src/waste-management.master-data.entity-actions.js';
import {
  wasteMasterDataFormDefaults,
  wasteMasterDataFormMappers,
  wasteMasterDataInputMappers,
} from '../src/waste-management.master-data.forms.js';
import { createWasteMasterDataLocationActions } from '../src/waste-management.master-data.location-actions.js';
import {
  ResetConfirmationDialog,
  StatusNotice,
  compactOptionalString,
  downloadImportTemplate,
  formatUpdatedAt,
  resolveApiErrorCode,
  toJobStatusTone,
  toTechnicalStatusTone,
} from '../src/waste-management.page.support.js';
import {
  calculateTourOccurrencesForYear,
  formatTourDateRange,
  formatTourRecurrence,
} from '../src/waste-management.tours.presentation.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Alert: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { readonly children: React.ReactNode }) => <strong>{children}</strong>,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  StudioConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    confirmDisabled,
    onConfirm,
    children,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly confirmDisabled: boolean;
    readonly onConfirm: () => void;
    readonly children: React.ReactNode;
  }) =>
    open ? (
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        <button disabled={confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </button>
        {children}
      </div>
    ) : null,
  StudioField: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

describe('waste management helper modules', () => {
  it('covers page support helpers, download templates, and the reset dialog shell', () => {
    expect(compactOptionalString('  ')).toBeUndefined();
    expect(compactOptionalString(' value ')).toBe('value');
    expect(resolveApiErrorCode(new WasteManagementApiError('invalid_input', 'Fehler'))).toBe('invalid_input');
    expect(resolveApiErrorCode(new Error('boom'))).toBeNull();
    expect(formatUpdatedAt(undefined)).toBe('—');
    expect(formatUpdatedAt('invalid-date')).toBe('invalid-date');
    expect(toTechnicalStatusTone('ok')).toBe('success');
    expect(toTechnicalStatusTone('error')).toBe('error');
    expect(toTechnicalStatusTone('unknown')).toBe('warning');
    expect(toTechnicalStatusTone('not_configured')).toBe('neutral');
    expect(toJobStatusTone('succeeded')).toBe('success');
    expect(toJobStatusTone('failed')).toBe('error');
    expect(toJobStatusTone('queued')).toBe('warning');
    expect(toJobStatusTone(undefined)).toBe('neutral');

    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:template');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchorClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          click: anchorClick,
          set href(value: string) {
            this._href = value;
          },
          get href() {
            return this._href;
          },
          set download(value: string) {
            this._download = value;
          },
          get download() {
            return this._download;
          },
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    const profile = {
      profileId: 'waste-management.geografie-abholorte',
      displayName: 'Geografie',
      description: 'Importiert Geografie.',
      sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      requiredColumns: [{ key: 'region_id', required: true, example: 'region-1' }],
      optionalColumns: [{ key: 'street_id', required: false, example: 'street-1' }],
      validationRules: [],
      mappingTemplates: [],
    } as const;

    downloadImportTemplate(profile, 'text/csv');
    downloadImportTemplate(profile, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(anchorClick).toHaveBeenCalledTimes(2);
    expect(objectUrlSpy).toHaveBeenCalledTimes(2);
    expect(revokeSpy).toHaveBeenCalledWith('blob:template');

    const onConfirm = vi.fn();
    const onTokenChange = vi.fn();
    const { rerender } = render(<StatusNotice message={null} />);
    expect(screen.queryByTestId('alert')).toBeNull();

    rerender(<StatusNotice message={{ kind: 'error', text: 'Fehlertext' }} />);
    expect(screen.getByTestId('alert').textContent).toContain('Fehler');
    expect(screen.getByTestId('alert').textContent).toContain('Fehlertext');

    rerender(
      <ResetConfirmationDialog
        open
        token=" "
        running={false}
        onOpenChange={() => undefined}
        onTokenChange={onTokenChange}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole('button', { name: 'tools.reset.confirmAction' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('RESET'), { target: { value: 'RESET' } });
    expect(onTokenChange).toHaveBeenCalledWith('RESET');

    rerender(
      <ResetConfirmationDialog
        open
        token="RESET"
        running={true}
        onOpenChange={() => undefined}
        onTokenChange={onTokenChange}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole('button', { name: 'tools.actions.starting' }).hasAttribute('disabled')).toBe(true);

    createElementSpy.mockRestore();
    objectUrlSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('covers form defaults, mappers, and select resolution', () => {
    expect(wasteMasterDataFormDefaults.createRegion()).toEqual({
      id: expect.any(String),
      name: '',
    });

    expect(
      wasteMasterDataFormMappers.collectionLocationToForm({
        id: 'location-1',
        regionId: undefined,
        cityId: 'city-1',
        streetId: undefined,
        houseNumberId: undefined,
        active: true,
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:00.000Z',
      })
    ).toEqual({
      id: 'location-1',
      regionId: '',
      cityId: 'city-1',
      streetId: '',
      houseNumberId: '',
      active: true,
    });

    expect(
      wasteMasterDataInputMappers.toCreateFractionInput({
        id: 'fraction-1',
        name: ' Rest ',
        translations: {
          de: ' Restmüll ',
          en: ' ',
          ' ': 'ignore',
        },
        containerSize: ' 240l ',
        color: ' #111111 ',
        description: ' Beschreibung ',
        active: true,
      })
    ).toEqual({
      id: 'fraction-1',
      name: 'Rest',
      translations: { de: 'Restmüll' },
      containerSize: '240l',
      color: '#111111',
      description: 'Beschreibung',
      active: true,
    });

    expect(
      wasteMasterDataInputMappers.toCreateLocationTourLinksBulkInput(
        {
          tourId: 'tour-1',
          startDate: ' 2026-05-01 ',
          endDate: ' ',
        },
        ['location-1', 'location-2']
      )
    ).toEqual({
      locationIds: ['location-1', 'location-2'],
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: undefined,
    });

    const form = document.createElement('form');
    const singleSelect = document.createElement('select');
    singleSelect.name = 'cityId';
    const singleOption = document.createElement('option');
    singleOption.value = ' city-1 ';
    singleOption.textContent = 'City';
    singleSelect.append(singleOption);
    form.append(singleSelect);
    const multipleSelect = document.createElement('select');
    multipleSelect.name = 'tourIds';
    const firstMultipleOption = document.createElement('option');
    firstMultipleOption.value = 'tour-1';
    firstMultipleOption.textContent = 'One';
    const secondMultipleOption = document.createElement('option');
    secondMultipleOption.value = 'tour-2';
    secondMultipleOption.textContent = 'Two';
    multipleSelect.append(firstMultipleOption, secondMultipleOption);
    form.append(multipleSelect);

    expect(wasteMasterDataInputMappers.resolveSingleSelectValue(form, 'cityId')).toBe('city-1');
    expect(wasteMasterDataInputMappers.resolveSingleSelectValue(form, 'tourIds')).toBe('');
    expect(wasteMasterDataInputMappers.resolveSingleSelectValue(form, 'missing')).toBe('');
  });

  it('covers entity actions and location selection helpers', () => {
    const state = {
      overview: {
        regions: [{ id: 'region-1' }],
        cities: [{ id: 'city-1' }],
        streets: [{ id: 'street-1' }],
      },
      availableTours: [{ id: 'tour-1' }],
      setDialogMode: vi.fn(),
      setFractionForm: vi.fn(),
      setMessage: vi.fn(),
      setDialogOpen: vi.fn(),
      setRegionDialogMode: vi.fn(),
      setRegionForm: vi.fn(),
      setRegionDialogOpen: vi.fn(),
      setCityDialogMode: vi.fn(),
      setCityForm: vi.fn(),
      setCityDialogOpen: vi.fn(),
      setStreetDialogMode: vi.fn(),
      setStreetForm: vi.fn(),
      setStreetDialogOpen: vi.fn(),
      setHouseNumberDialogMode: vi.fn(),
      setHouseNumberForm: vi.fn(),
      setHouseNumberDialogOpen: vi.fn(),
      setLocationDialogMode: vi.fn(),
      setLocationForm: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      setBulkAssignmentsForm: vi.fn(),
      setBulkAssignmentsDialogOpen: vi.fn(),
      setSelectedLocationIds: vi.fn((updater: (current: readonly string[]) => readonly string[]) => updater(['location-2'])),
    } as const;

    const entityActions = createWasteMasterDataEntityActions(state as never, { cityId: 'city-99' });
    entityActions.openCreateDialog();
    entityActions.openEditDialog({
      id: 'fraction-1',
      name: 'Rest',
      translations: {},
      containerSize: undefined,
      color: '#123456',
      description: undefined,
      active: true,
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    });
    entityActions.openCreateRegionDialog();
    entityActions.openEditRegionDialog({
      id: 'region-1',
      name: 'Region',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    });
    entityActions.openCreateCityDialog();
    entityActions.openEditCityDialog({
      id: 'city-1',
      name: 'Stadt',
      regionId: 'region-1',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    });
    entityActions.openCreateStreetDialog();
    entityActions.openEditStreetDialog({
      id: 'street-1',
      name: 'Hauptstraße',
      cityId: 'city-1',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    });
    entityActions.openCreateHouseNumberDialog();
    entityActions.openEditHouseNumberDialog({
      id: 'house-1',
      number: '12',
      streetId: 'street-1',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    });

    expect(state.setDialogOpen).toHaveBeenCalledWith(true);
    expect(state.setCityForm).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'region-1' }));
    expect(state.setStreetForm).toHaveBeenCalledWith(expect.objectContaining({ cityId: 'city-99' }));
    expect(state.setHouseNumberForm).toHaveBeenCalledWith(expect.objectContaining({ streetId: 'street-1' }));

    const locationActions = createWasteMasterDataLocationActions(
      state as never,
      { regionId: 'region-7', cityId: 'city-7' },
      [{ id: 'location-1' }, { id: 'location-2' }] as never
    );
    locationActions.openCreateLocationDialog();
    locationActions.openEditLocationDialog({
      id: 'location-1',
      regionId: 'region-1',
      cityId: 'city-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    });
    locationActions.openBulkAssignmentsDialog();
    locationActions.toggleLocationSelection('location-1', true);
    locationActions.toggleLocationSelection('location-2', false);
    locationActions.toggleSelectAllFilteredLocations(true);
    locationActions.toggleSelectAllFilteredLocations(false);

    expect(state.setLocationForm).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'region-7', cityId: 'city-7' }));
    expect(state.setBulkAssignmentsForm).toHaveBeenCalledWith(expect.objectContaining({ tourId: 'tour-1' }));
    expect(state.setSelectedLocationIds).toHaveBeenCalledTimes(4);
  });

  it('covers tours presentation helpers including recurrence, ranges, custom dates, and shifts', () => {
    const pt = (key: string) => key;

    expect(formatTourRecurrence(pt, undefined)).toBe('—');
    expect(formatTourRecurrence(pt, 'on-demand')).toBe('tours.recurrence.onDemand');
    expect(formatTourDateRange({ firstDate: '2026-01-01', endDate: '2026-12-31' } as never)).toBe('2026-01-01 – 2026-12-31');
    expect(formatTourDateRange({ firstDate: undefined, endDate: '2026-12-31' } as never)).toBe('2026-12-31');

    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-1',
          recurrence: 'weekly',
          firstDate: '2026-01-02',
          endDate: '2026-01-20',
          customDates: [{ date: '2026-02-01' }],
        } as never,
        2026,
        {
          tourDateShifts: [{ tourId: 'tour-1', originalDate: '2026-01-09', actualDate: '2026-01-10' }],
          globalDateShifts: [{ originalDate: '2026-02-01', actualDate: '2026-02-02', tourIds: ['tour-1'] }],
        } as never
      )
    ).toEqual(['2026-01-01', '2026-01-08', '2026-01-15', '2026-02-02']);

    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-2',
          recurrence: 'custom',
          firstDate: 'invalid',
          customDates: [{ date: '2025-12-31' }, { date: '2026-03-10' }],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
        } as never
      )
    ).toEqual(['2026-03-10']);
  });
});
