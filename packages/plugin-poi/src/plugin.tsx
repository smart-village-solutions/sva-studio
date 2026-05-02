import {
  definePluginAuditEvents,
  defineMediaPickerDefinition,
  createStandardContentPluginActionIds,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';
import { getStudioModuleIamContract } from '@sva/studio-module-iam';

import { POI_CONTENT_TYPE } from './poi.constants.js';

export const pluginPoiActionIds = createStandardContentPluginActionIds('poi');

const standardPoiContribution = createStandardContentPluginContribution({
  pluginId: 'poi',
  displayName: 'POI',
  contentType: POI_CONTENT_TYPE,
  titleKey: 'poi.navigation.title',
  listBindingKey: 'poiList',
  detailBindingKey: 'poiDetail',
  editorBindingKey: 'poiEditor',
});

export const pluginPoiPermissionDefinitions = standardPoiContribution.permissions;

export const pluginPoiActionDefinitions = standardPoiContribution.actions;
const pluginPoiModuleIam = getStudioModuleIamContract('poi');
const pluginPoiModuleIamDefinition = pluginPoiModuleIam
  ? {
      moduleId: pluginPoiModuleIam.moduleId,
      permissionIds: pluginPoiModuleIam.permissionIds,
      systemRoles: pluginPoiModuleIam.systemRoles,
    }
  : undefined;

export const pluginPoiMediaPickers = {
  teaserImage: defineMediaPickerDefinition({
    roles: ['teaser_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'teaser',
  }),
} as const;

export const pluginPoi: PluginDefinition = {
  id: 'poi',
  displayName: 'POI',
  routes: [],
  navigation: standardPoiContribution.navigation,
  actions: pluginPoiActionDefinitions,
  permissions: pluginPoiPermissionDefinitions,
  moduleIam: pluginPoiModuleIamDefinition ?? standardPoiContribution.moduleIam,
  contentTypes: standardPoiContribution.contentTypes,
  adminResources: standardPoiContribution.adminResources,
  auditEvents: definePluginAuditEvents('poi', []),
  translations: {
    de: {
      poi: {
        navigation: { title: 'POI' },
        list: { title: 'POI', description: 'Points of Interest aus dem Mainserver bearbeiten.' },
        editor: {
          createTitle: 'POI anlegen',
          createDescription: 'Erstellen Sie einen neuen Point of Interest.',
          editTitle: 'POI bearbeiten',
          editDescription: 'Aktualisieren oder löschen Sie den Point of Interest.',
        },
        fields: {
          name: 'Name',
          description: 'Beschreibung',
          mobileDescription: 'Mobile Beschreibung',
          active: 'Aktiv',
          categoryName: 'Kategorie',
          street: 'Straße',
          zip: 'PLZ',
          city: 'Ort',
          contact: 'Kontakt',
          phone: 'Telefon',
          email: 'E-Mail',
          url: 'Web-URL',
          weekday: 'Wochentag',
          timeFrom: 'Öffnet',
          timeTo: 'Schließt',
          tags: 'Tags',
          payload: 'Payload JSON',
          actions: 'Aktionen',
        },
        actions: {
          create: 'POI anlegen',
          update: 'Änderungen speichern',
          edit: 'Bearbeiten',
          delete: 'Löschen',
          back: 'Zurück zur Liste',
          deleteConfirm: 'Soll dieser POI wirklich gelöscht werden?',
        },
        messages: {
          loading: 'POI werden geladen.',
          loadError: 'POI konnten nicht geladen werden.',
          missingContent: 'Der POI konnte nicht geladen werden.',
          saveError: 'POI konnte nicht gespeichert werden.',
          deleteError: 'POI konnte nicht gelöscht werden.',
          createSuccess: 'POI wurde erstellt.',
          updateSuccess: 'POI wurde aktualisiert.',
          validationError: 'Bitte korrigieren Sie die markierten Felder.',
        },
        empty: { title: 'Noch keine POI vorhanden', description: 'Legen Sie den ersten POI an.' },
        validation: {
          name: 'Der Name ist erforderlich.',
          webUrls: 'URLs müssen mit https:// beginnen.',
          categoryName: 'Die Kategorie darf maximal 128 Zeichen haben.',
          payload: 'Payload muss gültiges JSON sein.',
        },
      },
    },
    en: {
      poi: {
        navigation: { title: 'POI' },
        list: { title: 'POI', description: 'Edit Mainserver points of interest.' },
        editor: {
          createTitle: 'Create POI',
          createDescription: 'Create a new point of interest.',
          editTitle: 'Edit POI',
          editDescription: 'Update or delete the point of interest.',
        },
        fields: {
          name: 'Name',
          description: 'Description',
          mobileDescription: 'Mobile description',
          active: 'Active',
          categoryName: 'Category',
          street: 'Street',
          zip: 'ZIP',
          city: 'City',
          contact: 'Contact',
          phone: 'Phone',
          email: 'Email',
          url: 'Web URL',
          weekday: 'Weekday',
          timeFrom: 'Opens',
          timeTo: 'Closes',
          tags: 'Tags',
          payload: 'Payload JSON',
          actions: 'Actions',
        },
        actions: {
          create: 'Create POI',
          update: 'Save changes',
          edit: 'Edit',
          delete: 'Delete',
          back: 'Back to list',
          deleteConfirm: 'Delete this POI?',
        },
        messages: {
          loading: 'Loading POI.',
          loadError: 'POI could not be loaded.',
          missingContent: 'The POI could not be loaded.',
          saveError: 'POI could not be saved.',
          deleteError: 'POI could not be deleted.',
          createSuccess: 'POI was created.',
          updateSuccess: 'POI was updated.',
          validationError: 'Please correct the highlighted fields.',
        },
        empty: { title: 'No POI yet', description: 'Create the first POI.' },
        validation: {
          name: 'Name is required.',
          webUrls: 'URLs must start with https://.',
          categoryName: 'Category must be at most 128 characters.',
          payload: 'Payload must be valid JSON.',
        },
      },
    },
  },
};
