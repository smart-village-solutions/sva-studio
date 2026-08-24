import {
  buildWasteAnnualTourTransferFingerprint,
  type WasteAnnualTourTransferCreateInput,
} from '@sva/core';

import { renewIdempotencyLease, reserveIdempotency } from '../../iam-account-management/shared.js';
import { createApiError } from '../../shared/request-helpers.js';

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
}): Promise<AnnualTourTransferReservation> => {
  const reservation = await reserveIdempotency({
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
}): (() => Promise<boolean>) => {
  const renewalInput = { ...input, endpoint: annualTourTransferEndpoint };
  let active = true;
  let renewal = Promise.resolve(true);
  const timer = setInterval(() => {
    renewal = renewal
      .then((owned) => (owned ? renewIdempotencyLease(renewalInput) : false))
      .catch(() => false);
  }, annualTourTransferHeartbeatMs);
  timer.unref();
  return async () => {
    if (!active) return renewal;
    active = false;
    clearInterval(timer);
    const owned = await renewal;
    return owned ? renewIdempotencyLease(renewalInput) : false;
  };
};
