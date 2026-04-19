import { definePluginActions, type PluginDefinition } from '@sva/sdk';

import { NewsCreatePage, NewsEditPage, NewsListPage } from './news.pages.js';

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
      component: NewsCreatePage,
    },
    {
      id: 'news.edit',
      path: '/plugins/news/$contentId',
      guard: 'content.write',
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
  actions: definePluginActions('news', [
    {
      id: 'news.create',
      titleKey: 'news.actions.create',
      requiredAction: 'content.create',
    },
    {
      id: 'news.edit',
      titleKey: 'news.actions.edit',
      requiredAction: 'content.write',
    },
    {
      id: 'news.delete',
      titleKey: 'news.actions.delete',
      requiredAction: 'content.write',
    },
  ]),
  contentTypes: [
    {
      contentType: 'news',
      displayName: 'News',
    },
  ],
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
          status: 'Status',
          publishedAt: 'Veröffentlichungsdatum',
          updatedAt: 'Geändert am',
          actions: 'Aktionen',
        },
        actions: {
          create: 'News anlegen',
          save: 'Änderungen speichern',
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
        },
        validation: {
          teaser: 'Der Teaser ist erforderlich und darf maximal 500 Zeichen haben.',
          body: 'Der Inhalt ist erforderlich und darf maximal 50.000 Zeichen haben.',
          imageUrl: 'Die Bild-URL muss mit https:// beginnen.',
          externalUrl: 'Die externe URL muss mit https:// beginnen.',
        },
        status: {
          draft: 'Entwurf',
          inReview: 'In Prüfung',
          approved: 'Freigegeben',
          published: 'Veröffentlicht',
          archived: 'Archiviert',
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
          status: 'Status',
          publishedAt: 'Published at',
          updatedAt: 'Updated at',
          actions: 'Actions',
        },
        actions: {
          create: 'Create news',
          save: 'Save changes',
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
        },
        validation: {
          teaser: 'The teaser is required and must not exceed 500 characters.',
          body: 'The body is required and must not exceed 50,000 characters.',
          imageUrl: 'The image URL must start with https://.',
          externalUrl: 'The external URL must start with https://.',
        },
        status: {
          draft: 'Draft',
          inReview: 'In review',
          approved: 'Approved',
          published: 'Published',
          archived: 'Archived',
        },
      },
    },
  },
};
