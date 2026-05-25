export { pluginNews } from './plugin.js';
export { NEWS_CONTENT_TYPE } from './news.constants.js';
export { listNews, getNews, createNews, updateNews, deleteNews, updateNewsPartial } from './news.api.js';
export { NewsCreatePage, NewsEditPage, NewsListPage } from './news.pages.js';
export { validateNewsForm, validateNewsPayload } from './news.validation.js';
export type { NewsContentItem, NewsFormInput, NewsListQuery, NewsListResult, NewsPayload, NewsStatus } from './news.types.js';
