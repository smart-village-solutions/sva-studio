import type { ApiItemResponse, MailTemplateView } from '@sva/core';
import { patchJson, requestJson } from './iam-http-client';
import type { MailTemplateMutationPayload } from './iam-api-instance-types';

export const getTenantEmailVerificationTemplate = () =>
  requestJson<ApiItemResponse<MailTemplateView>>(
    '/api/v1/iam/users/me/email-verification-template'
  );

export const updateTenantEmailVerificationTemplate = (payload: MailTemplateMutationPayload) =>
  patchJson<ApiItemResponse<MailTemplateView>, MailTemplateMutationPayload>(
    '/api/v1/iam/users/me/email-verification-template',
    payload
  );
