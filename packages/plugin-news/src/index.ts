import { pluginNews as descriptor } from './plugin.js';
export { NEWS_CONTENT_TYPE } from './news.constants.js';
export {
  listNews,
  getNews,
  createNews,
  updateNews,
  deleteNews,
  setNewsVisibility,
  updateNewsPartial,
  saveNewsEditorItem,
} from './news.api.js';
export { NewsDetailPage } from './news.detail-page.js';
export { NewsCreatePage, NewsEditPage } from './news.pages.js';
import { NewsCreatePage, NewsEditPage } from './news.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'newsDetail', component: NewsEditPage },
  { bindingKey: 'newsEditor', component: NewsCreatePage, allowPrincipalContextSwitch: true },
] as const;
export { validateNewsForm, validateNewsPayload } from './news.validation.js';
export type * from './news.public-types.js';

import { deleteNews, getNews, setNewsVisibility } from './news.api.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';

const contentMutations: ContentTypeMutations = {
  delete: { requiredAction: 'news.delete', execute: deleteNews },
  status: {
    requiredAction: 'news.update',
    supportedStatuses: ['draft', 'published'],
    execute: async (contentId, status, principal) => {
      await getNews(contentId);
      await setNewsVisibility(contentId, status === 'published', principal);
    },
  },
};
export const pluginNews: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};
