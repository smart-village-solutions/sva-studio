import { describe, expect, it } from 'vitest';

import { createWasteManagementPluginTranslationLocale } from '../src/plugin.translations.shared.base.js';
import { wasteManagementPluginTranslationsDEMasterData } from '../src/plugin.translations.de.masterData.js';
import { wasteManagementPluginTranslationsDETours } from '../src/plugin.translations.de.tours.js';
import { createMasterDataEntityTranslations } from '../src/plugin.translations.shared.master-data.js';
import { createWasteManagementToursTranslations } from '../src/plugin.translations.shared.scheduling.js';
import {
  createWasteManagementSettingsTranslations,
  createWasteManagementTabsTranslations,
} from '../src/plugin.translations.shared.sections.js';

describe('waste-management translation builders', () => {
  it('builds tab translations with the canonical section structure', () => {
    expect(
      createWasteManagementTabsTranslations({
        ariaLabel: 'Areas',
        fractions: ['Fractions', 'Fractions body', 'No fractions', 'Add one'],
        tours: ['Tours', 'Tours body', 'No tours', 'Add one'],
        locations: ['Locations', 'Locations body', 'No locations', 'Add one'],
        scheduling: ['Scheduling', 'Scheduling body', 'No shifts', 'Add one'],
        output: ['Output', 'Output body', 'No output', 'Add one'],
        tools: ['Tools', 'Tools body', 'No tools', 'Add one'],
        settings: ['Settings', 'Settings body', 'No settings', 'Add one'],
      })
    ).toEqual({
      tabs: {
        ariaLabel: 'Areas',
        fractions: {
          title: 'Fractions',
          body: 'Fractions body',
          emptyTitle: 'No fractions',
          emptyBody: 'Add one',
        },
        tours: {
          title: 'Tours',
          body: 'Tours body',
          emptyTitle: 'No tours',
          emptyBody: 'Add one',
        },
        locations: {
          title: 'Locations',
          body: 'Locations body',
          emptyTitle: 'No locations',
          emptyBody: 'Add one',
        },
        scheduling: {
          title: 'Scheduling',
          body: 'Scheduling body',
          emptyTitle: 'No shifts',
          emptyBody: 'Add one',
        },
        output: {
          title: 'Output',
          body: 'Output body',
          emptyTitle: 'No output',
          emptyBody: 'Add one',
        },
        tools: {
          title: 'Tools',
          body: 'Tools body',
          emptyTitle: 'No tools',
          emptyBody: 'Add one',
        },
        settings: {
          title: 'Settings',
          body: 'Settings body',
          emptyTitle: 'No settings',
          emptyBody: 'Add one',
        },
      },
    });
  });

  it('keeps optional tours sections opt-in and wraps locale sections under wasteManagement', () => {
    const tabs = createWasteManagementTabsTranslations({
      ariaLabel: 'Bereiche',
      fractions: ['Fraktionen', 'Fraktionen', 'Leer', 'Leer'],
      tours: ['Touren', 'Touren', 'Leer', 'Leer'],
      locations: ['Orte', 'Orte', 'Leer', 'Leer'],
      scheduling: ['Planung', 'Planung', 'Leer', 'Leer'],
      output: ['Ausgabe', 'Ausgabe', 'Leer', 'Leer'],
      tools: ['Tools', 'Tools', 'Leer', 'Leer'],
      settings: ['Einstellungen', 'Einstellungen', 'Leer', 'Leer'],
    });
    const tours = createWasteManagementToursTranslations({
      actions: {
        openCreate: 'Tour anlegen',
        edit: 'Bearbeiten',
        cancel: 'Abbrechen',
        create: 'Tour speichern',
        save: 'Aenderungen speichern',
        saving: 'Speichert…',
      },
      fields: {
        name: 'Name',
        description: 'Beschreibung',
        recurrence: 'Rhythmus',
        recurrenceUnset: 'Kein Rhythmus',
        firstDate: 'Erster Termin',
        endDate: 'Letzter Termin',
        customDates: 'Individuelle Termine',
        customDatesPlaceholder: '2026-05-12',
        wasteFractions: 'Fraktionen',
        noFractionsAvailable: 'Keine Fraktionen',
        active: 'Status',
      },
      dialog: {
        createTitle: 'Tour anlegen',
        createDescription: 'Neue Tour',
        editTitle: 'Tour bearbeiten',
        editDescription: 'Tour aendern',
      },
      meta: {
        count: '{{value}} Touren',
        recurrence: 'Rhythmus: {{value}}',
        fractionCount: 'Fraktionen: {{value}}',
        locationCount: 'Abholorte: {{value}}',
        dateRange: 'Zeitraum: {{value}}',
        tourId: 'Tour-ID: {{value}}',
      },
      table: {
        ariaLabel: 'Touren',
        caption: 'Touren',
        name: 'Tour',
        status: 'Status',
        recurrence: 'Rhythmus',
        fractions: 'Fraktionen',
        locations: 'Abholorte',
        dateRange: 'Zeitraum',
        assignments: 'Zuordnungen',
        customDates: 'Individuelle Termine',
        tourId: 'Tour-ID',
        actions: 'Aktionen',
        loadingAssignments: 'Laedt',
        noAssignments: 'Keine',
        noCustomDates: 'Keine',
      },
      recurrence: {
        weekly: 'Woechentlich',
        biweekly: 'Zweiwoechentlich',
        fourweekly: 'Vierwoechentlich',
        yearly: 'Jaehrlich',
        onDemand: 'Bedarf',
        custom: 'Individuell',
      },
      customDates: {
        title: 'Individuelle Termine',
        description: 'Zusatztermine verwalten',
        empty: 'Keine individuellen Termine',
        commentHint: 'Optionaler Hinweis',
        actions: {
          openCreate: 'Termin anlegen',
          edit: 'Termin bearbeiten',
          cancel: 'Abbrechen',
          create: 'Termin speichern',
          save: 'Termin aktualisieren',
          saving: 'Speichert…',
        },
        fields: {
          date: 'Datum',
          note: 'Hinweis',
        },
        dialog: {
          createTitle: 'Termin anlegen',
          createDescription: 'Zusätzlichen Termin erfassen',
          editTitle: 'Termin bearbeiten',
          editDescription: 'Zusätzlichen Termin aktualisieren',
        },
        meta: {
          comment: 'Hinweis: {{value}}',
        },
      },
      messages: {
        loading: 'Laedt',
        loadError: 'Fehler',
        loadForbidden: 'Verboten',
        emptyTitle: 'Leer',
        emptyBody: 'Leer',
        createSuccess: 'Angelegt',
        updateSuccess: 'Aktualisiert',
        saveError: 'Fehler',
        saveForbidden: 'Verboten',
      },
    });

    expect(tours.tours).not.toHaveProperty('assignments');
    expect(tours.tours).not.toHaveProperty('yearCalendar');
    expect(tours.tours.customDates.title).toBe('Individuelle Termine');
    expect(createWasteManagementPluginTranslationLocale([tabs, tours])).toEqual({
      wasteManagement: {
        ...tabs,
        ...tours,
      },
    });
  });

  it('exposes common settings labels under the wasteManagement root', () => {
    expect(
      createWasteManagementSettingsTranslations({
        common: {
          actions: 'Aktionen',
        },
        technical: {
          title: 'Status',
          description: 'Beschreibung',
        },
        fields: {
          holidayStateCode: 'Bundesland',
        },
        meta: {
          lastSuccessfulHolidaySyncAtLabel: 'Letzter erfolgreicher Abgleich',
        },
        actions: {
          save: 'Speichern',
        },
        messages: {
          loading: 'Lädt',
        },
      })
    ).toEqual({
      common: {
        actions: 'Aktionen',
      },
      settings: {
        technical: {
          title: 'Status',
          description: 'Beschreibung',
        },
        fields: {
          holidayStateCode: 'Bundesland',
        },
        meta: {
          lastSuccessfulHolidaySyncAtLabel: 'Letzter erfolgreicher Abgleich',
        },
        actions: {
          save: 'Speichern',
        },
        messages: {
          loading: 'Lädt',
        },
      },
    });
  });

  it('deep-merges shared and settings common keys without dropping either branch', () => {
    expect(
      createWasteManagementPluginTranslationLocale([
        {
          common: {
            active: 'Aktiv',
            inactive: 'Inaktiv',
          },
        },
        createWasteManagementSettingsTranslations({
          common: {
            actions: 'Aktionen',
          },
          technical: {
            title: 'Status',
            description: 'Beschreibung',
          },
          fields: {
            holidayStateCode: 'Bundesland',
          },
          meta: {
            lastSuccessfulHolidaySyncAtLabel: 'Letzter erfolgreicher Abgleich',
          },
          actions: {
            save: 'Speichern',
          },
          messages: {
            loading: 'Lädt',
          },
        }),
      ])
    ).toMatchObject({
      wasteManagement: {
        common: {
          actions: 'Aktionen',
          active: 'Aktiv',
          inactive: 'Inaktiv',
        },
      },
    });
  });

  it('keeps master-data entity meta labels at their public translation paths', () => {
    expect(
      createMasterDataEntityTranslations({
        title: 'Regions',
        description: 'Manage regions',
        actions: {
          openCreate: 'Create',
          edit: 'Edit',
          cancel: 'Cancel',
          create: 'Create',
          save: 'Save',
          saving: 'Saving',
        },
        fields: {
          name: 'Name',
        },
        dialog: {
          createTitle: 'Create region',
          createDescription: 'Create a region',
          editTitle: 'Edit region',
          editDescription: 'Edit a region',
        },
        messages: {
          createSuccess: 'Created',
          updateSuccess: 'Updated',
          saveError: 'Failed',
          saveForbidden: 'Forbidden',
        },
        meta: {
          regionId: 'Region ID: {{value}}',
        },
      })
    ).toMatchObject({
      regionId: 'Region ID: {{value}}',
    });
  });

  it('keeps fraction filter labels at their public translation paths', () => {
    expect(
      createWasteManagementPluginTranslationLocale([wasteManagementPluginTranslationsDEMasterData])
    ).toMatchObject({
      wasteManagement: {
        masterData: {
          fractions: {
            filters: {
              open: 'Filtern',
              reset: 'Filter zurücksetzen',
              title: 'Fraktionen filtern',
              description: 'Wählen Sie aus, welche Fraktionen in der Liste angezeigt werden sollen.',
              statusLabel: 'Status',
              apply: 'Anwenden',
              cancel: 'Abbrechen',
              status: {
                all: 'Alle',
                active: 'Aktive Fraktionen',
                inactive: 'Inaktive Fraktionen',
              },
            },
          },
        },
      },
    });
  });

  it('keeps tour filter labels at their public translation paths', () => {
    expect(
      createWasteManagementPluginTranslationLocale([wasteManagementPluginTranslationsDETours])
    ).toMatchObject({
      wasteManagement: {
        tours: {
          filters: {
            open: 'Filtern',
            reset: 'Filter zurücksetzen',
            title: 'Touren filtern',
            description: 'Legen Sie fest, welche Touren in der Liste angezeigt werden sollen.',
            nameLabel: 'Name',
            namePlaceholder: 'Nach Name suchen',
            statusLabel: 'Status',
            fractionLabel: 'Abfallart',
            fractionAll: 'Alle',
            firstDateFromLabel: 'Erster Termin von',
            firstDateToLabel: 'Erster Termin bis',
            endDateFromLabel: 'Letzter Termin von',
            endDateToLabel: 'Letzter Termin bis',
            cancel: 'Abbrechen',
            apply: 'Anwenden',
            status: {
              all: 'Alle',
              active: 'Aktive Touren',
              inactive: 'Inaktive Touren',
            },
          },
        },
      },
    });
  });

  it('keeps status dialog labels at their public translation paths', () => {
    expect(
      createWasteManagementPluginTranslationLocale([
        wasteManagementPluginTranslationsDEMasterData,
        wasteManagementPluginTranslationsDETours,
      ])
    ).toMatchObject({
      wasteManagement: {
        masterData: {
          fractions: {
            statusDialog: {
              confirm: 'Bestätigen',
              cancel: 'Abbrechen',
            },
          },
        },
        tours: {
          statusDialog: {
            confirm: 'Bestätigen',
            cancel: 'Abbrechen',
          },
        },
      },
    });
  });
});
