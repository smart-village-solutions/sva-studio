import {
  buildWasteAnnualTourTransferFingerprint,
  type WasteAnnualTourTransferCreateInput,
} from '@sva/waste-management-contracts';

import { createApiError } from '@sva/server-runtime';
import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

export const annualTourTransferEndpoint = 'POST:/api/v1/waste-management/tours/annual-transfer';
const annualTourTransferIdempotencyLeaseMs = 5 * 60 * 1_000;
const annualTourTransferHeartbeatMs = 60 * 1_000;

type AnnualTourTransferReservation =
  Readonly<{ response: Response }> | Readonly<{ leaseToken: string }>;

export const reserveAnnualTourTransfer = async (input: {
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
  create: WasteAnnualTourTransferCreateInput;
  requestId?: string;
  deps: WasteManagementHandlerDeps;
}): Promise<AnnualTourTransferReservation> => {
  const reservation = await requireDeps(input.deps.reserveIdempotency, 'reserveIdempotency')({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: annualTourTransferEndpoint,
    idempotencyKey: input.idempotencyKey,
    payloadHash: await buildWasteAnnualTourTransferFingerprint(input.create),
    inProgressLeaseMs: annualTourTransferIdempotencyLeaseMs,
  });
  if (reservation.status === 'replay') {
    return {
      response: new Response(JSON.stringify(reservation.responseBody), {
        status: reservation.responseStatus,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  if (reservation.status === 'conflict') {
    return {
      response: createApiError(
        409,
        reservation.reason === 'in_progress' ? 'idempotency_in_progress' : 'idempotency_key_reuse',
        reservation.message,
        input.requestId
      ),
    };
  }
  if (!reservation.leaseToken) throw new Error('idempotency_lease_missing');
  return { leaseToken: reservation.leaseToken };
};

export const startAnnualTourTransferLeaseHeartbeat = (input: {
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
  leaseToken: string;
  deps: WasteManagementHandlerDeps;
}) => {
  const renewalInput = {
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    idempotencyKey: input.idempotencyKey,
    leaseToken: input.leaseToken,
    endpoint: annualTourTransferEndpoint,
  };
  const renew = requireDeps(input.deps.renewIdempotencyLease, 'renewIdempotencyLease');
  let active = true;
  let renewal = Promise.resolve(true);
  const timer = setInterval(() => {
    renewal = renewal
      .then((owned) => (owned ? renew(renewalInput) : false))
      .catch(() => false);
  }, annualTourTransferHeartbeatMs);
  timer.unref();
  const verify = async () => {
    renewal = renewal
      .then((owned) => (owned ? renew(renewalInput) : false))
      .catch(() => false);
    return renewal;
  };
  const stop = async () => {
    if (active) clearInterval(timer);
    active = false;
    return renewal;
  };
  return { verify, stop } as const;
};
