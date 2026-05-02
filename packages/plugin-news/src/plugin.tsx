import {
  definePluginAuditEvents,
  defineMediaPickerDefinition,
  createStandardContentPluginActionIds,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';
import { getStudioModuleIamContract } from '@sva/studio-module-iam';

import { NEWS_CONTENT_TYPE } from './news.constants.js';
export { NEWS_CONTENT_TYPE } from './news.constants.js';

export const pluginNewsActionIds = createStandardContentPluginActionIds('news');

const standardNewsContribution = createStandardContentPluginContribution({
  pluginId: 'news',
  displayName: 'News',
  contentType: NEWS_CONTENT_TYPE,
  titleKey: 'news.navigation.title',
  listBindingKey: 'newsList',
  detailBindingKey: 'newsDetail',
  editorBindingKey: 'newsEditor',
  actionOptions: {
    legacyAliases: {
      create: ['create'],
      edit: ['edit'],
      update: ['save', 'update'],
      delete: ['delete'],
    },
  },
});

export const pluginNewsPermissionDefinitions = standardNewsContribution.permissions;

export const pluginNewsActionDefinitions = standardNewsContribution.actions;
const pluginNewsModuleIam = getStudioModuleIamContract('news');
const pluginNewsModuleIamDefinition = pluginNewsModuleIam
  ? {
      moduleId: pluginNewsModuleIam.moduleId,
      permissionIds: pluginNewsModuleIam.permissionIds,
      systemRoles: pluginNewsModuleIam.systemRoles,
    }
  : undefined;

export const pluginNewsMediaPickers = {
  teaserImage: defineMediaPickerDefinition({
    roles: ['teaser_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'teaser',
  }),
  headerImage: defineMediaPickerDefinition({
    roles: ['header_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'hero',
  }),
} as const;

export const getPluginNewsActionDefinition = (
  actionId: (typeof pluginNewsActionIds)[keyof typeof pluginNewsActionIds]
) => pluginNewsActionDefinitions.find((action) => action.id === actionId);

export const pluginNews: PluginDefinition = {
  id: 'news',
  displayName: 'News',
  routes: [],
  navigation: standardNewsContribution.navigation,
  actions: pluginNewsActionDefinitions,
  permissions: pluginNewsPermissionDefinitions,
  moduleIam: pluginNewsModuleIamDefinition ?? standardNewsContribution.moduleIam,
  contentTypes: standardNewsContribution.contentTypes,
  adminResources: standardNewsContribution.adminResources,
  auditEvents: definePluginAuditEvents('news', []),
  translations: {
    de: {
      news: {
        navigation: {
          title: 'News',
        },
        list: {
          title: 'News',
          description: 'Verwalten Sie News-Einträge über das Plugin.',
        },
        editor: {
          createTitle: 'News-Eintrag anlegen',
          createDescription: 'Erstellen Sie einen neuen News-Eintrag.',
          editTitle: 'News-Eintrag bearbeiten',
          editDescription: 'Aktualisieren oder löschen Sie den News-Eintrag.',
        },
        fields: {
          title: 'Titel',
          author: 'Autor',
          keywords: 'Schlagwörter',
          externalId: 'Externe ID',
          newsType: 'News-Typ',
          fullVersion: 'Vollversion',
          charactersToBeShown: 'Zeichenbegrenzung',
          publishedAt: 'Veröffentlichungsdatum',
          publicationDate: 'Publikationsdatum',
          showPublishDate: 'Publikationsdatum anzeigen',
          pushNotification: 'Push-Benachrichtigung senden',
          categoryName: 'Kategorie',
          categories: 'Kategorien',
          categoriesHelp: 'Eine Kategorie pro Zeile.',
          sourceUrl: 'Quell-URL',
          sourceUrlDescription: 'Quellbeschreibung',
          street: 'Straße',
          zip: 'PLZ',
          city: 'Ort',
          pointOfInterestId: 'POI-ID',
          contentBlocks: 'Inhaltsblöcke',
          contentBlock: 'Inhaltsblock',
          blockTitle: 'Blocktitel',
          blockIntro: 'Einleitung',
          blockBody: 'Inhalt',
          mediaContents: 'Medien',
          mediaUrl: 'Medien-URL',
          mediaCaption: 'Bildunterschrift',
          mediaContentType: 'Medientyp',
          technicalDetails: 'Technische Details',
          dataProvider: 'Datenanbieter',
          visible: 'Sichtbar',
          likeCount: 'Likes',
          likedByMe: 'Von mir geliked',
          pushNotificationsSentAt: 'Push gesendet am',
          settings: 'Einstellungen',
          announcements: 'Ankündigungen',
          updatedAt: 'Geändert am',
          actions: 'Aktionen',
        },
        values: {
          yes: 'Ja',
          no: 'Nein',
        },
        actions: {
          create: 'News anlegen',
          update: 'Änderungen speichern',
          back: 'Zurück zur Liste',
          edit: 'Bearbeiten',
          delete: 'Löschen',
          addContentBlock: 'Inhaltsblock hinzufügen',
          addMedia: 'Medium hinzufügen',
          remove: 'Entfernen',
          deleteConfirm: 'Soll dieser News-Eintrag wirklich gelöscht werden?',
        },
        empty: {
          title: 'Noch keine News vorhanden',
          description: 'Legen Sie den ersten News-Eintrag an.',
        },
        messages: {
          loading: 'News werden geladen.',
          loadError: 'News konnten nicht geladen werden.',
          missingContent: 'Der angeforderte News-Eintrag konnte nicht geladen werden.',
          saveError: 'News konnten nicht gespeichert werden.',
          validationError: 'Bitte korrigieren Sie die markierten Felder.',
          createSuccess: 'News-Eintrag wurde erstellt.',
          updateSuccess: 'News-Eintrag wurde aktualisiert.',
          deleteSuccess: 'News-Eintrag wurde gelöscht.',
          deleteError: 'News-Eintrag konnte nicht gelöscht werden.',
          errors: {
            missingCredentials: 'Mainserver-Credentials fehlen für diesen Benutzer.',
            forbidden: 'Für diese News-Operation fehlt die Berechtigung.',
            graphqlError: 'Der Mainserver konnte die News-Operation nicht ausführen.',
            invalidResponse: 'Der Mainserver hat eine unerwartete News-Antwort geliefert.',
            invalidRequest: 'Die News-Daten sind unvollständig oder ungültig.',
            csrfValidationFailed: 'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.',
            idempotencyKeyRequired: 'Die Sicherheitskennung für die News-Erstellung fehlt.',
            idempotencyKeyReuse: 'Diese News-Erstellung wurde bereits verarbeitet.',
            missingInstance: 'Für diese Sitzung fehlt der Instanzkontext.',
            networkError: 'Der Mainserver ist aktuell nicht erreichbar.',
          },
        },
        validation: {
          title: 'Der Titel ist erforderlich.',
          publishedAt: 'Das Veröffentlichungsdatum ist erforderlich.',
          publicationDate: 'Das Publikationsdatum ist ungültig.',
          charactersToBeShown: 'Die Zeichenbegrenzung muss eine nicht-negative Ganzzahl sein.',
          categoryName: 'Die Kategorie darf maximal 128 Zeichen haben.',
          categories: 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.',
          sourceUrl: 'Die Quell-URL muss mit https:// beginnen.',
          contentBlocks: 'Mindestens ein Inhaltsblock benötigt Inhalt und darf maximal 50.000 Zeichen haben.',
          mediaContents: 'Medien-URLs müssen mit https:// beginnen.',
        },
      },
    },
    en: {
      news: {
        navigation: {
          title: 'News',
        },
        list: {
          title: 'News',
          description: 'Manage news entries through the plugin.',
        },
        editor: {
          createTitle: 'Create news entry',
          createDescription: 'Create a new news entry.',
          editTitle: 'Edit news entry',
          editDescription: 'Update or delete the news entry.',
        },
        fields: {
          title: 'Title',
          author: 'Author',
          keywords: 'Keywords',
          externalId: 'External ID',
          newsType: 'News type',
          fullVersion: 'Full version',
          charactersToBeShown: 'Character limit',
          publishedAt: 'Published at',
          publicationDate: 'Publication date',
          showPublishDate: 'Show publication date',
          pushNotification: 'Send push notification',
          categoryName: 'Category',
          categories: 'Categories',
          categoriesHelp: 'One category per line.',
          sourceUrl: 'Source URL',
          sourceUrlDescription: 'Source description',
          street: 'Street',
          zip: 'ZIP',
          city: 'City',
          pointOfInterestId: 'POI ID',
          contentBlocks: 'Content blocks',
          contentBlock: 'Content block',
          blockTitle: 'Block title',
          blockIntro: 'Intro',
          blockBody: 'Body',
          mediaContents: 'Media',
          mediaUrl: 'Media URL',
          mediaCaption: 'Caption',
          mediaContentType: 'Media type',
          technicalDetails: 'Technical details',
          dataProvider: 'Data provider',
          visible: 'Visible',
          likeCount: 'Likes',
          likedByMe: 'Liked by me',
          pushNotificationsSentAt: 'Push sent at',
          settings: 'Settings',
          announcements: 'Announcements',
          updatedAt: 'Updated at',
          actions: 'Actions',
        },
        values: {
          yes: 'Yes',
          no: 'No',
        },
        actions: {
          create: 'Create news',
          update: 'Save changes',
          back: 'Back to list',
          edit: 'Edit',
          delete: 'Delete',
          addContentBlock: 'Add content block',
          addMedia: 'Add media',
          remove: 'Remove',
          deleteConfirm: 'Do you really want to delete this news entry?',
        },
        empty: {
          title: 'No news entries yet',
          description: 'Create the first news entry.',
        },
        messages: {
          loading: 'Loading news.',
          loadError: 'Failed to load news.',
          missingContent: 'The requested news entry could not be loaded.',
          saveError: 'Failed to save news.',
          validationError: 'Please fix the highlighted fields.',
          createSuccess: 'News entry created.',
          updateSuccess: 'News entry updated.',
          deleteSuccess: 'News entry deleted.',
          deleteError: 'Failed to delete news entry.',
          errors: {
            missingCredentials: 'Mainserver credentials are missing for this user.',
            forbidden: 'You do not have permission for this news operation.',
            graphqlError: 'The Mainserver could not execute the news operation.',
            invalidResponse: 'The Mainserver returned an unexpected news response.',
            invalidRequest: 'The news data is incomplete or invalid.',
            csrfValidationFailed: 'Security validation failed. Please reload the page and try again.',
            idempotencyKeyRequired: 'The safety key for creating this news entry is missing.',
            idempotencyKeyReuse: 'This news creation request has already been processed.',
            missingInstance: 'This session has no instance context.',
            networkError: 'The Mainserver is currently unavailable.',
          },
        },
        validation: {
          title: 'The title is required.',
          publishedAt: 'The publication date is required.',
          publicationDate: 'The publication date is invalid.',
          charactersToBeShown: 'The character limit must be a non-negative integer.',
          categoryName: 'The category must not exceed 128 characters.',
          categories: 'Categories need a name with at most 128 characters.',
          sourceUrl: 'The source URL must start with https://.',
          contentBlocks: 'At least one content block needs body content and must not exceed 50,000 characters.',
          mediaContents: 'Media URLs must start with https://.',
        },
      },
    },
  },
};
