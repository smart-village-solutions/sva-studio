export const iamContentAccessStates = [
  'editable',
  'read_only',
  'blocked',
  'server_denied',
] as const;
export const iamContentAccessReasonCodes = [
  'content_read_missing',
  'content_update_missing',
  'context_restricted',
  'server_forbidden',
] as const;

export type IamContentAccessState = (typeof iamContentAccessStates)[number];
export type IamContentAccessReasonCode = (typeof iamContentAccessReasonCodes)[number];

export type ContentJsonPrimitive = string | number | boolean | null;
export type ContentJsonValue =
  ContentJsonPrimitive | { readonly [key: string]: ContentJsonValue } | readonly ContentJsonValue[];
