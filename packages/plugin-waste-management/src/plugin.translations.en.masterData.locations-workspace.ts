import { createWasteManagementLocationsWorkspaceTranslations } from './plugin.translations.shared.sections.js';

export const wasteManagementPluginTranslationsENMasterDataLocationsWorkspace =
  createWasteManagementLocationsWorkspaceTranslations({
    title: 'Collection locations & address hierarchy',
    description: 'Work in a Newcms-like mode with collection locations, tour filters and the geographic hierarchy in one place.',
    emptyTitle: 'No collection locations found',
    emptyBody: 'Adjust the filters or create the first collection location.',
    emptyRegions: 'No regions created yet.',
    emptyCities: 'No cities created yet.',
    emptyStreets: 'No streets created yet.',
    emptyHouseNumbers: 'No house numbers created yet.',
    actions: {
      createRegion: 'New region',
      createCity: 'New city',
      createStreet: 'New street',
      createHouseNumber: 'New house number',
      createLocation: 'New collection location',
    },
    filters: {
      tour: 'Filter by tour',
      allTours: 'All tours',
      activeTour: 'Active tour',
      clearTour: 'Clear filter',
    },
    table: {
      caption: 'Collection locations with status and direct editing',
      label: 'Collection location',
      region: 'Region',
      city: 'City',
      address: 'Address',
      tours: 'Tours',
      status: 'Status',
      locationId: 'ID',
      selection: 'Selection',
      actions: 'Actions',
      selectAllRows: 'Select all rows in {{label}}',
      selectRow: 'Select row {{rowId}}',
      tourCount: '{{value}} tour(s)',
      regionUnavailable: 'No region',
      cityUnavailable: 'No city',
      addressUnavailable: 'No address',
    },
  });
