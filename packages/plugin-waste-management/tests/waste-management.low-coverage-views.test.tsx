import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementFormSwitch } from '../src/waste-management.form-switch.js';
import { WasteMasterDataLocationsHierarchy } from '../src/waste-management.master-data-locations-hierarchy.js';
import { WasteMasterDataLocationsOverview } from '../src/waste-management.master-data-locations-overview.js';
import { WasteSchedulingCreateFormView } from '../src/waste-management.scheduling-create-form-view.js';
import { WasteSettingsForm } from '../src/waste-management.settings-form.js';

const navigateMock = vi.fn();
const schedulingFormContentSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
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
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type = 'text',
  }: React.ComponentProps<'input'>) => (
    <input id={id} value={value} onChange={onChange} placeholder={placeholder} type={type} />
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
    readonly label: string;
    readonly description?: string;
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
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <WasteSettingsForm
        form={{
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          databaseUrl: 'postgresql://db',
          serviceRoleKey: 'secret',
        }}
        saving={false}
        onSubmit={onSubmit}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('settings.fields.projectUrl'), {
      target: { value: 'https://tenant-b.supabase.co' },
    });
    fireEvent.change(screen.getByLabelText('settings.fields.schemaName'), {
      target: { value: 'custom' },
    });
    fireEvent.change(screen.getByLabelText('settings.fields.databaseUrl'), {
      target: { value: 'postgresql://db-next' },
    });
    fireEvent.change(screen.getByLabelText('settings.fields.serviceRoleKey'), {
      target: { value: 'secret-next' },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'settings.fields.enabled' }));
    fireEvent.submit(screen.getByRole('button', { name: 'settings.actions.save' }).closest('form')!);

    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('common.active')).toBeTruthy();
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

    expect(screen.getByText('masterData.locationsWorkspace.overview.collectionLocationCount:{"value":5}')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.overview.houseNumberCount:{"value":6}')).toBeTruthy();

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
        globalDateShiftId: undefined,
        tourDateShiftId: undefined,
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
      target: { value: 'global' },
    });

    expect(screen.getByText('variant:global')).toBeTruthy();

    const globalProps = schedulingFormContentSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    (globalProps.onChange as (patch: Record<string, unknown>) => void)({ actualDate: '2026-01-02' });
    expect(controller.setGlobalShiftForm).toHaveBeenCalledTimes(1);

    const firstTourProps = schedulingFormContentSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    (firstTourProps.onChange as (patch: Record<string, unknown>) => void)({ actualDate: '2026-12-23' });
    expect(controller.setTourShiftForm).toHaveBeenCalledTimes(1);
  });
});
