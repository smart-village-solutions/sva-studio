import type { AdminResourceDefinition } from '@sva/plugin-sdk';

export const appAdminResources = [
  {
    resourceId: 'host.media',
    basePath: 'media',
    titleKey: 'shell.sidebar.media',
    guard: 'adminInstances',
    moduleId: 'media',
    views: {
      list: { bindingKey: 'media' },
      create: { bindingKey: 'media' },
      detail: { bindingKey: 'media' },
    },
    capabilities: {
      list: {
        search: {
          param: 'q',
          placeholderKey: 'shell.sidebar.media',
          fields: ['title', 'altText', 'copyright', 'mimeType'],
        },
        pagination: {
          pageParam: 'page',
          pageSizeParam: 'pageSize',
          defaultPageSize: 25,
          pageSizeOptions: [25, 50, 100],
        },
      },
    },
  },
  {
    resourceId: 'content',
    basePath: 'content',
    titleKey: 'content.page.title',
    guard: 'content',
    views: {
      list: { bindingKey: 'content' },
      create: { bindingKey: 'contentCreate' },
      detail: { bindingKey: 'contentDetail' },
    },
    capabilities: {
      list: {
        search: {
          param: 'q',
          placeholderKey: 'content.filters.searchPlaceholder',
          fields: ['title', 'author', 'contentType', 'payload'],
        },
        filters: [
          {
            id: 'status',
            param: 'status',
            labelKey: 'content.filters.statusLabel',
            bindingKey: 'content.status',
            defaultValue: 'all',
            options: [
              { value: 'all', labelKey: 'content.filters.statusAll' },
              { value: 'draft', labelKey: 'content.status.draft' },
              { value: 'in_review', labelKey: 'content.status.inReview' },
              { value: 'approved', labelKey: 'content.status.approved' },
              { value: 'published', labelKey: 'content.status.published' },
              { value: 'archived', labelKey: 'content.status.archived' },
            ],
          },
        ],
        sorting: {
          param: 'sort',
          defaultField: 'updatedAt',
          defaultDirection: 'desc',
          fields: [
            { id: 'title', labelKey: 'content.table.headerTitle', bindingKey: 'content.title' },
            { id: 'contentType', labelKey: 'content.table.headerType', bindingKey: 'content.contentType' },
            { id: 'publishedAt', labelKey: 'content.table.headerPublished', bindingKey: 'content.publishedAt' },
            { id: 'createdAt', labelKey: 'content.table.headerCreated', bindingKey: 'content.createdAt' },
            { id: 'updatedAt', labelKey: 'content.table.headerUpdated', bindingKey: 'content.updatedAt' },
            { id: 'author', labelKey: 'content.table.headerAuthor', bindingKey: 'content.author' },
            { id: 'status', labelKey: 'content.table.headerStatus', bindingKey: 'content.status' },
          ],
        },
        pagination: {
          pageParam: 'page',
          pageSizeParam: 'pageSize',
          defaultPageSize: 25,
          pageSizeOptions: [10, 25, 50, 100],
        },
        bulkActions: [
          {
            id: 'archive',
            labelKey: 'content.actions.archive',
            actionId: 'content.archive',
            bindingKey: 'content.bulk.archive',
            selectionModes: ['explicitIds', 'currentPage', 'allMatchingQuery'],
          },
          {
            id: 'delete',
            labelKey: 'content.actions.delete',
            actionId: 'content.delete',
            bindingKey: 'content.bulk.delete',
            selectionModes: ['explicitIds'],
          },
        ],
      },
      detail: {
        history: {
          bindingKey: 'content.history',
          titleKey: 'content.history.title',
        },
        revisions: {
          bindingKey: 'content.revisions',
          restoreActionId: 'content.restore',
          titleKey: 'content.revisions.title',
        },
      },
    },
  },
] as const satisfies readonly AdminResourceDefinition[];
