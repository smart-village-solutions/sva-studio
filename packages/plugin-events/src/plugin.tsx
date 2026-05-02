import {
  definePluginAuditEvents,
  defineMediaPickerDefinition,
  createStandardContentPluginActionIds,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';
import { getStudioModuleIamContract } from '@sva/studio-module-iam';

import { EVENTS_CONTENT_TYPE } from './events.constants.js';

export const pluginEventsActionIds = createStandardContentPluginActionIds('events');

const standardEventsContribution = createStandardContentPluginContribution({
  pluginId: 'events',
  displayName: 'Events',
  contentType: EVENTS_CONTENT_TYPE,
  titleKey: 'events.navigation.title',
  listBindingKey: 'eventsList',
  detailBindingKey: 'eventsDetail',
  editorBindingKey: 'eventsEditor',
});

export const pluginEventsPermissionDefinitions = standardEventsContribution.permissions;

export const pluginEventsActionDefinitions = standardEventsContribution.actions;
const pluginEventsModuleIam = getStudioModuleIamContract('events');
const pluginEventsModuleIamDefinition = pluginEventsModuleIam
  ? {
      moduleId: pluginEventsModuleIam.moduleId,
      permissionIds: pluginEventsModuleIam.permissionIds,
      systemRoles: pluginEventsModuleIam.systemRoles,
    }
  : undefined;

export const pluginEventsMediaPickers = {
  headerImage: defineMediaPickerDefinition({
    roles: ['header_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'hero',
  }),
} as const;

export const pluginEvents: PluginDefinition = {
  id: 'events',
  displayName: 'Events',
  routes: [],
  navigation: standardEventsContribution.navigation,
  actions: pluginEventsActionDefinitions,
  permissions: pluginEventsPermissionDefinitions,
  moduleIam: pluginEventsModuleIamDefinition ?? standardEventsContribution.moduleIam,
  contentTypes: standardEventsContribution.contentTypes,
  adminResources: standardEventsContribution.adminResources,
  auditEvents: definePluginAuditEvents('events', []),
  translations: {
    de: {
      events: {
        navigation: { title: 'Events' },
        list: { title: 'Events', description: 'Veranstaltungen aus dem Mainserver bearbeiten.' },
        editor: {
          createTitle: 'Event anlegen',
          createDescription: 'Erstellen Sie einen neuen Veranstaltungseintrag.',
          editTitle: 'Event bearbeiten',
          editDescription: 'Aktualisieren oder löschen Sie den Veranstaltungseintrag.',
        },
        fields: {
          title: 'Titel',
          description: 'Beschreibung',
          categoryName: 'Kategorie',
          dateStart: 'Startdatum',
          dateEnd: 'Enddatum',
          timeStart: 'Startzeit',
          timeEnd: 'Endzeit',
          street: 'Straße',
          zip: 'PLZ',
          city: 'Ort',
          contact: 'Kontakt',
          phone: 'Telefon',
          email: 'E-Mail',
          url: 'Web-URL',
          tags: 'Tags',
          pointOfInterestId: 'Zugehöriger POI',
          repeat: 'Wiederholung',
          actions: 'Aktionen',
        },
        actions: {
          create: 'Event anlegen',
          update: 'Änderungen speichern',
          edit: 'Bearbeiten',
          delete: 'Löschen',
          back: 'Zurück zur Liste',
          deleteConfirm: 'Soll dieses Event wirklich gelöscht werden?',
        },
        messages: {
          loading: 'Events werden geladen.',
          loadError: 'Events konnten nicht geladen werden.',
          missingContent: 'Das Event konnte nicht geladen werden.',
          saveError: 'Event konnte nicht gespeichert werden.',
          deleteError: 'Event konnte nicht gelöscht werden.',
          createSuccess: 'Event wurde erstellt.',
          updateSuccess: 'Event wurde aktualisiert.',
          deleteSuccess: 'Event wurde gelöscht.',
          validationError: 'Bitte korrigieren Sie die markierten Felder.',
        },
        empty: { title: 'Noch keine Events vorhanden', description: 'Legen Sie das erste Event an.' },
        validation: {
          title: 'Der Titel ist erforderlich.',
          dates: 'Datumswerte müssen gültig sein.',
          urls: 'URLs müssen mit https:// beginnen.',
          categoryName: 'Die Kategorie darf maximal 128 Zeichen haben.',
        },
      },
    },
    en: {
      events: {
        navigation: { title: 'Events' },
        list: { title: 'Events', description: 'Edit Mainserver event records.' },
        editor: {
          createTitle: 'Create event',
          createDescription: 'Create a new event record.',
          editTitle: 'Edit event',
          editDescription: 'Update or delete the event record.',
        },
        fields: {
          title: 'Title',
          description: 'Description',
          categoryName: 'Category',
          dateStart: 'Start date',
          dateEnd: 'End date',
          timeStart: 'Start time',
          timeEnd: 'End time',
          street: 'Street',
          zip: 'ZIP',
          city: 'City',
          contact: 'Contact',
          phone: 'Phone',
          email: 'Email',
          url: 'Web URL',
          tags: 'Tags',
          pointOfInterestId: 'Related POI',
          repeat: 'Repeating',
          actions: 'Actions',
        },
        actions: {
          create: 'Create event',
          update: 'Save changes',
          edit: 'Edit',
          delete: 'Delete',
          back: 'Back to list',
          deleteConfirm: 'Delete this event?',
        },
        messages: {
          loading: 'Loading events.',
          loadError: 'Events could not be loaded.',
          missingContent: 'The event could not be loaded.',
          saveError: 'Event could not be saved.',
          deleteError: 'Event could not be deleted.',
          createSuccess: 'Event was created.',
          updateSuccess: 'Event was updated.',
          deleteSuccess: 'Event was deleted.',
          validationError: 'Please correct the highlighted fields.',
        },
        empty: { title: 'No events yet', description: 'Create the first event.' },
        validation: {
          title: 'Title is required.',
          dates: 'Dates must be valid.',
          urls: 'URLs must start with https://.',
          categoryName: 'Category must be at most 128 characters.',
        },
      },
    },
  },
};
