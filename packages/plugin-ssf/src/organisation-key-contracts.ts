import { z } from 'zod';

export const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
export const subject = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,254}$/u);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const binary = z.string().regex(/^[A-Za-z0-9_-]+$/u);
export const publicKey = binary.length(87);
export const digest = binary.length(43);
const instant = z.iso.datetime({ offset: false });
export const envelope = z.strictObject({
  v: z.literal(1),
  t: z.enum(['SSF-CK-WRAP-V2', 'SSF-ORG-POSSESSION-V1']),
  R: publicKey,
  nonce: binary.length(16),
  ct: binary.length(64),
});
export type Envelope = z.infer<typeof envelope>;
export const keyIdentity = z.strictObject({ keyId: uuid, version, publicKey, fingerprint: digest });
export const fileSchema = keyIdentity.extend({
  tenantId: z.string().min(1).max(128),
  format: z.literal('ssf-organisation-key'),
  formatVersion: z.literal(1),
  privateKeyPkcs8: binary.max(1024),
});
export const organisationKey = keyIdentity.extend({
  state: z.enum(['prepared', 'active', 'superseded']),
  createdAt: instant,
  activatedAt: instant.nullable(),
});
export type OrganisationKey = z.infer<typeof organisationKey>;
export type KeyIdentity = z.infer<typeof keyIdentity> & { tenantId: string };
export const keyList = z.strictObject({
  activeKeyId: uuid.nullable(),
  keys: z.array(organisationKey),
});
export const activation = z.strictObject({
  preparationId: uuid,
  keyId: uuid,
  version,
  fingerprint: digest,
  expiresAt: instant,
  challengeEnvelope: envelope,
});
export type Activation = z.infer<typeof activation>;
export const candidate = z.strictObject({
  conversationId: uuid,
  employeeSub: subject,
  startedAt: instant,
  endedAt: instant.nullable(),
  keyIds: z.array(uuid).nonempty(),
  organisationKeyIds: z.array(uuid).nonempty(),
  keyScopes: z.array(z.strictObject({ keyId: uuid, organisationKeyId: uuid })).nonempty(),
});
export type Candidate = z.infer<typeof candidate>;
export const candidates = z.strictObject({
  items: z.array(candidate).max(50),
  nextCursor: z.string().min(1).max(2048).nullable(),
});
export const targetKey = z.strictObject({
  userSub: subject,
  version,
  fingerprint: digest,
  encPub: publicKey,
  sigPub: publicKey,
});
export const transferInput = z.strictObject({
  conversationIds: z
    .array(uuid)
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length),
  organisationKeyId: uuid,
  targetUserSub: subject,
  expectedTargetKeyVersion: version,
  expectedTargetFingerprint: digest,
  reason: z
    .string()
    .min(1)
    .max(1000)
    .refine((s) => s.trim().length > 0),
});
export const transfer = z.strictObject({
  transferId: uuid,
  expiresAt: instant,
  scopeDigest: digest,
  organisationKey,
  targetKey,
  challengeEnvelope: envelope,
  keys: z
    .array(
      z.strictObject({
        conversationId: uuid,
        keyId: uuid,
        epoch: z.number().int().min(0),
        sourceWrap: z.strictObject({ envelope, signature: binary.length(86) }),
        sourceSigner: z.strictObject({ keyId: z.string().min(1).max(256), publicKey }),
      })
    )
    .min(1)
    .max(1000),
});
export type Transfer = z.infer<typeof transfer>;
export const submittedWrap = z.strictObject({ conversationId: uuid, keyId: uuid, envelope });
export const receipt = z.strictObject({
  transferId: uuid,
  status: z.literal('committed'),
  targetUserSub: subject,
  targetKeyVersion: version,
  scopeDigest: digest,
  grantedKeyIds: z.array(uuid).min(1).max(1000),
  committedAt: instant,
});
export const operationSchemas = {
  list: {
    id: 'ssf.organisation-keys.read',
    method: 'GET',
    path: '/organisation-keys',
    output: keyList,
  },
  prepareKey: {
    id: 'ssf.organisation-keys.prepare',
    method: 'POST',
    path: '/organisation-keys/preparations',
    input: z.strictObject({ publicKey, expectedActiveKeyId: uuid.nullable() }),
    output: activation,
  },
  activate: {
    id: 'ssf.organisation-keys.activate',
    method: 'POST',
    path: '/organisation-keys/preparations/$id/activate',
    input: z.strictObject({ proof: digest, savedConfirmation: z.literal(true) }),
    output: organisationKey,
  },
  abandon: {
    id: 'ssf.organisation-keys.abandon',
    method: 'DELETE',
    path: '/organisation-keys/preparations/$id',
    output: z.null(),
  },
  candidates: {
    id: 'ssf.access-transfer.candidates',
    method: 'GET',
    path: '/access-transfer/candidates',
    output: candidates,
  },
  target: {
    id: 'ssf.access-transfer.target',
    method: 'GET',
    path: '/access-transfer/targets/$sub',
    output: targetKey,
  },
  prepareTransfer: {
    id: 'ssf.access-transfer.prepare',
    method: 'POST',
    path: '/access-transfer/preparations',
    input: transferInput,
    output: transfer,
  },
  commit: {
    id: 'ssf.access-transfer.commit',
    method: 'POST',
    path: '/access-transfer/preparations/$id/commit',
    input: z.strictObject({ proof: digest, wraps: z.array(submittedWrap).min(1).max(1000) }),
    output: receipt,
  },
} as const;
export const pluginRecordingBase = '/api/v1/ssf/recording/v2';
export const errors = z.enum([
  'STEP_UP_REQUIRED',
  'PERMISSION_REQUIRED',
  'PREPARATION_NOT_FOUND',
  'KEY_VERSION_CHANGED',
  'SCOPE_CHANGED',
  'PREPARATION_USED',
  'PREPARATION_EXPIRED',
  'INVALID_KEY',
  'INVALID_PROOF',
  'TRANSFER_SCOPE_TOO_LARGE',
  'RECORDING_UNAVAILABLE',
]);
