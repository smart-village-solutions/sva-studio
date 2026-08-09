import { defineMainserverGenericItemOwnership } from '@sva/plugin-sdk';

import { COCKPIT_CARD_CONTENT_TYPE, COCKPIT_CARD_GENERIC_TYPE } from './cockpit-cards.constants.js';

export const cockpitCardsMainserverGenericItemOwnership = defineMainserverGenericItemOwnership({
  contentType: COCKPIT_CARD_CONTENT_TYPE,
  mainserverGenericType: COCKPIT_CARD_GENERIC_TYPE,
});
