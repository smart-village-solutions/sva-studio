import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementFormSwitch } from '../src/waste-management.form-switch.js';
import { WasteMasterDataLocationsHierarchy } from '../src/waste-management.master-data-locations-hierarchy.js';
import { WasteMasterDataLocationsOverview } from '../src/waste-management.master-data-locations-overview.js';
import { WasteSchedulingCreateFormView } from '../src/waste-management.scheduling-create-form-view.js';
import { WasteSettingsForm } from '../src/waste-management.settings-form.js';
import { TourAssignmentsDialog } from '../src/waste-management.tours-assignments-dialog.js';

const navigateMock = vi.fn();
const schedulingFormContentSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
  formatTechnicalDateTimeInEditorTimeZone: (value: string) => value,
  wasteManagementMasterDataContract: {
    holidayStateCodes: ['BW', 'BY', 'NW'],
  },
}));

vi.mock('@sva/studio-ui-react', () => ({
  cn: (...parts: string[]) => parts.filter(Boolean).join(' '),
  Badge: ({
    children,
  }: {
    readonly children: React.ReactNode;
    readonly variant?: string;
  }) => <span>{children}</span>,
  Button: ({
    children,
    type = 'button',
    onClick,
    disabled,
  }: {
    readonly children: React.ReactNode;
    readonly type?: 'button' | 'submit';
    readonly onClick?: () => void;
    readonly disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Checkbox: ({ indeterminate, ...props }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
    void indeterminate;
    return <input type="checkbox" {...props} />;
  },
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type = 'text',
  }: React.ComponentProps<'input'>) => (
    <input id={id} value={value} onChange={onChange} placeholder={placeholder} type={type} />
  ),
  Textarea: ({ id, value, onChange }: React.ComponentProps<'textarea'>) => (
    <textarea id={id} value={value} onChange={onChange} />
  ),
  Select: ({
    id,
    value,
    onChange,
    children,
    'aria-label': ariaLabel,
  }: React.ComponentProps<'select'>) => (
    <select id={id} value={value} onChange={onChange} aria-label={ariaLabel}>
      {children}
    </select>
  ),
  Dialog: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    readonly open: boolean;
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly confirmLabel: React.ReactNode;
    readonly cancelLabel: React.ReactNode;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        <div>{description}</div>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
  StudioActionMenu: ({
    items,
  }: {
    readonly items: ReadonlyArray<{ readonly id: string; readonly label: string; readonly onSelect: () => void }>;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={item.onSelect}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  StudioField: ({
    id,
    label,
    description,
    children,
  }: {
    readonly id: string;
    readonly label: React.ReactNode;
    readonly description?: React.ReactNode;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      <span>{label}</span>
      {description ? <span>{description}</span> : null}
      {children}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.scheduling-form-content.js', () => ({
  WasteSchedulingFormContent: (props: Record<string, unknown>) => {
    schedulingFormContentSpy(props);
    return (
      <div>
        <div>{`variant:${String(props.variant)}`}</div>
        <div>{`mode:${String(props.mode)}`}</div>
        {props.beforeFields as React.ReactNode}
        <button type="button" onClick={() => (props.onCancel as () => void)()}>
          cancel-create-view
        </button>
      </div>
    );
  },
}));

const createBaseSearch = () => ({
  tab: 'scheduling' as const,
  masterDataTab: 'fractions' as const,
  fractionsView: 'list' as const,
  toursView: 'list' as const,
  locationsView: 'list' as const,
  schedulingView: 'create' as const,
  q: '',
  page: 1,
  pageSize: 25,
  status: 'all' as const,
  shiftContext: 'all' as const,
  fractionsSortBy: 'name' as const,
  fractionsSortDirection: 'asc' as const,
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
  schedulingEntryType: undefined,
  schedulingEntryId: undefined,
  tourDateShiftId: undefined,
  globalDateShiftId: undefined,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('waste-management low coverage views', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    schedulingFormContentSpy.mockReset();
  });

  it('renders the settings form, updates fields, toggles the switch and submits', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: '',
          holidayStateCode: '',
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }}
        settings={{
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          selectedInterfaceName: 'Supabase A',
          selectedInterfaceTypeKey: 'supabase',
          availableInterfaces: [
            { id: 'supabase-1', name: 'Supabase A', typeKey: 'supabase', enabled: true, visibleStatus: 'ok', isSelected: true },
          ],
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          visibleStatus: 'ok',
          customRecurrencePresets: [],
        }}
        saving={false}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.actions.addCustomRecurrence' }));
    fireEvent.change(screen.getByLabelText('settings.fields.customRecurrenceName'), {
      target: { value: '14 Tage' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'settings.actions.saveCustomRecurrence' }));
    expect(onChange).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'settings.actions.save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('settings.messages.customRecurrencesTitle')).toBeTruthy();
    expect(screen.getByText('settings.messages.interfaceSelectionTitle')).toBeTruthy();
  });

  it('updates the holiday state selection through the settings form reducer without saving immediately', () => {
    const onChange = vi.fn();

    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: '',
          holidayStateCode: '',
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }}
        settings={null}
        saving={false}
        onChange={onChange}
        onSubmit={vi.fn()}
      />
    );

    const holidayStateSelect = document.getElementById('waste-settings-holiday-state-code');
    expect(holidayStateSelect).toBeTruthy();

    fireEvent.change(holidayStateSelect as Element, {
      target: { value: 'NW' },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updater = onChange.mock.calls[0]?.[0];
    expect(typeof updater).toBe('function');
    expect(
      updater({
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'wm',
        enabled: true,
        selectedInterfaceId: 'supabase-1',
        calendarWebUrl: '',
        holidayStateCode: '',
        databaseUrl: 'postgresql://db',
        serviceRoleKey: 'secret',
        customRecurrencePresets: [],
        deletedPresetFallbacks: {},
      })
    ).toEqual(
      expect.objectContaining({
        holidayStateCode: 'NW',
      })
    );
  });

  it('submits the selected holiday state through the global save button', () => {
    const onSubmit = vi.fn();

    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: '',
          holidayStateCode: 'NW',
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }}
        settings={null}
        saving={false}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders the holiday state dropdown without a dedicated inline action row', () => {
    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: '',
          holidayStateCode: 'NW',
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }}
        settings={null}
        saving={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const holidayStateSelect = screen.getByLabelText('settings.fields.holidayStateCode');
    expect(holidayStateSelect).toBeTruthy();
    expect(screen.getByRole('button', { name: 'settings.actions.save' })).toBeTruthy();
  });

  it('warns before saving the holiday state when imported holidays already exist', () => {
    const onSubmit = vi.fn();

    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: '',
          holidayStateCode: 'NW',
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }}
        settings={{
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          selectedInterfaceName: 'Supabase A',
          selectedInterfaceTypeKey: 'supabase',
          availableInterfaces: [],
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          visibleStatus: 'ok',
          holidayStateCode: 'BY',
          lastSuccessfulHolidaySyncAt: '2026-06-06T12:00:00.000Z',
          customRecurrencePresets: [],
        }}
        saving={false}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    expect(screen.getByText('settings.messages.holidayStateOverwriteWarningTitle')).toBeTruthy();
    expect(screen.getByText('settings.messages.holidayStateOverwriteWarningDescription')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'settings.actions.save' }).at(-1) as HTMLButtonElement);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('updates the configured calendar web link through the settings form reducer', () => {
    const onChange = vi.fn();

    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: '',
          holidayStateCode: '',
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }}
        settings={null}
        saving={false}
        onChange={onChange}
        onSubmit={vi.fn()}
      />
    );

    const calendarWebUrlInput = document.getElementById('waste-settings-calendar-web-url');
    expect(calendarWebUrlInput).toBeTruthy();

    fireEvent.change(calendarWebUrlInput as Element, {
      target: { value: 'https://bb-prignitz.abfallkalender.smart-village.app/' },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(typeof onChange.mock.calls[0]?.[0]).toBe('function');
  });

  it('keeps single-field settings cards accessible via visually hidden labels', () => {
    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
          holidayStateCode: 'NW',
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }}
        settings={{
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          selectedInterfaceId: 'supabase-1',
          selectedInterfaceName: 'Supabase A',
          selectedInterfaceTypeKey: 'supabase',
          availableInterfaces: [
            { id: 'supabase-1', name: 'Supabase A', typeKey: 'supabase', enabled: true, visibleStatus: 'ok', isSelected: true },
          ],
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          visibleStatus: 'ok',
          customRecurrencePresets: [],
        }}
        saving={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText('settings.fields.holidayStateCode')).toBeTruthy();
    expect(screen.getByLabelText('settings.fields.calendarWebUrl')).toBeTruthy();
    expect(screen.getByLabelText('settings.fields.selectedInterface')).toBeTruthy();
    expect(screen.getByText('settings.fields.holidayStateCode').className).toContain('sr-only');
    expect(screen.getByText('settings.fields.calendarWebUrl').className).toContain('sr-only');
    expect(screen.getByText('settings.fields.selectedInterface').className).toContain('sr-only');
  });

  it('renders the disabled switch branch and toggles an unchecked switch directly', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <WasteManagementFormSwitch checked={false} ariaLabel="switch-label" onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('switch', { name: 'switch-label' }));
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<WasteManagementFormSwitch checked disabled ariaLabel="switch-label-disabled" onChange={onChange} />);

    expect(screen.getByRole('switch', { name: 'switch-label-disabled' }).hasAttribute('disabled')).toBe(true);
  });

  it('renders the locations overview metrics and wires every create action', () => {
    const handlers = {
      onOpenCreateRegion: vi.fn(),
      onOpenCreateCity: vi.fn(),
      onOpenCreateStreet: vi.fn(),
      onOpenCreateHouseNumber: vi.fn(),
      onOpenCreateLocation: vi.fn(),
    };

    render(
      <WasteMasterDataLocationsOverview
        collectionLocationCount={5}
        regionCount={2}
        cityCount={3}
        streetCount={4}
        houseNumberCount={6}
        {...handlers}
      />
    );

    expect(screen.getByText('masterData.meta.collectionLocationCount:{"value":5}')).toBeTruthy();
    expect(screen.getByText('masterData.meta.houseNumberCount:{"value":6}')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.actions.createRegion' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.actions.createCity' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.actions.createStreet' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.actions.createHouseNumber' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.actions.createLocation' }));

    expect(handlers.onOpenCreateRegion).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenCreateCity).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenCreateStreet).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenCreateHouseNumber).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenCreateLocation).toHaveBeenCalledTimes(1);
  });

  it('renders hierarchy sections for populated and empty address levels and wires edit/create actions', () => {
    const onOpenCreateRegion = vi.fn();
    const onOpenCreateCity = vi.fn();
    const onOpenCreateStreet = vi.fn();
    const onOpenCreateHouseNumber = vi.fn();
    const onOpenEditRegion = vi.fn();
    const onOpenEditCity = vi.fn();
    const onOpenEditStreet = vi.fn();
    const onOpenEditHouseNumber = vi.fn();

    render(
      <WasteMasterDataLocationsHierarchy
        regions={[{ id: 'region-1', name: 'Nord', createdAt: '', updatedAt: '' }]}
        cities={[{ id: 'city-1', name: 'Musterstadt', regionId: 'region-1', createdAt: '', updatedAt: '' }]}
        streets={[]}
        houseNumbers={[{ id: 'house-1', number: '12', streetId: 'street-1', createdAt: '', updatedAt: '' }]}
        onOpenCreateRegion={onOpenCreateRegion}
        onOpenCreateCity={onOpenCreateCity}
        onOpenCreateStreet={onOpenCreateStreet}
        onOpenCreateHouseNumber={onOpenCreateHouseNumber}
        onOpenEditRegion={onOpenEditRegion}
        onOpenEditCity={onOpenEditCity}
        onOpenEditStreet={onOpenEditStreet}
        onOpenEditHouseNumber={onOpenEditHouseNumber}
      />
    );

    expect(screen.getByText('Nord')).toBeTruthy();
    expect(screen.getByText('Musterstadt')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.emptyStreets')).toBeTruthy();
    expect(screen.getByText('masterData.regions.regionId:{"value":"region-1"}')).toBeTruthy();
    expect(screen.getByText('masterData.cities.regionId:{"value":"region-1"}')).toBeTruthy();
    expect(screen.getByText('masterData.houseNumbers.streetId:{"value":"street-1"}')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'masterData.regions.actions.openCreate' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.cities.actions.openCreate' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.streets.actions.openCreate' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.houseNumbers.actions.openCreate' }));

    const editButtons = screen.getAllByRole('button', { name: /masterData\..+\.actions\.edit/ });
    fireEvent.click(editButtons[0]!);
    fireEvent.click(editButtons[1]!);
    fireEvent.click(editButtons[2]!);

    expect(onOpenCreateRegion).toHaveBeenCalledTimes(1);
    expect(onOpenCreateCity).toHaveBeenCalledTimes(1);
    expect(onOpenCreateStreet).toHaveBeenCalledTimes(1);
    expect(onOpenCreateHouseNumber).toHaveBeenCalledTimes(1);
    expect(onOpenEditRegion).toHaveBeenCalledWith(expect.objectContaining({ id: 'region-1' }));
    expect(onOpenEditCity).toHaveBeenCalledWith(expect.objectContaining({ id: 'city-1' }));
    expect(onOpenEditHouseNumber).toHaveBeenCalledWith(expect.objectContaining({ id: 'house-1' }));
    expect(onOpenEditStreet).not.toHaveBeenCalled();
  });

  it('chooses the global scheduling variant when no tours are available and resets state on cancel', () => {
    const controller = {
      availableTours: [],
      globalShiftForm: { id: 'global-1' },
      tourShiftForm: { id: 'tour-1' },
      saving: false,
      setDialogOpen: vi.fn(),
      setGlobalDialogOpen: vi.fn(),
      resetTourShiftForm: vi.fn(),
      resetGlobalShiftForm: vi.fn(),
      setMessage: vi.fn(),
      setGlobalShiftForm: vi.fn(),
      setTourShiftForm: vi.fn(),
      onSubmitGlobalShift: vi.fn(),
      onSubmitTourShift: vi.fn(),
    } as never;

    render(<WasteSchedulingCreateFormView controller={controller} search={createBaseSearch()} />);

    expect(screen.getByText('variant:global')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'cancel-create-view' }));

    expect(controller.setDialogOpen).toHaveBeenCalledWith(false);
    expect(controller.setGlobalDialogOpen).toHaveBeenCalledWith(false);
    expect(controller.resetTourShiftForm).toHaveBeenCalledTimes(1);
    expect(controller.resetGlobalShiftForm).toHaveBeenCalledTimes(1);
    expect(controller.setMessage).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        schedulingView: 'list',
        schedulingEntryType: undefined,
        schedulingEntryId: undefined,
      }),
    });
  });

  it('prefers the tour scheduling variant when tours exist, allows switching to global, and wires both form updaters', () => {
    const controller = {
      availableTours: [{ id: 'tour-1', name: 'Tour 1' }],
      globalShiftForm: { id: 'global-1' },
      tourShiftForm: { id: 'tour-1' },
      saving: true,
      setDialogOpen: vi.fn(),
      setGlobalDialogOpen: vi.fn(),
      resetTourShiftForm: vi.fn(),
      resetGlobalShiftForm: vi.fn(),
      setMessage: vi.fn(),
      setGlobalShiftForm: vi.fn(),
      setTourShiftForm: vi.fn(),
      onSubmitGlobalShift: vi.fn(),
      onSubmitTourShift: vi.fn(),
    } as never;

    render(
      <WasteSchedulingCreateFormView
        controller={controller}
        search={{ ...createBaseSearch(), shiftContext: 'tour' }}
      />
    );

    expect(screen.getByText('variant:tour')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'global-shift' },
    });

    expect(screen.getByText('variant:global')).toBeTruthy();

    const globalProps = schedulingFormContentSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    (globalProps.onChange as (patch: Record<string, unknown>) => void)({ actualDate: '2026-01-02' });
    expect(controller.setGlobalShiftForm).toHaveBeenCalledTimes(1);

    const firstTourProps = schedulingFormContentSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    (firstTourProps.onChange as (patch: Record<string, unknown>) => void)({ actualDate: '2026-12-23' });
    expect(controller.setTourShiftForm).toHaveBeenCalledTimes(1);
  });

  it('renders the tour-assignment dialog with editable validity dates and no explicit tour selector', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();

    render(
      <TourAssignmentsDialog
        open
        mode="edit"
        form={{ tourId: 'tour-1', startDate: '2026-01-01', endDate: '2026-12-31' }}
        tour={{ id: 'tour-1', name: 'Restmüll Nord' } as never}
        locations={[
          {
            id: 'location-1',
            label: 'Musterstraße 1',
            regionId: 'region-1',
            regionName: 'Region A',
            cityId: 'city-1',
            cityName: 'Musterstadt',
            streetId: 'street-1',
            streetName: 'Musterstraße',
            active: true,
            assignedLinkId: 'link-1',
          },
        ] as never}
        tours={[{ id: 'tour-1', name: 'Restmüll Nord' }] as never}
        saving={false}
        loading={false}
        message={null}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByLabelText('tours.assignments.fields.tourId')).toBeNull();
    expect(screen.getByLabelText('tours.assignments.fields.startDate')).toBeTruthy();
    expect(screen.getByLabelText('tours.assignments.fields.endDate')).toBeTruthy();
    expect(screen.getByLabelText('filters.searchLabel')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('tours.assignments.fields.startDate'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('tours.assignments.fields.endDate'), { target: { value: '2026-11-30' } });

    fireEvent.submit(screen.getByRole('button', { name: 'tours.assignments.actions.save' }).closest('form')!);
    expect(onChange).toHaveBeenCalledWith({ startDate: '2026-02-01' });
    expect(onChange).toHaveBeenCalledWith({ endDate: '2026-11-30' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
