import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';

import { WasteManagementPage } from '../src/waste-management.page.js';

const navigateMock = vi.fn();
const searchMock = vi.fn(() => ({
  tab: 'tools',
  q: 'Restmüll',
  page: 2,
  pageSize: 50,
  status: 'active',
  shiftContext: 'tour',
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchMock(),
}));

const wasteManagementApiMocks = vi.hoisted(() => ({
  createWasteManagementCity: vi.fn(async () => ({
    id: 'city-3',
    name: 'Musterstadt West',
    regionId: 'region-1',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementCollectionLocation: vi.fn(async () => ({
    id: 'location-3',
    cityId: 'city-1',
    regionId: 'region-1',
    streetId: 'street-1',
    houseNumberId: 'house-1',
    active: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementLocationTourLinksBulk: vi.fn(async () => ({
    createdCount: 2,
    items: [
      {
        id: 'link-10',
        locationId: 'location-1',
        tourId: 'tour-1',
        startDate: '2026-05-01',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        id: 'link-11',
        locationId: 'location-2',
        tourId: 'tour-1',
        startDate: '2026-05-01',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
    ],
  })),
  createWasteManagementFraction: vi.fn(async () => ({
    id: 'fraction-3',
    name: 'Papier',
    color: '#123456',
    active: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementRegion: vi.fn(async () => ({
    id: 'region-3',
    name: 'Region West',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementTour: vi.fn(async () => ({
    id: 'tour-3',
    name: 'Papier Mitte',
    wasteFractionIds: ['fraction-2'],
    recurrence: 'biweekly',
    firstDate: '2026-05-19',
    active: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementTourDateShift: vi.fn(async () => ({
    id: 'shift-3',
    tourId: 'tour-1',
    originalDate: '2026-12-24',
    actualDate: '2026-12-23',
    hasYear: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementGlobalDateShift: vi.fn(async () => ({
    id: 'global-shift-3',
    originalDate: '2026-01-01',
    actualDate: '2026-01-02',
    hasYear: true,
    tourIds: ['tour-1'],
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementLocationTourLink: vi.fn(async () => ({
    id: 'link-3',
    locationId: 'location-1',
    tourId: 'tour-1',
    startDate: '2026-05-01',
    endDate: '2026-12-31',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  getWasteManagementMasterDataOverview: vi.fn(async () => ({
    fractions: [],
    regions: [],
    cities: [],
    streets: [],
    houseNumbers: [],
    collectionLocations: [],
    locationTourLinks: [],
  })),
  getWasteManagementHistoryOverview: vi.fn(async () => ({
    items: [],
    total: 0,
  })),
  getWasteManagementImportCatalog: vi.fn(() => [
    {
      profileId: 'waste-management.geografie-abholorte',
      displayName: 'Geografie und Abholorte',
      description: 'Importiert Regionen und Abholorte.',
      sourceFormat: 'text/csv',
      requiredColumns: [
        { key: 'region_id', required: true },
        { key: 'city_id', required: true },
      ],
      optionalColumns: [{ key: 'street_id', required: false }],
      validationRules: ['required columns must exist'],
      mappingTemplates: [
        {
          templateId: 'waste-management.geografie-abholorte.canonical-csv-v1',
          displayName: 'Canonical CSV v1',
          description: 'Standardvorlage',
          sourceFormat: 'text/csv',
        },
      ],
    },
  ]),
  getWasteManagementSchedulingOverview: vi.fn(async () => ({
    globalDateShifts: [],
    tourDateShifts: [],
  })),
  getWasteManagementToursOverview: vi.fn(async () => ({
    tours: [],
  })),
  getWasteManagementSettings: vi.fn(async () => null),
  updateWasteManagementSettings: vi.fn(async () => null),
  startWasteManagementMigrations: vi.fn(async () => ({
    id: 'job-1',
    jobTypeId: 'waste-management.apply-migrations',
    status: 'pending',
  })),
  startWasteManagementImport: vi.fn(async () => ({
    id: 'job-import-1',
    jobTypeId: 'waste-management.import-data',
    status: 'pending',
  })),
  startWasteManagementSeed: vi.fn(async () => ({
    id: 'job-2',
    jobTypeId: 'waste-management.seed-data',
    status: 'pending',
  })),
  startWasteManagementReset: vi.fn(async () => ({
    id: 'job-3',
    jobTypeId: 'waste-management.reset-data',
    status: 'pending',
  })),
  updateWasteManagementFraction: vi.fn(async () => ({
    id: 'fraction-1',
    name: 'Restmüll Plus',
    color: '#111111',
    active: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementCity: vi.fn(async () => ({
    id: 'city-1',
    name: 'Musterstadt Nord',
    regionId: 'region-1',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementCollectionLocation: vi.fn(async () => ({
    id: 'location-1',
    cityId: 'city-1',
    regionId: 'region-1',
    streetId: 'street-1',
    houseNumberId: 'house-2',
    active: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementRegion: vi.fn(async () => ({
    id: 'region-1',
    name: 'Region Mitte Plus',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementTour: vi.fn(async () => ({
    id: 'tour-1',
    name: 'Restmüll Nord Plus',
    wasteFractionIds: ['fraction-1'],
    recurrence: 'weekly',
    firstDate: '2026-05-12',
    active: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementTourDateShift: vi.fn(async () => ({
    id: 'shift-1',
    tourId: 'tour-1',
    originalDate: '2026-12-24',
    actualDate: '2026-12-22',
    hasYear: true,
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementGlobalDateShift: vi.fn(async () => ({
    id: 'global-shift-1',
    originalDate: '2026-01-01',
    actualDate: '2026-01-03',
    hasYear: true,
    tourIds: ['tour-1', 'tour-2'],
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementLocationTourLink: vi.fn(async () => ({
    id: 'link-1',
    locationId: 'location-1',
    tourId: 'tour-1',
    startDate: '2026-05-01',
    endDate: '2026-12-31',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
}));

vi.mock('../src/waste-management.api.js', () => wasteManagementApiMocks);

describe('WasteManagementPage', () => {
  beforeEach(() => {
    cleanup();
    navigateMock.mockReset();
    searchMock.mockReset();
    searchMock.mockImplementation(() => ({
      tab: 'tools',
      q: 'Restmüll',
      page: 2,
      pageSize: 50,
      status: 'active',
      shiftContext: 'tour',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockReset();
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockImplementation(async () => ({
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    }));
    wasteManagementApiMocks.getWasteManagementHistoryOverview.mockReset();
    wasteManagementApiMocks.getWasteManagementHistoryOverview.mockImplementation(async () => ({
      items: [],
      total: 0,
    }));
    wasteManagementApiMocks.getWasteManagementImportCatalog.mockReset();
    wasteManagementApiMocks.getWasteManagementImportCatalog.mockImplementation(() => [
      {
        profileId: 'waste-management.geografie-abholorte',
        displayName: 'Geografie und Abholorte',
        description: 'Importiert Regionen und Abholorte.',
        sourceFormat: 'text/csv',
        requiredColumns: [
          { key: 'region_id', required: true },
          { key: 'city_id', required: true },
        ],
        optionalColumns: [{ key: 'street_id', required: false }],
        validationRules: ['required columns must exist'],
        mappingTemplates: [
          {
            templateId: 'waste-management.geografie-abholorte.canonical-csv-v1',
            displayName: 'Canonical CSV v1',
            description: 'Standardvorlage',
            sourceFormat: 'text/csv',
          },
        ],
      },
    ]);
    wasteManagementApiMocks.getWasteManagementSettings.mockReset();
    wasteManagementApiMocks.getWasteManagementSettings.mockImplementation(async () => null);
    wasteManagementApiMocks.getWasteManagementToursOverview.mockReset();
    wasteManagementApiMocks.getWasteManagementToursOverview.mockImplementation(async () => ({
      tours: [],
    }));
    wasteManagementApiMocks.getWasteManagementSchedulingOverview.mockReset();
    wasteManagementApiMocks.getWasteManagementSchedulingOverview.mockImplementation(async () => ({
      globalDateShifts: [],
      tourDateShifts: [],
    }));
    wasteManagementApiMocks.updateWasteManagementSettings.mockReset();
    wasteManagementApiMocks.updateWasteManagementSettings.mockImplementation(async () => null);
    wasteManagementApiMocks.createWasteManagementFraction.mockReset();
    wasteManagementApiMocks.createWasteManagementFraction.mockImplementation(async () => ({
      id: 'fraction-3',
      name: 'Papier',
      color: '#123456',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementCity.mockReset();
    wasteManagementApiMocks.createWasteManagementCity.mockImplementation(async () => ({
      id: 'city-3',
      name: 'Musterstadt West',
      regionId: 'region-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementCollectionLocation.mockReset();
    wasteManagementApiMocks.createWasteManagementCollectionLocation.mockImplementation(async () => ({
      id: 'location-3',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementLocationTourLinksBulk.mockReset();
    wasteManagementApiMocks.createWasteManagementLocationTourLinksBulk.mockImplementation(async () => ({
      createdCount: 2,
      items: [
        {
          id: 'link-10',
          locationId: 'location-1',
          tourId: 'tour-1',
          startDate: '2026-05-01',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
        {
          id: 'link-11',
          locationId: 'location-2',
          tourId: 'tour-1',
          startDate: '2026-05-01',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    }));
    wasteManagementApiMocks.createWasteManagementRegion.mockReset();
    wasteManagementApiMocks.createWasteManagementRegion.mockImplementation(async () => ({
      id: 'region-3',
      name: 'Region West',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementTour.mockReset();
    wasteManagementApiMocks.createWasteManagementTour.mockImplementation(async () => ({
      id: 'tour-3',
      name: 'Papier Mitte',
      wasteFractionIds: ['fraction-2'],
      recurrence: 'biweekly',
      firstDate: '2026-05-19',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementTourDateShift.mockReset();
    wasteManagementApiMocks.createWasteManagementTourDateShift.mockImplementation(async () => ({
      id: 'shift-3',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-23',
      hasYear: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementGlobalDateShift.mockReset();
    wasteManagementApiMocks.createWasteManagementGlobalDateShift.mockImplementation(async () => ({
      id: 'global-shift-3',
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      hasYear: true,
      tourIds: ['tour-1'],
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementLocationTourLink.mockReset();
    wasteManagementApiMocks.createWasteManagementLocationTourLink.mockImplementation(async () => ({
      id: 'link-3',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.startWasteManagementMigrations.mockReset();
    wasteManagementApiMocks.startWasteManagementMigrations.mockImplementation(async () => ({
      id: 'job-1',
      jobTypeId: 'waste-management.apply-migrations',
      status: 'pending',
    }));
    wasteManagementApiMocks.startWasteManagementImport.mockReset();
    wasteManagementApiMocks.startWasteManagementImport.mockImplementation(async () => ({
      id: 'job-import-1',
      jobTypeId: 'waste-management.import-data',
      status: 'pending',
    }));
    wasteManagementApiMocks.startWasteManagementSeed.mockReset();
    wasteManagementApiMocks.startWasteManagementSeed.mockImplementation(async () => ({
      id: 'job-2',
      jobTypeId: 'waste-management.seed-data',
      status: 'pending',
    }));
    wasteManagementApiMocks.startWasteManagementReset.mockReset();
    wasteManagementApiMocks.startWasteManagementReset.mockImplementation(async () => ({
      id: 'job-3',
      jobTypeId: 'waste-management.reset-data',
      status: 'pending',
    }));
    wasteManagementApiMocks.updateWasteManagementFraction.mockReset();
    wasteManagementApiMocks.updateWasteManagementFraction.mockImplementation(async () => ({
      id: 'fraction-1',
      name: 'Restmüll Plus',
      color: '#111111',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    wasteManagementApiMocks.updateWasteManagementCity.mockReset();
    wasteManagementApiMocks.updateWasteManagementCity.mockImplementation(async () => ({
      id: 'city-1',
      name: 'Musterstadt Nord',
      regionId: 'region-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    wasteManagementApiMocks.updateWasteManagementCollectionLocation.mockReset();
    wasteManagementApiMocks.updateWasteManagementCollectionLocation.mockImplementation(async () => ({
      id: 'location-1',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-2',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    wasteManagementApiMocks.updateWasteManagementRegion.mockReset();
    wasteManagementApiMocks.updateWasteManagementRegion.mockImplementation(async () => ({
      id: 'region-1',
      name: 'Region Mitte Plus',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    wasteManagementApiMocks.updateWasteManagementLocationTourLink.mockReset();
    wasteManagementApiMocks.updateWasteManagementLocationTourLink.mockImplementation(async () => ({
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    wasteManagementApiMocks.updateWasteManagementTour.mockReset();
    wasteManagementApiMocks.updateWasteManagementTour.mockImplementation(async () => ({
      id: 'tour-1',
      name: 'Restmüll Nord Plus',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'weekly',
      firstDate: '2026-05-12',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    wasteManagementApiMocks.updateWasteManagementTourDateShift.mockReset();
    wasteManagementApiMocks.updateWasteManagementTourDateShift.mockImplementation(async () => ({
      id: 'shift-1',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-22',
      hasYear: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    wasteManagementApiMocks.updateWasteManagementGlobalDateShift.mockReset();
    wasteManagementApiMocks.updateWasteManagementGlobalDateShift.mockImplementation(async () => ({
      id: 'global-shift-1',
      originalDate: '2026-01-01',
      actualDate: '2026-01-03',
      hasYear: true,
      tourIds: ['tour-1', 'tour-2'],
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
    }));
    registerPluginTranslationResolver((key, variables) => {
      if (variables && typeof variables === 'object') {
        return Object.entries(variables as Record<string, string | number>).reduce(
          (message, [name, value]) => message.replace(`{{${name}}}`, String(value)),
          key
        );
      }
      return key;
    });
  });

  it('renders the plugin shell from normalized search params and deep-links to settings', async () => {
    render(<WasteManagementPage />);

    expect(screen.getByText('wasteManagement.page.title')).toBeTruthy();
    expect(screen.getByDisplayValue('Restmüll')).toBeTruthy();
    expect(screen.getByText('wasteManagement.tools.migrations.title')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.actions.openSettings' }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        tab: 'settings',
        q: 'Restmüll',
        page: 1,
        pageSize: 50,
        status: 'active',
        shiftContext: 'tour',
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.actions.startSeed' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.startWasteManagementSeed).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('wasteManagement.tools.messages.jobStarted')).toBeTruthy();
    expect(screen.getByText('wasteManagement.tools.meta.lastJobTitle')).toBeTruthy();
    expect(screen.getByText(/wasteManagement\.tools\.meta\.jobStatusLabel:/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'wasteManagement.tools.actions.openJob' })).toBeTruthy();
  });

  it('starts the import job through the waste tools facade', async () => {
    render(<WasteManagementPage />);

    const blobRefInput = screen
      .getByText('wasteManagement.tools.imports.blobRefLabel')
      .parentElement?.querySelector('input');
    if (!(blobRefInput instanceof HTMLInputElement)) {
      throw new Error('Expected import blobRef input to be rendered');
    }
    fireEvent.change(blobRefInput, {
      target: { value: 'blob:waste/imports/catalog.csv' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.actions.startImport' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.startWasteManagementImport).toHaveBeenCalledWith({
        importProfileId: 'waste-management.geografie-abholorte',
        blobRef: 'blob:waste/imports/catalog.csv',
        dryRun: true,
      });
    });
  });

  it('confirms and starts the reset job through the high-risk tools dialog', async () => {
    render(<WasteManagementPage />);

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.actions.startReset' }));
    fireEvent.change(screen.getByLabelText('wasteManagement.tools.reset.tokenLabel'), {
      target: { value: 'RESET' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.reset.confirmAction' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.startWasteManagementReset).toHaveBeenCalledWith({
        confirmationToken: 'RESET',
      });
    });
  });

  it('loads and renders the audit-based overview history', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'overview',
      q: 'fraction',
      page: 1,
      pageSize: 10,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementHistoryOverview.mockImplementation(async () => ({
      total: 1,
      items: [
        {
          id: 'log-1',
          actionId: 'waste-management.fraction.created',
          actionNamespace: 'waste-management',
          actionOwner: 'waste-management',
          outcome: 'success',
          occurredAt: '2026-05-09T12:00:00.000Z',
          resourceType: 'waste_fraction',
          resourceId: 'fraction-1',
          requestId: 'req-1',
        },
      ],
    }));

    render(<WasteManagementPage />);

    await screen.findByText('waste-management.fraction.created');
    expect(wasteManagementApiMocks.getWasteManagementHistoryOverview).toHaveBeenCalledWith({
      q: 'fraction',
      page: 1,
      pageSize: 10,
    });
    expect(screen.getByText('wasteManagement.overview.outcome.success')).toBeTruthy();
  });

  it('loads and saves settings through the host api client', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'settings',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementSettings.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
    });
    wasteManagementApiMocks.updateWasteManagementSettings.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByDisplayValue('https://tenant-a.supabase.co'), {
      target: { value: 'https://tenant-b.supabase.co' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.settings.actions.save' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.updateWasteManagementSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          projectUrl: 'https://tenant-b.supabase.co',
          schemaName: 'wm',
          enabled: true,
        })
      );
    });
  });

  it('loads and renders the filtered master-data overview', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'master-data',
      q: 'Rest',
      page: 1,
      pageSize: 25,
      status: 'active',
      shiftContext: 'all',
      regionId: 'region-1',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValueOnce({
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
        {
          id: 'fraction-2',
          name: 'Biomüll',
          color: '#008000',
          active: false,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      regions: [
        {
          id: 'region-1',
          name: 'Region Mitte',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterstadt',
          regionId: 'region-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
        {
          id: 'city-2',
          name: 'Nebenort',
          regionId: 'region-2',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          name: 'Hauptstraße',
          cityId: 'city-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      houseNumbers: [
        {
          id: 'house-1',
          number: '12',
          streetId: 'street-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      collectionLocations: [
        {
          id: 'location-1',
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      locationTourLinks: [],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Restmüll')).toBeTruthy();
    expect(screen.queryByText('Biomüll')).toBeNull();
    expect(screen.getByText('Region Mitte')).toBeTruthy();
    expect(screen.getByText('Musterstadt')).toBeTruthy();
    expect(screen.queryByText('Nebenort')).toBeNull();
  });

  it('creates a waste fraction from the master-data dialog and reloads the overview', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'master-data',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview
      .mockResolvedValueOnce({
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      })
      .mockResolvedValueOnce({
        fractions: [
          {
            id: 'fraction-3',
            name: 'Papier',
            color: '#123456',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.fractions.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.fractions.fields.name'), {
      target: { value: 'Papier' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.fractions.fields.color'), {
      target: { value: '#123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.fractions.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementFraction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Papier',
          color: '#123456',
          active: true,
        })
      );
    });
  });

  it('creates a waste region from the master-data dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'master-data',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValueOnce({
      fractions: [],
      regions: [
        {
          id: 'region-1',
          name: 'Region Mitte',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.regions.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.regions.fields.name'), {
      target: { value: 'Region West' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.regions.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementRegion).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Region West',
        })
      );
    });
  });

  it('creates a waste city from the master-data dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'master-data',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValueOnce({
      fractions: [],
      regions: [
        {
          id: 'region-1',
          name: 'Region Mitte',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterstadt',
          regionId: 'region-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          name: 'Hauptstraße',
          cityId: 'city-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      houseNumbers: [
        {
          id: 'house-1',
          number: '12',
          streetId: 'street-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      collectionLocations: [],
      locationTourLinks: [],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.cities.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.cities.fields.name'), {
      target: { value: 'Musterstadt West' },
    });
    const regionSelect = document.getElementById('waste-city-region-id') as HTMLSelectElement | null;
    expect(regionSelect).toBeTruthy();
    if (!regionSelect) {
      throw new Error('missing waste city region select');
    }
    regionSelect.value = 'region-1';
    fireEvent.change(regionSelect);
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.cities.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementCity).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Musterstadt West',
        })
      );
    });
  });

  it('creates a waste collection location from the master-data dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'master-data',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValueOnce({
      fractions: [],
      regions: [
        {
          id: 'region-1',
          name: 'Region Mitte',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterstadt',
          regionId: 'region-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          name: 'Hauptstraße',
          cityId: 'city-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      houseNumbers: [
        {
          id: 'house-1',
          number: '12',
          streetId: 'street-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      collectionLocations: [],
      locationTourLinks: [],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'wasteManagement.masterData.collectionLocations.actions.openCreate' })
    );
    const citySelect = document.getElementById('waste-location-city-id') as HTMLSelectElement | null;
    const streetSelect = document.getElementById('waste-location-street-id') as HTMLSelectElement | null;
    const houseNumberSelect = document.getElementById('waste-location-house-number-id') as HTMLSelectElement | null;
    expect(citySelect).toBeTruthy();
    expect(streetSelect).toBeTruthy();
    expect(houseNumberSelect).toBeTruthy();
    if (!citySelect || !streetSelect || !houseNumberSelect) {
      throw new Error('missing collection location selects');
    }
    citySelect.value = 'city-1';
    fireEvent.change(citySelect);
    streetSelect.value = 'street-1';
    fireEvent.change(streetSelect);
    houseNumberSelect.value = 'house-1';
    fireEvent.change(houseNumberSelect);
    fireEvent.click(
      screen.getByRole('button', { name: 'wasteManagement.masterData.collectionLocations.actions.create' })
    );

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementCollectionLocation).toHaveBeenCalledTimes(1);
    });
  });

  it('creates waste location-tour links in bulk from selected collection locations', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'master-data',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview
      .mockResolvedValueOnce({
        fractions: [],
        regions: [
          {
            id: 'region-1',
            name: 'Region Mitte',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        cities: [
          {
            id: 'city-1',
            name: 'Musterstadt',
            regionId: 'region-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        streets: [],
        houseNumbers: [],
        collectionLocations: [
          {
            id: 'location-1',
            cityId: 'city-1',
            regionId: 'region-1',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'location-2',
            cityId: 'city-1',
            regionId: 'region-1',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        locationTourLinks: [],
      })
      .mockResolvedValueOnce({
        fractions: [],
        regions: [
          {
            id: 'region-1',
            name: 'Region Mitte',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        cities: [
          {
            id: 'city-1',
            name: 'Musterstadt',
            regionId: 'region-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        streets: [],
        houseNumbers: [],
        collectionLocations: [
          {
            id: 'location-1',
            cityId: 'city-1',
            regionId: 'region-1',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'location-2',
            cityId: 'city-1',
            regionId: 'region-1',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        locationTourLinks: [],
      });
    wasteManagementApiMocks.getWasteManagementToursOverview.mockResolvedValue({
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    const locationCheckboxes = screen.getAllByRole('checkbox');
    fireEvent.click(locationCheckboxes[1]!);
    fireEvent.click(locationCheckboxes[2]!);
    fireEvent.click(
      screen.getByRole('button', { name: 'wasteManagement.masterData.collectionLocations.bulk.actions.openAssign' })
    );

    const bulkTourSelect = document.getElementById('waste-bulk-tour-link-tour-id') as HTMLSelectElement | null;
    expect(bulkTourSelect).toBeTruthy();
    if (!bulkTourSelect) {
      throw new Error('missing bulk tour select');
    }
    bulkTourSelect.value = 'tour-1';
    fireEvent.change(bulkTourSelect);
    fireEvent.click(
      screen.getByRole('button', { name: 'wasteManagement.masterData.collectionLocations.bulk.actions.assign' })
    );

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementLocationTourLinksBulk).toHaveBeenCalledWith({
        locationIds: ['location-1', 'location-2'],
        tourId: 'tour-1',
        startDate: undefined,
        endDate: undefined,
      });
    });
  });

  it('loads and renders the filtered tours overview', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'tours',
      q: 'Rest',
      page: 1,
      pageSize: 25,
      status: 'active',
      shiftContext: 'all',
      wasteFractionId: 'fraction-1',
    }));
    wasteManagementApiMocks.getWasteManagementToursOverview.mockResolvedValue({
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          description: 'Wöchentliche Innenstadt-Tour',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          endDate: '2026-12-31',
          active: true,
          locationCount: 12,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
        {
          id: 'tour-2',
          name: 'Biomüll Süd',
          wasteFractionIds: ['fraction-2'],
          recurrence: 'weekly',
          active: false,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Restmüll Nord')).toBeTruthy();
    expect(screen.getByText('Wöchentliche Innenstadt-Tour')).toBeTruthy();
    expect(screen.queryByText('Biomüll Süd')).toBeNull();
  });

  it('creates a waste tour from the tours dialog and reloads the overview', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'tours',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValue({
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      regions: [],
      cities: [],
      streets: [
        {
          id: 'street-1',
          name: 'Hauptstraße',
          cityId: 'city-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      houseNumbers: [
        {
          id: 'house-1',
          number: '12',
          streetId: 'street-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      collectionLocations: [
        {
          id: 'location-1',
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      locationTourLinks: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          startDate: '2026-05-01',
          endDate: '2026-12-31',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    });
    wasteManagementApiMocks.getWasteManagementToursOverview
      .mockResolvedValueOnce({ tours: [] })
      .mockResolvedValueOnce({
        tours: [
          {
            id: 'tour-3',
            name: 'Papier Mitte',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'biweekly',
            firstDate: '2026-05-19',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
      });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tours.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.name'), {
      target: { value: 'Papier Mitte' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.recurrence'), {
      target: { value: 'biweekly' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.firstDate'), {
      target: { value: '2026-05-19' },
    });
    fireEvent.click(screen.getByText('Restmüll'));
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tours.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementTour).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Papier Mitte',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'biweekly',
          firstDate: '2026-05-19',
        })
      );
    });
  });

  it('loads and renders the filtered scheduling overview', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'scheduling',
      q: 'Feier',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'global',
      tourId: 'tour-1',
    }));
    wasteManagementApiMocks.getWasteManagementSchedulingOverview.mockResolvedValueOnce({
      globalDateShifts: [
        {
          id: 'global-shift-1',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          description: 'Feiertagsverschiebung',
          tourIds: ['tour-1'],
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      tourDateShifts: [
        {
          id: 'tour-shift-1',
          tourId: 'tour-2',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
          description: 'Vorverlegt',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Feiertagsverschiebung')).toBeTruthy();
    expect(screen.queryByText('Vorverlegt')).toBeNull();
  });

  it('creates a tour-related waste date shift from the scheduling dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'scheduling',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'tour',
    }));
    wasteManagementApiMocks.getWasteManagementToursOverview.mockResolvedValue({
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    });
    wasteManagementApiMocks.getWasteManagementSchedulingOverview
      .mockResolvedValueOnce({ globalDateShifts: [], tourDateShifts: [] })
      .mockResolvedValueOnce({
        globalDateShifts: [],
        tourDateShifts: [
          {
            id: 'shift-3',
            tourId: 'tour-1',
            originalDate: '2026-12-24',
            actualDate: '2026-12-23',
            hasYear: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
      });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.scheduling.tour.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.originalDate'), {
      target: { value: '2026-12-24' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.actualDate'), {
      target: { value: '2026-12-23' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.scheduling.tour.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementTourDateShift).toHaveBeenCalledWith(
        expect.objectContaining({
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
        })
      );
    });
  });

  it('creates a global waste date shift from the scheduling dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'scheduling',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'global',
    }));
    wasteManagementApiMocks.getWasteManagementToursOverview.mockResolvedValue({
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    });
    wasteManagementApiMocks.getWasteManagementSchedulingOverview
      .mockResolvedValueOnce({ globalDateShifts: [], tourDateShifts: [] })
      .mockResolvedValueOnce({
        globalDateShifts: [
          {
            id: 'global-shift-3',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            hasYear: true,
            tourIds: ['tour-1'],
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        tourDateShifts: [],
      });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.scheduling.global.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.global.fields.originalDate'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.global.fields.actualDate'), {
      target: { value: '2026-01-02' },
    });
    fireEvent.click(screen.getByText('Restmüll Nord'));
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.scheduling.global.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementGlobalDateShift).toHaveBeenCalledWith(
        expect.objectContaining({
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          tourIds: ['tour-1'],
        })
      );
    });
  });
});
