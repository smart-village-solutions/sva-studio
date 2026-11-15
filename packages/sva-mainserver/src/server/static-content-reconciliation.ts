/**
 * Pure preparation of the two initial App configuration field groups.
 * The host must supply fresh snapshots and an authenticated field scope. This
 * function neither authorizes requests nor reads/writes the Mainserver.
 */
import { applyEdits, modify, parseTree, type Node, type ParseError } from 'jsonc-parser';
import { z } from 'zod';

const fieldPaths = {
  'settings.locationService.showAlternativeLocationButton': [
    'settings',
    'locationService',
    'showAlternativeLocationButton',
  ],
  'appDesignSystem.serviceTiles.numberOfLines': [
    'appDesignSystem',
    'serviceTiles',
    'numberOfLines',
  ],
} as const;

export type AppConfigurationField = keyof typeof fieldPaths;
const fieldScopes: Record<AppConfigurationField, 'general' | 'design'> = {
  'settings.locationService.showAlternativeLocationButton': 'general',
  'appDesignSystem.serviceTiles.numberOfLines': 'design',
};
const fieldSchema = z.enum([
  'settings.locationService.showAlternativeLocationButton',
  'appDesignSystem.serviceTiles.numberOfLines',
]);
export const appConfigurationSnapshotSchema = z
  .object({
    instanceId: z.string().min(1),
    id: z.string().min(1),
    name: z.string().regex(/^globalsettings$/i),
    dataType: z.literal('json'),
    version: z.string().min(1).nullable(),
    content: z.string(),
  })
  .strict();
const changeSchema = z.union([
  z
    .object({
      field: z.literal('settings.locationService.showAlternativeLocationButton'),
      operation: z.literal('set'),
      value: z.boolean(),
    })
    .strict(),
  z
    .object({
      field: z.literal('appDesignSystem.serviceTiles.numberOfLines'),
      operation: z.literal('set'),
      value: z.number().int().positive(),
    })
    .strict(),
  z.object({ field: fieldSchema, operation: z.literal('remove') }).strict(),
]);
const inputSchema = z
  .object({
    scope: z.enum(['general', 'design']),
    base: appConfigurationSnapshotSchema,
    current: appConfigurationSnapshotSchema,
    changes: z.array(changeSchema).max(2),
  })
  .strict();

/** Snapshots must be bound to the same server-resolved instance and record. */
export type AppConfigurationSnapshot = z.infer<typeof appConfigurationSnapshotSchema>;
export type AppConfigurationFieldChange = z.infer<typeof changeSchema>;
export type AppConfigurationReconciliationInput = z.infer<typeof inputSchema>;
type InvalidCode =
  | 'invalid_request'
  | 'identity_mismatch'
  | 'field_not_owned'
  | 'invalid_document'
  | 'incompatible_container'
  | 'ambiguous_path';
export type AppConfigurationReconciliationResult =
  | Readonly<{ status: 'ready'; content: string; changedFields: readonly AppConfigurationField[] }>
  | Readonly<{ status: 'conflict'; fields: readonly AppConfigurationField[] }>
  | Readonly<{ status: 'invalid'; code: InvalidCode }>;

type FieldState = Readonly<{
  node: Node | undefined;
  parents: readonly ('object' | 'missing')[];
}>;
type FieldRead =
  | Readonly<{ ok: true; state: FieldState }>
  | Readonly<{ ok: false; code: 'ambiguous_path' | 'incompatible_container' }>;

const sameIdentity = (left: AppConfigurationSnapshot, right: AppConfigurationSnapshot): boolean =>
  left.instanceId === right.instanceId &&
  left.id === right.id &&
  left.name === right.name &&
  left.dataType === right.dataType &&
  left.version === right.version;

const parseDocument = (content: string): Node | undefined => {
  const errors: ParseError[] = [];
  try {
    const root = parseTree(content, errors, { disallowComments: true, allowTrailingComma: false });
    return errors.length === 0 && root?.type === 'object' ? root : undefined;
  } catch {
    return undefined;
  }
};

/** Detect ambiguity on the edited path without cleaning unrelated duplicate keys. */
const readField = (root: Node, path: readonly string[]): FieldRead => {
  let node: Node | undefined = root;
  const parents: ('object' | 'missing')[] = [];
  for (const [index, key] of path.entries()) {
    if (node && node.type !== 'object') return { ok: false, code: 'incompatible_container' };
    const matches: Node[] =
      node?.children?.filter((child) => child.children?.[0]?.value === key) ?? [];
    if (matches.length > 1) return { ok: false, code: 'ambiguous_path' };
    node = matches[0]?.children?.[1];
    if (index < path.length - 1) {
      if (node && node.type !== 'object') return { ok: false, code: 'incompatible_container' };
      parents.push(node ? 'object' : 'missing');
    }
  }
  return { ok: true, state: { node, parents } };
};

const sameValue = (
  left: FieldState,
  right: FieldState,
  leftContent: string,
  rightContent: string
): boolean => {
  if (!left.node || !right.node) return left.node === right.node;
  if (left.node.type !== right.node.type) return false;
  const leftValue: unknown = left.node.value;
  const rightValue: unknown = right.node.value;
  if (
    leftValue === null ||
    typeof leftValue === 'boolean' ||
    typeof leftValue === 'string' ||
    (typeof leftValue === 'number' && Number.isSafeInteger(leftValue))
  )
    return leftValue === rightValue;
  return (
    leftContent.slice(left.node.offset, left.node.offset + left.node.length) ===
    rightContent.slice(right.node.offset, right.node.offset + right.node.length)
  );
};

const isTargetValue = (state: FieldState, change: AppConfigurationFieldChange): boolean => {
  if (change.operation === 'remove') return state.node === undefined;
  const value: unknown = state.node?.value;
  return state.node?.type === typeof change.value && value === change.value;
};

const hasRemovedParent = (base: FieldState, current: FieldState): boolean =>
  base.parents.some((parent, index) => parent === 'object' && current.parents[index] === 'missing');

/**
 * Rebase explicit owned field changes on fresh raw JSON. Unknown tokens, including
 * large numbers and duplicate keys outside the edited paths, are not serialized.
 * A ready result is write preparation, never evidence of storage or authorization.
 */
export const reconcileAppConfigurationFields = (
  raw: unknown
): AppConfigurationReconciliationResult => {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', code: 'invalid_request' };
  const { base, current, scope, changes } = parsed.data;
  if (new Set(changes.map((change) => change.field)).size !== changes.length)
    return { status: 'invalid', code: 'invalid_request' };
  if (changes.some((change) => fieldScopes[change.field] !== scope))
    return { status: 'invalid', code: 'field_not_owned' };
  if (!sameIdentity(base, current)) return { status: 'invalid', code: 'identity_mismatch' };
  const baseRoot = parseDocument(base.content);
  const currentRoot = parseDocument(current.content);
  if (!baseRoot || !currentRoot) return { status: 'invalid', code: 'invalid_document' };

  const conflicts: AppConfigurationField[] = [];
  const pending: AppConfigurationFieldChange[] = [];
  for (const change of changes) {
    const previous = readField(baseRoot, fieldPaths[change.field]);
    const fresh = readField(currentRoot, fieldPaths[change.field]);
    if (!previous.ok) return { status: 'invalid', code: previous.code };
    if (!fresh.ok) {
      if (fresh.code === 'ambiguous_path') return { status: 'invalid', code: fresh.code };
      conflicts.push(change.field);
      continue;
    }
    if (hasRemovedParent(previous.state, fresh.state)) {
      conflicts.push(change.field);
      continue;
    }
    if (isTargetValue(fresh.state, change)) continue;
    if (!sameValue(previous.state, fresh.state, base.content, current.content)) {
      conflicts.push(change.field);
      continue;
    }
    pending.push(change);
  }
  if (conflicts.length) return { status: 'conflict', fields: conflicts };

  let content = current.content;
  for (const change of pending) {
    content = applyEdits(
      content,
      modify(
        content,
        [...fieldPaths[change.field]],
        change.operation === 'set' ? change.value : undefined,
        {}
      )
    );
  }
  return { status: 'ready', content, changedFields: pending.map((change) => change.field) };
};

const versionCopySchema = inputSchema
  .pick({ scope: true, changes: true })
  .extend({
    source: appConfigurationSnapshotSchema,
    currentSource: appConfigurationSnapshotSchema,
    targetVersion: appConfigurationSnapshotSchema.shape.version,
    existingVariants: z.array(appConfigurationSnapshotSchema.omit({ content: true })),
  })
  .strict();

export type AppConfigurationVersionCopyInput = z.infer<typeof versionCopySchema>;
export type AppConfigurationVersionCopyResult =
  | Readonly<{
      status: 'ready';
      sourceId: string;
      target: Omit<AppConfigurationSnapshot, 'id'>;
      changedFields: readonly AppConfigurationField[];
    }>
  | Readonly<{ status: 'conflict'; reason: 'source_changed' | 'target_exists' }>
  | Extract<AppConfigurationReconciliationResult, { status: 'invalid' }>;

/**
 * Prepare a new variant from a confirmed full source, never from a partial form.
 * The caller must authorize creation and supply a complete fresh variant list.
 * This function cannot establish inventory completeness or atomically reserve a version.
 */
export const prepareAppConfigurationVersionCopy = (
  raw: unknown
): AppConfigurationVersionCopyResult => {
  const parsed = versionCopySchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', code: 'invalid_request' };
  const { source, currentSource, targetVersion, existingVariants, scope, changes } = parsed.data;
  if (!sameIdentity(source, currentSource)) return { status: 'invalid', code: 'identity_mismatch' };
  if (
    existingVariants.some(
      (variant) =>
        variant.instanceId !== source.instanceId ||
        variant.name.toLowerCase() !== source.name.toLowerCase()
    )
  )
    return { status: 'invalid', code: 'identity_mismatch' };
  const listedSource = existingVariants.find((variant) => variant.id === source.id);
  if (!listedSource || !sameIdentity({ ...listedSource, content: '' }, source))
    return { status: 'invalid', code: 'identity_mismatch' };
  if (source.content !== currentSource.content)
    return { status: 'conflict', reason: 'source_changed' };
  if (existingVariants.some((variant) => variant.version === targetVersion))
    return { status: 'conflict', reason: 'target_exists' };
  const prepared = reconcileAppConfigurationFields({
    scope,
    base: source,
    current: currentSource,
    changes,
  });
  if (prepared.status !== 'ready') {
    // An unchanged source cannot produce a field conflict; fail closed if that invariant changes.
    return prepared.status === 'invalid'
      ? prepared
      : { status: 'invalid', code: 'invalid_request' };
  }
  return {
    status: 'ready',
    sourceId: source.id,
    target: {
      instanceId: source.instanceId,
      name: source.name,
      dataType: source.dataType,
      version: targetVersion,
      content: prepared.content,
    },
    changedFields: prepared.changedFields,
  };
};

const readbackSchema = z
  .object({
    expected: appConfigurationSnapshotSchema,
    observed: z.discriminatedUnion('status', [
      z.object({ status: z.literal('read'), snapshot: appConfigurationSnapshotSchema }).strict(),
      z.object({ status: z.literal('not_found') }).strict(),
      z.object({ status: z.literal('unavailable') }).strict(),
    ]),
  })
  .strict();

export type AppConfigurationReadbackInput = z.infer<typeof readbackSchema>;
export type AppConfigurationReadbackResult =
  | Readonly<{ status: 'confirmed' }>
  | Readonly<{
      status: 'unconfirmed';
      reason: 'not_found' | 'unavailable' | 'identity_mismatch' | 'content_mismatch';
    }>
  | Readonly<{ status: 'invalid'; code: 'invalid_request' }>;

/**
 * Compare an independent exact read supplied by the host with the intended result.
 * Does not fetch, prove read freshness, attribute an ambiguous create, or authorize access.
 * An unconfirmed result says nothing about whether the preceding write took place.
 */
export const verifyAppConfigurationReadback = (raw: unknown): AppConfigurationReadbackResult => {
  const parsed = readbackSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', code: 'invalid_request' };
  const { expected, observed } = parsed.data;
  if (observed.status !== 'read') return { status: 'unconfirmed', reason: observed.status };
  if (!sameIdentity(expected, observed.snapshot))
    return { status: 'unconfirmed', reason: 'identity_mismatch' };
  if (expected.content !== observed.snapshot.content)
    return { status: 'unconfirmed', reason: 'content_mismatch' };
  return { status: 'confirmed' };
};
