import type { Envelope, KeyIdentity, Transfer } from './organisation-key-contracts.js';
import { b64, bytes, enc, sha, open, seal, possessionProof } from './organisation-key-crypto.js';

interface Member {
  conversationId: string;
  keyId: string;
}
interface Wrap extends Member {
  envelope: Envelope;
}
const canonical = (e: Envelope) => enc(e.v, e.t, bytes(e.R), bytes(e.nonce), bytes(e.ct));
const memberId = (member: Member) => member.conversationId + '/' + member.keyId;
const ordered = <T extends Member>(members: readonly T[]) =>
  [...members].sort((a, b) => (memberId(a) < memberId(b) ? -1 : memberId(a) > memberId(b) ? 1 : 0));
export const transferProof = async (
  key: CryptoKey,
  id: KeyIdentity,
  actor: string,
  prep: Transfer,
  reason: string,
  wraps: Wrap[]
) => {
  const results = await Promise.all(
    ordered(wraps).map(async (w) =>
      enc(w.conversationId, w.keyId, await sha(canonical(w.envelope)))
    )
  );
  const result = await sha(enc('SSF-TRANSFER-WRAPS-V1', ...results));
  const target = prep.targetKey;
  return possessionProof(
    key,
    id,
    actor,
    prep.transferId,
    'transfer',
    prep.expiresAt,
    prep.challengeEnvelope,
    enc(
      'SSF-ACCESS-TRANSFER-V1',
      id.tenantId,
      actor,
      prep.transferId,
      id.keyId,
      id.version,
      bytes(id.fingerprint),
      target.userSub,
      target.version,
      bytes(target.fingerprint),
      bytes(prep.scopeDigest),
      await sha(new TextEncoder().encode(reason)),
      result,
      prep.expiresAt
    )
  );
};
export const verifyPreview = async (
  id: KeyIdentity,
  prep: Transfer,
  expected: readonly Member[]
) => {
  const orderedKeys = ordered(prep.keys);
  const target = prep.targetKey;
  if (
    prep.organisationKey.keyId !== id.keyId ||
    prep.organisationKey.version !== id.version ||
    prep.organisationKey.fingerprint !== id.fingerprint ||
    prep.organisationKey.publicKey !== id.publicKey ||
    !expected.length ||
    expected.length > 1000 ||
    prep.keys.length !== expected.length ||
    new Set(expected.map(memberId)).size !== expected.length ||
    ordered(expected).some((m, i) => memberId(m) !== memberId(orderedKeys[i]!))
  )
    throw new Error('SCOPE_CHANGED');
  if (
    b64(
      await sha(
        enc(
          'ssf-rec/fpr/v1',
          id.tenantId,
          target.userSub,
          bytes(target.encPub),
          bytes(target.sigPub)
        )
      )
    ) !== target.fingerprint
  )
    throw new Error('KEY_VERSION_CHANGED');
  const members = await Promise.all(
    ordered(prep.keys).map(async (item) =>
      sha(
        enc(
          item.conversationId,
          item.keyId,
          item.epoch,
          id.keyId,
          id.version,
          await sha(canonical(item.sourceWrap.envelope))
        )
      )
    )
  );
  if (b64(await sha(enc('SSF-TRANSFER-SCOPE-V1', ...members))) !== prep.scopeDigest)
    throw new Error('SCOPE_CHANGED');
};
export const rewrapTransfer = async (
  key: CryptoKey,
  id: KeyIdentity,
  actor: string,
  prep: Transfer,
  reason: string,
  expected: readonly Member[],
  signal: AbortSignal
) => {
  await verifyPreview(id, prep, expected);
  const wraps: Wrap[] = [];
  for (const item of ordered(prep.keys)) {
    signal.throwIfAborted();
    const source = [
      id.tenantId,
      item.conversationId,
      item.keyId,
      'organisation',
      id.keyId,
      id.version,
      bytes(id.fingerprint),
    ];
    const signer = await crypto.subtle.importKey(
      'raw',
      bytes(item.sourceSigner.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      signer,
      bytes(item.sourceWrap.signature),
      await sha(enc('SSF-CK-WRAP-SIG-V2', enc(...source), canonical(item.sourceWrap.envelope)))
    );
    if (!verified) throw new Error('INVALID_KEY');
    const content = await open(
      key,
      id.publicKey,
      item.sourceWrap.envelope,
      'SSF-CK-WRAP-V2',
      source
    );
    try {
      const target = prep.targetKey;
      const envelope = await seal('SSF-CK-WRAP-V2', target.encPub, content, [
        id.tenantId,
        item.conversationId,
        item.keyId,
        'user',
        target.userSub,
        target.version,
        bytes(target.fingerprint),
      ]);
      wraps.push({ conversationId: item.conversationId, keyId: item.keyId, envelope });
    } finally {
      content.fill(0);
    }
  }
  signal.throwIfAborted();
  return { wraps, proof: await transferProof(key, id, actor, prep, reason, wraps) };
};
