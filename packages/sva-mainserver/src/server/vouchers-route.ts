import { z } from 'zod';
import {
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import { errorJson, isResponse, json } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  resolveMainserverMutationActor,
  runMainserverMutationWithFailureFinalization,
} from './mutation-principal.js';
import {
  changeSvaMainserverGenericItemVisibility,
  deleteSvaMainserverVoucher,
  getSvaMainserverVoucher,
} from './service.js';
import { TYPE, BASE, local } from './vouchers-route-access.js';
import { mutate } from './vouchers-route-write.js';
import { reconcile, locations, read } from './vouchers-route-read.js';
const logger = createSdkLogger({ component: 'sva-mainserver-vouchers-route', level: 'info' });
const remove = async (request: Request, ctx: AuthenticatedRequestContext, id: string) => {
  if (validateCsrf(request))
    return errorJson(403, 'csrf_validation_failed', 'csrf_validation_failed');
  const authorized = await local(ctx, 'vouchers.delete', id);
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor: authorized });
  if (isResponse(actor)) return actor;
  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: id,
    operation: async () => {
      const item = await getSvaMainserverVoucher({ ...actor, voucherId: id });
      const check = await authorizeMainserverExistingContent({
        actor,
        action: 'vouchers.delete',
        contentType: TYPE,
        contentId: id,
        item: { id: item.id, dataProvider: item.dataProvider ?? undefined },
      });
      if (isResponse(check)) return check;
      const data = await deleteSvaMainserverVoucher({ ...actor, voucherId: id });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
        contentId: id,
        observedDataProviderId: item.dataProvider?.id,
      });
      return json({ data });
    },
  });
};
const visibility = async (request: Request, ctx: AuthenticatedRequestContext, id: string) => {
  if (validateCsrf(request))
    return errorJson(403, 'csrf_validation_failed', 'csrf_validation_failed');
  const parsed = z
    .object({ visible: z.boolean() })
    .strict()
    .safeParse(await request.json());
  if (!parsed.success) return errorJson(400, 'voucher_invalid_input', 'voucher_invalid_input');
  const authorized = await local(ctx, 'vouchers.publish', id);
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor: authorized });
  if (isResponse(actor)) return actor;
  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: id,
    operation: async () => {
      const item = await getSvaMainserverVoucher({ ...actor, voucherId: id });
      const check = await authorizeMainserverExistingContent({
        actor,
        action: 'vouchers.publish',
        contentType: TYPE,
        contentId: id,
        item: { id: item.id, dataProvider: item.dataProvider ?? undefined },
      });
      if (isResponse(check)) return check;
      await changeSvaMainserverGenericItemVisibility({
        ...actor,
        genericItemId: id,
        visible: parsed.data.visible,
      });
      const data = await getSvaMainserverVoucher({ ...actor, voucherId: id });
      if (data.visible !== parsed.data.visible) throw new Error('voucher_reconciliation_required');
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'readback'],
        contentId: id,
        observedDataProviderId: data.dataProvider?.id,
      });
      return json({ data });
    },
  });
};
export const dispatchSvaMainserverVouchersRequest = async (
  request: Request
): Promise<Response | null> => {
  const path = new URL(request.url).pathname;
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return null;
  const suffix = path.slice(BASE.length + 1);
  return withAuthenticatedUser(request, async (ctx) => {
    try {
      let result: Response;
      if (request.method === 'GET' && suffix === 'locations')
        result = await locations(request, ctx);
      else if (request.method === 'GET' && /^\d*$/.test(suffix))
        result = await read(request, ctx, suffix || undefined);
      else if (request.method === 'POST' && suffix === 'reconcile')
        result = await reconcile(request, ctx);
      else if (request.method === 'POST' && ['prepare', 'commit'].includes(suffix))
        result = await mutate(request, ctx, suffix);
      else if (request.method === 'POST' && /^\d+\/visibility$/.test(suffix))
        result = await visibility(request, ctx, suffix.split('/')[0]!);
      else if (request.method === 'DELETE' && /^\d+$/.test(suffix))
        result = await remove(request, ctx, suffix);
      else result = errorJson(405, 'method_not_allowed', 'method_not_allowed');
      return withMainserverContextBinding(result, ctx);
    } catch (error) {
      const code =
        error instanceof Error && /^voucher_[a-z_]+$/.test(error.message)
          ? error.message
          : 'voucher_request_failed';
      logger.warn('Voucher request failed', {
        operation: 'vouchers_request',
        instance_id: ctx.user.instanceId,
        error_code: code,
      });
      return errorJson(code === 'voucher_request_failed' ? 502 : 409, code, code);
    }
  });
};
