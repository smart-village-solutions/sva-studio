import { rewrapTransfer, verifyPreview } from './access-transfer-crypto.js';
import { requestOperation } from './organisation-key-client.js';
import type {
  Candidate,
  KeyIdentity,
  OrganisationKey,
  Transfer,
} from './organisation-key-contracts.js';

export type ScopeMember = { conversationId: string; keyId: string };
export interface TransferPreview {
  transfer: Transfer;
  id: KeyIdentity;
  members: ScopeMember[];
}
export type TransferReceipt = Awaited<ReturnType<typeof requestOperation<'commit'>>>;
export interface TransferSubmission {
  transferId: string;
  scopeDigest: string;
  targetUserSub: string;
  targetKeyVersion: number;
  body: Awaited<ReturnType<typeof rewrapTransfer>>;
}

export async function readCandidates(source: string, cursor: string | null, signal: AbortSignal) {
  const query = new URLSearchParams({ employeeSub: source });
  if (cursor) query.set('cursor', cursor);
  const page = await requestOperation('candidates', { query, signal });
  for (const candidate of page.items) {
    const { keyScopes, keyIds, organisationKeyIds } = candidate;
    if (
      candidate.employeeSub !== source ||
      keyScopes.length !== keyIds.length ||
      new Set(keyScopes.map((scope) => scope.keyId)).size !== keyIds.length ||
      keyScopes.some(
        (scope) =>
          !keyIds.includes(scope.keyId) || !organisationKeyIds.includes(scope.organisationKeyId)
      )
    ) {
      throw new Error('SCOPE_CHANGED');
    }
  }
  return page;
}

export function groupTransferScope(items: Candidate[], selected: string[]) {
  const groups = new Map<string, ScopeMember[]>();
  for (const candidate of items.filter((c) => selected.includes(c.conversationId))) {
    for (const scope of candidate.keyScopes) {
      const members = groups.get(scope.organisationKeyId) ?? [];
      members.push({ conversationId: candidate.conversationId, keyId: scope.keyId });
      groups.set(scope.organisationKeyId, members);
    }
  }
  return groups;
}

export async function prepareTransfer(
  tenantId: string,
  org: OrganisationKey | undefined,
  target: string,
  reason: string,
  members: ScopeMember[],
  signal: AbortSignal
): Promise<TransferPreview> {
  if (!org) throw new Error('KEY_VERSION_CHANGED');
  const proposed = await requestOperation('target', { sub: target, signal });
  if (proposed.userSub !== target) throw new Error('KEY_VERSION_CHANGED');
  const transfer = await requestOperation('prepareTransfer', {
    body: {
      conversationIds: [...new Set(members.map((m) => m.conversationId))],
      organisationKeyId: org.keyId,
      targetUserSub: target,
      expectedTargetKeyVersion: proposed.version,
      expectedTargetFingerprint: proposed.fingerprint,
      reason,
    },
    signal,
  });
  if (
    transfer.targetKey.userSub !== target ||
    transfer.targetKey.version !== proposed.version ||
    transfer.targetKey.fingerprint !== proposed.fingerprint
  )
    throw new Error('KEY_VERSION_CHANGED');
  const id = {
    tenantId,
    keyId: org.keyId,
    version: org.version,
    publicKey: org.publicKey,
    fingerprint: org.fingerprint,
  };
  await verifyPreview(id, transfer, members);
  return { transfer, id, members };
}

export async function confirmTransfer(
  key: CryptoKey,
  preview: TransferPreview,
  actor: string,
  reason: string,
  signal: AbortSignal
): Promise<TransferSubmission> {
  const { id, transfer, members } = preview;
  const body = await rewrapTransfer(key, id, actor, transfer, reason, members, signal);
  signal.throwIfAborted();
  return {
    transferId: transfer.transferId,
    targetUserSub: transfer.targetKey.userSub,
    targetKeyVersion: transfer.targetKey.version,
    scopeDigest: transfer.scopeDigest,
    body,
  };
}

export async function sendTransfer(command: TransferSubmission, signal: AbortSignal) {
  const receipt = await requestOperation('commit', {
    id: command.transferId,
    body: command.body,
    signal,
  });
  signal.throwIfAborted();
  if (
    receipt.transferId !== command.transferId ||
    receipt.scopeDigest !== command.scopeDigest ||
    receipt.targetUserSub !== command.targetUserSub ||
    receipt.targetKeyVersion !== command.targetKeyVersion ||
    JSON.stringify([...receipt.grantedKeyIds].sort()) !==
      JSON.stringify(command.body.wraps.map((w) => w.keyId).sort())
  ) {
    throw new Error('RECORDING_UNAVAILABLE');
  }
  return receipt;
}
