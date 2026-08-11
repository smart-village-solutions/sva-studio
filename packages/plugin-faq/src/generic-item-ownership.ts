import { defineMainserverGenericItemOwnership } from '@sva/plugin-sdk';

import { FAQ_CONTENT_TYPE, FAQ_GENERIC_TYPE } from './faq.constants.js';

export const faqMainserverGenericItemOwnership = defineMainserverGenericItemOwnership({
  contentType: FAQ_CONTENT_TYPE,
  mainserverGenericType: FAQ_GENERIC_TYPE,
});
