export { pluginFaq } from './plugin.js';
export { FaqCreatePage, FaqEditPage, FaqListPage } from './faq.pages.js';
export { createFaq, deleteFaq, getFaq, listFaqs, updateFaq, FaqApiError } from './faq.api.js';
import { FaqCreatePage, FaqEditPage, FaqListPage } from './faq.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'faqList', component: FaqListPage },
  { bindingKey: 'faqDetail', component: FaqEditPage },
  { bindingKey: 'faqEditor', component: FaqCreatePage },
] as const;
