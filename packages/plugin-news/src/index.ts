export { pluginNews } from './plugin.js';
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
