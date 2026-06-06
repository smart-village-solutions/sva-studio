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

const clickMenuItemContaining = (textFragment: string) => {
  const menuItem = screen
    .getAllByRole('menuitem')
    .find((candidate) => candidate.textContent?.includes(textFragment));
  expect(menuItem).toBeDefined();
  if (!menuItem) {
    throw new Error(`missing menu item containing ${textFragment}`);
  }
  fireEvent.click(menuItem);
};

vi.mock('../src/waste-management.ui-access.js', () => ({
  deriveWasteManagementUiAccess: () => ({
    visibleTabIds: ['fractions', 'tours', 'locations', 'scheduling', 'output', 'tools', 'settings'],
    canAccessSettings: true,
    canAccessTools: true,
    canDuplicateTour: true,
    canRunInitialize: true,
    canRunMigrations: true,
    canRunImport: true,
    canRunSeed: true,
    canRunReset: true,
  }),
  useWasteManagementUiAccess: () => ({
    isResolved: true,
    visibleTabIds: ['fractions', 'tours', 'locations', 'scheduling', 'output', 'tools', 'settings'],
    canAccessSettings: true,
    canAccessTools: true,
    canDuplicateTour: true,
    canRunInitialize: true,
    canRunMigrations: true,
    canRunImport: true,
    canRunSeed: true,
    canRunReset: true,
  }),
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
  createWasteManagementHouseNumber: vi.fn(async () => ({
    id: 'house-3',
    number: '42a',
    streetId: 'street-1',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementRegion: vi.fn(async () => ({
    id: 'region-3',
    name: 'Region West',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T10:00:00.000Z',
  })),
  createWasteManagementStreet: vi.fn(async () => ({
    id: 'street-3',
    name: 'Bahnhofstraße',
    cityId: 'city-1',
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
    audit: { items: [], total: 0 },
    technical: { items: [], total: 0 },
  })),
  getWasteManagementImportCatalog: vi.fn(() => [
    {
      profileId: 'waste-management.geografie-abholorte',
      displayName: 'Geografie und Abholorte',
      description: 'Importiert Regionen und Abholorte.',
      sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
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
        {
          templateId: 'waste-management.geografie-abholorte.canonical-xlsx-v1',
          displayName: 'Canonical XLSX v1',
          description: 'Excel-Vorlage',
          sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
  startWasteManagementInitialize: vi.fn(async () => ({
    id: 'job-0',
    jobTypeId: 'waste-management.initialize-data-source',
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
  updateWasteManagementHouseNumber: vi.fn(async () => ({
    id: 'house-1',
    number: '14',
    streetId: 'street-1',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  })),
  updateWasteManagementStreet: vi.fn(async () => ({
    id: 'street-1',
    name: 'Hauptstraße Nord',
    cityId: 'city-1',
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
      audit: { items: [], total: 0 },
      technical: { items: [], total: 0 },
    }));
    wasteManagementApiMocks.getWasteManagementImportCatalog.mockReset();
    wasteManagementApiMocks.getWasteManagementImportCatalog.mockImplementation(() => [
      {
        profileId: 'waste-management.geografie-abholorte',
        displayName: 'Geografie und Abholorte',
        description: 'Importiert Regionen und Abholorte.',
        sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
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
          {
            templateId: 'waste-management.geografie-abholorte.canonical-xlsx-v1',
            displayName: 'Canonical XLSX v1',
            description: 'Excel-Vorlage',
            sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
    wasteManagementApiMocks.createWasteManagementHouseNumber.mockReset();
    wasteManagementApiMocks.createWasteManagementHouseNumber.mockImplementation(async () => ({
      id: 'house-3',
      number: '42a',
      streetId: 'street-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementRegion.mockReset();
    wasteManagementApiMocks.createWasteManagementRegion.mockImplementation(async () => ({
      id: 'region-3',
      name: 'Region West',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));
    wasteManagementApiMocks.createWasteManagementStreet.mockReset();
    wasteManagementApiMocks.createWasteManagementStreet.mockImplementation(async () => ({
      id: 'street-3',
      name: 'Bahnhofstraße',
      cityId: 'city-1',
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
    wasteManagementApiMocks.startWasteManagementInitialize.mockReset();
    wasteManagementApiMocks.startWasteManagementInitialize.mockImplementation(async () => ({
      id: 'job-0',
      jobTypeId: 'waste-management.initialize-data-source',
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
    wasteManagementApiMocks.updateWasteManagementHouseNumber.mockReset();
    wasteManagementApiMocks.updateWasteManagementHouseNumber.mockImplementation(async () => ({
      id: 'house-1',
      number: '14',
      streetId: 'street-1',
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
    wasteManagementApiMocks.updateWasteManagementStreet.mockReset();
    wasteManagementApiMocks.updateWasteManagementStreet.mockImplementation(async () => ({
      id: 'street-1',
      name: 'Hauptstraße Nord',
      cityId: 'city-1',
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

  it('renders the plugin shell from normalized search params without a redundant settings shortcut', async () => {
    wasteManagementApiMocks.getWasteManagementSettings.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [],
    });

    render(<WasteManagementPage />);

    expect(screen.getByText('wasteManagement.page.title')).toBeTruthy();
    const webVersionLink = await screen.findByRole('link', {
      name: 'wasteManagement.page.webVersionLinkLabel',
    });
    expect(webVersionLink.getAttribute('href')).toBe('https://bb-prignitz.abfallkalender.smart-village.app/');
    expect(screen.queryByDisplayValue('Restmüll')).toBeNull();
    expect(screen.queryByLabelText('wasteManagement.filters.searchLabel')).toBeNull();
    expect(screen.queryByLabelText('wasteManagement.filters.statusLabel')).toBeNull();
    expect(screen.queryByLabelText('wasteManagement.filters.shiftContextLabel')).toBeNull();
    expect(screen.queryByText(/wasteManagement\.meta\.search:/)).toBeNull();
    const expectedTabs = [
      'wasteManagement.tabs.fractions.title',
      'wasteManagement.tabs.tours.title',
      'wasteManagement.tabs.locations.title',
      'wasteManagement.tabs.scheduling.title',
      'wasteManagement.tabs.output.title',
      'wasteManagement.tabs.tools.title',
      'wasteManagement.tabs.settings.title',
    ];
    for (const tabLabel of expectedTabs) {
      const tab = screen.getByRole('tab', { name: tabLabel });
      expect(tab.querySelector('svg')).toBeTruthy();
      expect(tab.querySelector('[data-icon-library="tabler"]')).toBeTruthy();
    }
    expect(screen.getAllByText('wasteManagement.tools.meta.advancedTitle').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'wasteManagement.actions.openSettings' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.meta.advancedTitle' }));
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.actions.startSeed' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.startWasteManagementSeed).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('wasteManagement.tools.messages.jobStarted')).toBeTruthy();
    expect(await screen.findByText('wasteManagement.tools.meta.lastJobTitle')).toBeTruthy();
    expect(await screen.findByText(/wasteManagement\.tools\.meta\.jobStatusLabel:/)).toBeTruthy();
  });

  it('starts the import job through the waste tools facade with an explicit xlsx source format', async () => {
    class MockFileReader {
      public result: string | null = null;
      public error: DOMException | null = null;
      public onload: null | (() => void) = null;
      public onerror: null | (() => void) = null;

      readAsDataURL(file: Blob) {
        this.result = `data:${file.type};base64,ZmFrZQ==`;
        this.onload?.();
      }
    }

    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);
    render(<WasteManagementPage />);

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.imports.wizard.actions.continue' }));

    const sourceFormatSelect = await screen.findByLabelText('wasteManagement.tools.imports.sourceFormatLabel');
    fireEvent.change(sourceFormatSelect, {
      target: { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    });
    const blobRefInput = document.querySelector('input[type="file"]');
    if (!(blobRefInput instanceof HTMLInputElement)) {
      throw new Error('Expected import blobRef input to be rendered');
    }
    fireEvent.change(blobRefInput, {
      target: {
        files: [
          new File(['catalog'], 'catalog.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ],
      },
    });
    const continueToConfirmationButton = await screen.findByRole('button', {
      name: 'wasteManagement.tools.imports.wizard.actions.continueToConfirmation',
    });
    fireEvent.click(continueToConfirmationButton);
    const startImportButton = screen.getByRole('button', { name: 'wasteManagement.tools.actions.startImport' });
    fireEvent.click(startImportButton);

    await waitFor(() => {
      expect(wasteManagementApiMocks.startWasteManagementImport).toHaveBeenCalledWith({
        importProfileId: 'waste-management.geografie-abholorte',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        blobRef: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,ZmFrZQ==',
        dryRun: false,
      });
    });

    vi.unstubAllGlobals();
  });

  it('starts the initialize job through the waste tools facade', async () => {
    render(<WasteManagementPage />);

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.meta.advancedTitle' }));
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.audit.dataSourceInitialized' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.startWasteManagementInitialize).toHaveBeenCalledWith({
        targetSchema: 'public',
      });
    });
  });

  it('confirms and starts the reset job through the high-risk tools dialog', async () => {
    render(<WasteManagementPage />);

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.tools.meta.advancedTitle' }));
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

  it('loads and renders the technical waste history in Datentools', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'tools',
      q: '',
      page: 1,
      pageSize: 10,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementHistoryOverview.mockImplementation(async () => ({
      audit: {
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
      },
      technical: {
        total: 1,
        items: [
          {
            id: 'job-1',
            eventType: 'migration.succeeded',
            outcome: 'success',
            occurredAt: '2026-05-09T12:05:00.000Z',
            source: 'job',
            jobId: 'job-1',
            jobTypeId: 'waste-management.apply-migrations',
          },
        ],
      },
    }));

    render(<WasteManagementPage />);

    expect((await screen.findAllByText('migration.succeeded')).length).toBeGreaterThan(0);
    expect(wasteManagementApiMocks.getWasteManagementHistoryOverview).toHaveBeenCalledWith({
      page: 1,
      pageSize: 8,
    });
    expect(screen.getAllByText('wasteManagement.overview.outcome.success').length).toBeGreaterThan(0);
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
    wasteManagementApiMocks.getWasteManagementSettings.mockImplementation(async () => ({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      selectedInterfaceName: 'Supabase A',
      selectedInterfaceTypeKey: 'supabase',
      availableInterfaces: [
        {
          id: 'supabase-1',
          name: 'Supabase A',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
      ],
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
    }));
    wasteManagementApiMocks.updateWasteManagementSettings.mockImplementation(async () => ({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      selectedInterfaceName: 'Supabase A',
      selectedInterfaceTypeKey: 'supabase',
      availableInterfaces: [
        {
          id: 'supabase-1',
          name: 'Supabase A',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
      ],
      calendarWebUrl: 'https://abfall.example.de',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
    }));

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementSettings).toHaveBeenCalledTimes(2);
    });

    const calendarWebUrlInput = await screen.findByLabelText('wasteManagement.settings.fields.calendarWebUrl');

    await waitFor(() => {
      expect((calendarWebUrlInput as HTMLInputElement).value).toBe(
        'https://bb-prignitz.abfallkalender.smart-village.app/'
      );
    });

    fireEvent.change(calendarWebUrlInput, {
      target: { value: 'https://abfall.example.de' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'wasteManagement.settings.actions.save' })[1]);

    await waitFor(() => {
      expect(wasteManagementApiMocks.updateWasteManagementSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedInterfaceId: 'supabase-1',
          calendarWebUrl: 'https://abfall.example.de',
        })
      );
    });
  });

  it('keeps the settings page stable when selecting an interval for a custom recurrence preset draft', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'settings',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementSettings.mockImplementation(async () => ({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      selectedInterfaceName: 'Supabase A',
      selectedInterfaceTypeKey: 'supabase',
      availableInterfaces: [
        {
          id: 'supabase-1',
          name: 'Supabase A',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
      ],
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [],
    }));

    render(<WasteManagementPage />);

    const intervalSelect = await screen.findByLabelText(
      'wasteManagement.settings.fields.customRecurrenceIntervalDays'
    );

    fireEvent.change(intervalSelect, {
      target: { value: '14' },
    });

    await waitFor(() => {
      expect((intervalSelect as HTMLSelectElement).value).toBe('14');
    });
    expect(screen.getByLabelText('wasteManagement.settings.fields.customRecurrenceName')).toBeTruthy();
  });

  it('adds a custom recurrence preset draft without crashing after choosing an interval', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'settings',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementSettings.mockImplementation(async () => ({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      selectedInterfaceName: 'Supabase A',
      selectedInterfaceTypeKey: 'supabase',
      availableInterfaces: [
        {
          id: 'supabase-1',
          name: 'Supabase A',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
      ],
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [],
    }));
    wasteManagementApiMocks.updateWasteManagementSettings.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      selectedInterfaceName: 'Supabase A',
      selectedInterfaceTypeKey: 'supabase',
      availableInterfaces: [
        {
          id: 'supabase-1',
          name: 'Supabase A',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
      ],
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [
        {
          id: 'custom-14-days',
          name: '14 Tage',
          description: '',
          intervalDays: 14,
        },
      ],
    });

    render(<WasteManagementPage />);

    const nameInput = await screen.findByLabelText('wasteManagement.settings.fields.customRecurrenceName');
    const intervalSelect = screen.getByLabelText('wasteManagement.settings.fields.customRecurrenceIntervalDays');

    fireEvent.change(nameInput, {
      target: { value: '14 Tage' },
    });
    fireEvent.change(intervalSelect, {
      target: { value: '14' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.settings.actions.addCustomRecurrence' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.updateWasteManagementSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          customRecurrencePresets: [
            expect.objectContaining({
              name: '14 Tage',
              intervalDays: 14,
            }),
          ],
        })
      );
    });
    expect(await screen.findByText('14 Tage')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'wasteManagement.settings.actions.saveCustomRecurrences' })).toBeNull();
  });

  it('loads and renders the filtered master-data overview', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'fractions',
      masterDataTab: 'fractions',
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

    expect(screen.getAllByText('Restmüll').length).toBeGreaterThan(0);
    expect(screen.queryByText('Biomüll')).toBeNull();
  });

  it('creates a waste fraction from the master-data dialog and reloads the overview', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'fractions',
      masterDataTab: 'fractions',
      fractionsView: 'create',
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

    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.fractions.fields.name'), {
      target: { value: 'Papier' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.fractions.fields.description'), {
      target: { value: 'Blaue Tonne' },
    });
    fireEvent.change(document.getElementById('waste-fraction-color-text') as HTMLInputElement, {
      target: { value: '#123456' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'wasteManagement.masterData.fractions.createView.actions.savePrimary' })[0]!);

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementFraction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Papier',
          description: 'Blaue Tonne',
          color: '#123456',
          active: true,
        })
      );
    });
  });

  it('creates a waste region from the master-data dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'locations',
      masterDataTab: 'locations',
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

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.locationsWorkspace.actions.createMenu' }));
    clickMenuItemContaining('wasteManagement.masterData.locationsWorkspace.actions.createRegion');
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
      tab: 'locations',
      masterDataTab: 'locations',
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

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.locationsWorkspace.actions.createMenu' }));
    clickMenuItemContaining('wasteManagement.masterData.locationsWorkspace.actions.createCity');
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

  it('creates a waste street from the master-data dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'locations',
      masterDataTab: 'locations',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValueOnce({
      fractions: [],
      regions: [],
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
      collectionLocations: [],
      locationTourLinks: [],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.locationsWorkspace.actions.createMenu' }));
    clickMenuItemContaining('wasteManagement.masterData.locationsWorkspace.actions.createStreet');
    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.streets.fields.name'), {
      target: { value: 'Bahnhofstraße' },
    });
    const streetCitySelect = document.getElementById('waste-street-city-id') as HTMLSelectElement | null;
    expect(streetCitySelect).toBeTruthy();
    if (!streetCitySelect) {
      throw new Error('missing waste street city select');
    }
    streetCitySelect.value = 'city-1';
    fireEvent.change(streetCitySelect);
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.streets.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementStreet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bahnhofstraße',
        })
      );
    });
  });

  it('creates a waste house number from the master-data dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'locations',
      masterDataTab: 'locations',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValueOnce({
      fractions: [],
      regions: [],
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
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    });

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.locationsWorkspace.actions.createMenu' }));
    clickMenuItemContaining('wasteManagement.masterData.locationsWorkspace.actions.createHouseNumber');
    fireEvent.change(screen.getByLabelText('wasteManagement.masterData.houseNumbers.fields.number'), {
      target: { value: '42a' },
    });
    const houseNumberStreetSelect = document.getElementById('waste-house-number-street-id') as HTMLSelectElement | null;
    expect(houseNumberStreetSelect).toBeTruthy();
    if (!houseNumberStreetSelect) {
      throw new Error('missing waste house number street select');
    }
    houseNumberStreetSelect.value = 'street-1';
    fireEvent.change(houseNumberStreetSelect);
    fireEvent.click(screen.getByRole('button', { name: 'wasteManagement.masterData.houseNumbers.actions.create' }));

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementHouseNumber).toHaveBeenCalledWith(
        expect.objectContaining({
          number: '42a',
        })
      );
    });
  });

  it('creates a waste collection location from the master-data dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'locations',
      masterDataTab: 'locations',
      locationsView: 'create',
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

    const regionSelect = document.getElementById('waste-location-region-id') as HTMLSelectElement | null;
    const citySelect = document.getElementById('waste-location-city-id') as HTMLSelectElement | null;
    const streetSelect = document.getElementById('waste-location-street-id') as HTMLSelectElement | null;
    const houseNumberSelect = document.getElementById('waste-location-house-number-id') as HTMLSelectElement | null;
    expect(regionSelect).toBeTruthy();
    expect(citySelect).toBeTruthy();
    expect(streetSelect).toBeTruthy();
    expect(houseNumberSelect).toBeTruthy();
    if (!regionSelect || !citySelect || !streetSelect || !houseNumberSelect) {
      throw new Error('missing collection location selects');
    }
    regionSelect.value = 'region-1';
    fireEvent.change(regionSelect);
    citySelect.value = 'city-1';
    fireEvent.change(citySelect);
    streetSelect.value = 'street-1';
    fireEvent.change(streetSelect);
    houseNumberSelect.value = 'house-1';
    fireEvent.change(houseNumberSelect);
    fireEvent.click(screen.getAllByRole('button', { name: 'wasteManagement.masterData.collectionLocations.actions.create' })[0]!);

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementCollectionLocation).toHaveBeenCalledTimes(1);
    });
  });

  it('creates waste location-tour links in bulk from selected collection locations', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'locations',
      masterDataTab: 'locations',
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

    const locationCheckboxes = Array.from(document.querySelectorAll('tbody input[type="checkbox"]'));
    const firstSelectableLocation = locationCheckboxes[0];
    const secondSelectableLocation = locationCheckboxes[1];
    expect(firstSelectableLocation).toBeDefined();
    expect(secondSelectableLocation).toBeDefined();
    if (!firstSelectableLocation || !secondSelectableLocation) {
      throw new Error('expected selectable location checkboxes');
    }
    fireEvent.click(firstSelectableLocation);
    fireEvent.click(secondSelectableLocation);
    fireEvent.click(
      screen.getByRole('button', { name: /wasteManagement\.masterData\.collectionLocations\.bulk\.actions\.openAssign/i })
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
      toursView: 'create',
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

    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.name'), {
      target: { value: 'Papier Mitte' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.recurrence'), {
      target: { value: 'biweekly' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.firstDate'), {
      target: { value: '2026-05-19' },
    });
    fireEvent.click(screen.getByLabelText('Restmüll'));
    fireEvent.click(screen.getAllByRole('button', { name: 'wasteManagement.tours.actions.create' })[0]!);

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

    expect(screen.getAllByText('Feiertagsverschiebung').length).toBeGreaterThan(0);
    expect(screen.queryByText('Vorverlegt')).toBeNull();
  });

  it('shows the duplication hint and sends duplicateFromTourId during create submit', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'tours',
      masterDataTab: 'fractions',
      fractionsView: 'list',
      toursView: 'create',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      duplicateFromTourId: 'tour-source-1',
    }));
    wasteManagementApiMocks.getWasteManagementMasterDataOverview.mockResolvedValueOnce({
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
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
    wasteManagementApiMocks.getWasteManagementToursOverview
      .mockResolvedValueOnce({
        tours: [
          {
            id: 'tour-source-1',
            name: 'Bio Nord',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-19',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        tours: [
          {
            id: 'tour-copy-1',
            name: 'Bio Nord (Kopie)',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-19',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
      });
    wasteManagementApiMocks.createWasteManagementTour.mockReset();
    wasteManagementApiMocks.createWasteManagementTour.mockImplementation(async () => ({
      id: 'tour-copy-1',
      name: 'Bio Nord (Kopie)',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'weekly',
      firstDate: '2026-05-19',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    }));

    render(<WasteManagementPage />);

    await waitFor(() => {
      expect(wasteManagementApiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('wasteManagement.tours.messages.duplicateHint')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.name'), {
      target: { value: 'Bio Nord (Kopie)' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.recurrence'), {
      target: { value: 'weekly' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.tours.fields.firstDate'), {
      target: { value: '2026-05-19' },
    });
    fireEvent.click(screen.getByLabelText('Restmüll'));
    fireEvent.click(screen.getAllByRole('button', { name: 'wasteManagement.tours.actions.create' })[0]!);

    await waitFor(() => {
      expect(wasteManagementApiMocks.createWasteManagementTour).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bio Nord (Kopie)',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-19',
          duplicateFromTourId: 'tour-source-1',
        })
      );
    });
  });

  it('creates a tour-related waste date shift from the scheduling dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'scheduling',
      schedulingView: 'create',
      schedulingEntryType: 'tour-shift',
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

    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.tourId'), {
      target: { value: 'tour-1' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.originalDate'), {
      target: { value: '2026-12-24' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.actualDate'), {
      target: { value: '2026-12-23' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.reasonType'), {
      target: { value: 'manual-adjustment' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.reasonKey'), {
      target: { value: 'xmas-pull-forward' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.tour.fields.followUpMode'), {
      target: { value: 'propagate-series' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'wasteManagement.scheduling.tour.actions.create' })[0]!);

    await waitFor(() => {
        expect(wasteManagementApiMocks.createWasteManagementTourDateShift).toHaveBeenCalledWith(
        expect.objectContaining({
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
          reasonType: 'manual-adjustment',
          reasonKey: 'xmas-pull-forward',
          followUpMode: 'propagate-series',
        })
      );
    });
  });

  it('creates a global waste date shift from the scheduling dialog', async () => {
    searchMock.mockImplementation(() => ({
      tab: 'scheduling',
      schedulingView: 'create',
      schedulingEntryType: 'global-shift',
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

    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.global.fields.originalDate'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.global.fields.actualDate'), {
      target: { value: '2026-01-02' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.global.fields.reasonType'), {
      target: { value: 'holiday' },
    });
    fireEvent.change(screen.getByLabelText('wasteManagement.scheduling.global.fields.reasonKey'), {
      target: { value: 'new-year' },
    });
    fireEvent.click(screen.getByLabelText('Restmüll Nord'));
    fireEvent.click(screen.getAllByRole('button', { name: 'wasteManagement.scheduling.global.actions.create' })[0]!);

    await waitFor(() => {
        expect(wasteManagementApiMocks.createWasteManagementGlobalDateShift).toHaveBeenCalledWith(
        expect.objectContaining({
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          reasonType: 'holiday',
          reasonKey: 'new-year',
          tourIds: ['tour-1'],
        })
      );
    });
  });
});
