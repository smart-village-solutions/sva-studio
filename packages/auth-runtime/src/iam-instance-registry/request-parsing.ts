import { parseRequestBody } from '../iam-account-management/api-helpers.js';

export const parseRegistryRequestBody = async <T>(
  request: Request,
  schema: unknown
): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
  const result = await parseRequestBody(request, schema as Parameters<typeof parseRequestBody>[1]);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, data: result.data as T };
};
