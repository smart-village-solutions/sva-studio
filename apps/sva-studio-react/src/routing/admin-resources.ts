import type { AdminResourceDefinition } from '@sva/sdk';

export const appAdminResources = [
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
  },
] as const satisfies readonly AdminResourceDefinition[];
