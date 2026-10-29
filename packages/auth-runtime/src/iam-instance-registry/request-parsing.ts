import { parseRequestBody } from '../iam-account-management/api-helpers.js';

export const parseRegistryRequestBody = async <T>(
  request: Request,
  schema: Parameters<typeof parseRequestBody<T>>[1]
): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
  const result = await parseRequestBody(request, schema);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, data: result.data };
};
