import {
  definePluginActions,
  definePluginAuditEvents,
  definePluginContentTypes,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { NEWS_CONTENT_TYPE } from './news.constants.js';
import { NewsCreatePage, NewsEditPage, NewsListPage } from './news.pages.js';
export { NEWS_CONTENT_TYPE } from './news.constants.js';

export const pluginNewsActionIds = {
  create: 'news.create',
  edit: 'news.edit',
  update: 'news.update',
  delete: 'news.delete',
} as const;

export const pluginNewsActionDefinitions = definePluginActions('news', [
  {
    id: pluginNewsActionIds.create,
    titleKey: 'news.actions.create',
    requiredAction: 'content.create',
    legacyAliases: ['create'],
  },
  {
    id: pluginNewsActionIds.edit,
    titleKey: 'news.actions.edit',
    requiredAction: 'content.read',
    legacyAliases: ['edit'],
  },
  {
    id: pluginNewsActionIds.update,
    titleKey: 'news.actions.update',
    requiredAction: 'content.updatePayload',
    legacyAliases: ['save', 'update'],
  },
  {
    id: pluginNewsActionIds.delete,
    titleKey: 'news.actions.delete',
    requiredAction: 'content.delete',
    legacyAliases: ['delete'],
  },
] as const);

export const getPluginNewsActionDefinition = (
  actionId: (typeof pluginNewsActionIds)[keyof typeof pluginNewsActionIds]
) => pluginNewsActionDefinitions.find((action) => action.id === actionId);

export const pluginNews: PluginDefinition = {
  id: 'news',
  displayName: 'News',
  routes: [
    {
      id: 'news.list',
      path: '/plugins/news',
      guard: 'content.read',
      component: NewsListPage,
    },
    {
      id: 'news.create',
      path: '/plugins/news/new',
      guard: 'content.create',
      actionId: pluginNewsActionIds.create,
      component: NewsCreatePage,
    },
    {
      id: 'news.edit',
      path: '/plugins/news/$contentId',
      guard: 'content.read',
      actionId: pluginNewsActionIds.edit,
      component: NewsEditPage,
    },
  ],
  navigation: [
    {
      id: 'news.navigation',
      to: '/plugins/news',
      titleKey: 'news.navigation.title',
      section: 'dataManagement',
      requiredAction: 'content.read',
    },
  ],
  actions: pluginNewsActionDefinitions,
  contentTypes: definePluginContentTypes('news', [
    {
      contentType: NEWS_CONTENT_TYPE,
      displayName: 'News',
    },
  ]),
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
          teaser: 'Teaser',
          teaserHelp: 'Kurzbeschreibung mit maximal 500 Zeichen.',
          body: 'Inhalt (HTML)',
          imageUrl: 'Bild-URL',
          externalUrl: 'Externe URL',
          category: 'Kategorie',
          publishedAt: 'Veröffentlichungsdatum',
          updatedAt: 'Geändert am',
          actions: 'Aktionen',
        },
        actions: {
          create: 'News anlegen',
          update: 'Änderungen speichern',
          back: 'Zurück zur Liste',
          edit: 'Bearbeiten',
          delete: 'Löschen',
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
          teaser: 'Der Teaser ist erforderlich und darf maximal 500 Zeichen haben.',
          body: 'Der Inhalt ist erforderlich und darf maximal 50.000 Zeichen haben.',
          imageUrl: 'Die Bild-URL muss mit https:// beginnen.',
          externalUrl: 'Die externe URL muss mit https:// beginnen.',
          publishedAt: 'Das Veröffentlichungsdatum ist erforderlich.',
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
          teaser: 'Teaser',
          teaserHelp: 'Short description with a maximum of 500 characters.',
          body: 'Body (HTML)',
          imageUrl: 'Image URL',
          externalUrl: 'External URL',
          category: 'Category',
          publishedAt: 'Published at',
          updatedAt: 'Updated at',
          actions: 'Actions',
        },
        actions: {
          create: 'Create news',
          update: 'Save changes',
          back: 'Back to list',
          edit: 'Edit',
          delete: 'Delete',
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
          teaser: 'The teaser is required and must not exceed 500 characters.',
          body: 'The body is required and must not exceed 50,000 characters.',
          imageUrl: 'The image URL must start with https://.',
          externalUrl: 'The external URL must start with https://.',
          publishedAt: 'The publication date is required.',
        },
      },
    },
  },
};
