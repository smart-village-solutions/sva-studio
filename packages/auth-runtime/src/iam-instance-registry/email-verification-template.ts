import { isValidInstanceId, type MailTemplateSource } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { isRegistryServiceContext, type RegistryRequestContext } from './auth-context.js';
import { ensurePlatformAccess, requireFreshReauth } from './http.js';
import {
  MailTemplateConflict,
  mutateMailTemplate,
  readMailTemplate,
  readServerEmailVerificationTemplate,
  saveServerEmailVerificationTemplate,
} from './mail-template-sync.js';
const texts = z.record(z.string().max(100), z.string().max(30000));
const verification = z
  .object({ subject: z.string().max(200), body: z.string().max(5000) })
  .strict();
const invitation = verification
  .extend({
    revision: z.number().int().nonnegative(),
    passwordSetupLinkLabel: z.string().max(120),
    tenantHomepageLinkLabel: z.string().max(120),
  })
  .strict();
const schema = z
  .object({
    operation: z.enum(['save', 'transfer', 'adopt']),
    expectedRevision: z.number().int().nonnegative(),
    template: z.union([invitation, verification]).nullable().optional(),
    expectedStudioTexts: texts.optional(),
    expectedKeycloakTexts: texts.optional(),
  })
  .strict();
const json = (status: number, data: unknown) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (status: number, code: string) => json(status, { error: { code, message: code } });
const requireTemplateAccess = (request: Request, ctx: RegistryRequestContext): Response | null => {
  const denied = ensurePlatformAccess(request, ctx);
  if (denied) return denied;
  return request.method === 'PATCH'
    ? ((!isRegistryServiceContext(ctx)
        ? validateCsrf(request, getWorkspaceContext().requestId)
        : null) ?? requireFreshReauth(request, ctx))
    : null;
};
export const emailVerificationTemplateInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  const denied = requireTemplateAccess(request, ctx);
  if (denied) return denied;
  const writing = request.method === 'PATCH';
  let id: string;
  try {
    id = decodeURIComponent(new URL(request.url).pathname.split('/')[5] ?? '');
  } catch {
    return failure(400, 'invalid_request');
  }
  const kind = new URL(request.url).pathname.split('/')[8];
  if (!isValidInstanceId(id) || (kind !== 'invitation' && kind !== 'verification'))
    return failure(400, 'invalid_request');
  const parsed = writing ? schema.safeParse(await request.json().catch(() => null)) : null;
  if (parsed && !parsed.success) return failure(400, 'invalid_request');
  if (parsed?.success && parsed.data.operation === 'save' && parsed.data.template === undefined)
    return failure(400, 'invalid_request');
  if (
    parsed?.success &&
    parsed.data.operation === 'save' &&
    parsed.data.template &&
    !(kind === 'invitation' ? invitation : verification).safeParse(parsed.data.template).success
  )
    return failure(400, 'invalid_request');
  try {
    const data = parsed?.success
      ? await mutateMailTemplate(
          id,
          kind,
          {
            ...parsed.data,
            template: parsed.data.template as MailTemplateSource | null | undefined,
          },
          ctx.user.id
        )
      : await readMailTemplate(id, kind);
    return json(200, { data });
  } catch (error) {
    if (
      error instanceof MailTemplateConflict ||
      (error instanceof Error && error.message === 'mail_template_revision_conflict')
    )
      return failure(409, 'mail_template_conflict');
    if (error instanceof Error && error.message === 'not_found') return failure(404, 'not_found');
    if (
      error instanceof Error &&
      ('field' in error || error.message === 'mail_template_adoption_unsupported')
    )
      return failure(400, 'invalid_mail_template');
    return failure(503, 'mail_template_unavailable');
  }
};

const serverSchema = z
  .object({ expectedRevision: z.number().int().nonnegative(), template: verification.nullable() })
  .strict();
export const serverEmailVerificationTemplateInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  const denied = requireTemplateAccess(request, ctx);
  if (denied) return denied;
  const parsed =
    request.method === 'PATCH'
      ? serverSchema.safeParse(await request.json().catch(() => null))
      : null;
  if (parsed && !parsed.success) return failure(400, 'invalid_request');
  try {
    const data = parsed?.success
      ? await saveServerEmailVerificationTemplate({ ...parsed.data, actorId: ctx.user.id })
      : await readServerEmailVerificationTemplate();
    return json(200, { data });
  } catch (error) {
    if (error instanceof Error && error.message === 'mail_template_revision_conflict')
      return failure(409, 'mail_template_conflict');
    if (error instanceof Error && 'field' in error) return failure(400, 'invalid_mail_template');
    return failure(503, 'mail_template_unavailable');
  }
};
