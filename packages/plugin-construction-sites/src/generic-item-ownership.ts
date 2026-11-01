import { defineMainserverGenericItemOwnership } from '@sva/plugin-sdk';
import { CONSTRUCTION_SITES_TYPE, CONSTRUCTION_SITES_GENERIC_TYPE } from './contract.js';
export const constructionSitesMainserverGenericItemOwnership = defineMainserverGenericItemOwnership(
  {
    contentType: CONSTRUCTION_SITES_TYPE,
    mainserverGenericType: CONSTRUCTION_SITES_GENERIC_TYPE,
  }
);
