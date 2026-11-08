import { defineMainserverGenericItemOwnership } from '@sva/plugin-sdk';
import { JOBS_TYPE, JOBS_GENERIC_TYPE } from './contract.js';
export const jobsMainserverGenericItemOwnership = defineMainserverGenericItemOwnership({
  contentType: JOBS_TYPE,
  mainserverGenericType: JOBS_GENERIC_TYPE,
});
