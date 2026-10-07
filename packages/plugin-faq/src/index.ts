import { pluginFaq as descriptor } from './plugin.js';
export { FaqCreatePage, FaqEditPage, FaqListPage } from './faq.pages.js';
export { createFaq, deleteFaq, getFaq, listFaqs, updateFaq, FaqApiError } from './faq.api.js';
import { FaqCreatePage, FaqEditPage, FaqListPage } from './faq.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'faqList', component: FaqListPage },
  { bindingKey: 'faqDetail', component: FaqEditPage },
  { bindingKey: 'faqEditor', component: FaqCreatePage },
] as const;

import { deleteFaq } from './faq.api.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';

const contentMutations: ContentTypeMutations = {
  delete: { requiredAction: 'faq.delete', execute: deleteFaq },
};
export const pluginFaq: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};
