import { defineMainserverGenericItemOwnership } from '@sva/plugin-sdk';

import { PROJECTS_CONTENT_TYPE, PROJECTS_GENERIC_TYPE } from './projects.constants.js';

export const projectsMainserverGenericItemOwnership = defineMainserverGenericItemOwnership({
  contentType: PROJECTS_CONTENT_TYPE,
  mainserverGenericType: PROJECTS_GENERIC_TYPE,
});
