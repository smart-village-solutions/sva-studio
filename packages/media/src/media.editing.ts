/** Bounded, portable Filerobot documents. Origin URLs are supplied only at editor load time. */
export type MediaEditorValue =
  null | boolean | number | string | MediaEditorValue[] | MediaEditorObject;
export type MediaEditorObject = { [key: string]: MediaEditorValue };
export type MediaEditingDocument = Readonly<{
  version: 1;
  editor: 'filerobot';
  editorVersion: '5.0.0-beta.159';
  state: MediaEditorObject;
}>;

export const mediaEditingLimits = {
  documentBytes: 8 * 1024 * 1024,
  resourceBytes: 4 * 1024 * 1024,
  annotations: 200,
  nodes: 12000,
  depth: 12,
} as const;

const stateKeys = new Set([
  'finetunes',
  'finetunesProps',
  'filter',
  'adjustments',
  'annotationIds',
  'annotations',
  'resize',
  'shownImageDimensions',
]);
const sourceKeys = new Set(['imgSrc', 'originalSource', 'presentOriginalSources']);
const resourceKeys = new Set(['image', 'originalImage', 'src', 'url', 'originalUrl', 'previewUrl']);
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const inlineImagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const invalidDocument = (): never => {
  throw new Error('invalid_media_editor_document');
};

const validateString = (value: string, key: string): string => {
  if (resourceKeys.has(key)) {
    if (
      !inlineImagePattern.test(value) ||
      value.length > (mediaEditingLimits.resourceBytes * 4) / 3 + 64
    )
      return invalidDocument();
  } else if (value.length > 16000) return invalidDocument();
  return value;
};

const copyObject = (value: object, depth: number, budget: { nodes: number }): MediaEditorObject => {
  if (Object.getPrototypeOf(value) !== Object.prototype) return invalidDocument();
  const object: MediaEditorObject = {};
  for (const [childKey, child] of Object.entries(value)) {
    if (forbiddenKeys.has(childKey) || childKey.length > 128 || child === undefined)
      return invalidDocument();
    if (resourceKeys.has(childKey) && typeof child !== 'string') return invalidDocument();
    object[childKey] = copyJson(child, depth + 1, budget, childKey);
  }
  return object;
};

const copyJson = (
  value: unknown,
  depth: number,
  budget: { nodes: number },
  key = ''
): MediaEditorValue => {
  budget.nodes += 1;
  if (depth > mediaEditingLimits.depth || budget.nodes > mediaEditingLimits.nodes)
    return invalidDocument();
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1e8) return invalidDocument();
    return value;
  }
  if (typeof value === 'string') return validateString(value, key);
  if (Array.isArray(value)) return value.map((item) => copyJson(item, depth + 1, budget, key));
  if (typeof value !== 'object') return invalidDocument();
  return copyObject(value, depth, budget);
};

/** Strip transient source handles from a library export, then validate the portable document. */
export const createMediaEditingDocument = (input: unknown): MediaEditingDocument => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return invalidDocument();
  const state: MediaEditorObject = {};
  const budget = { nodes: 0 };
  for (const [key, value] of Object.entries(input)) {
    if (sourceKeys.has(key)) continue;
    if (!stateKeys.has(key)) return invalidDocument();
    state[key] = copyJson(value, 0, budget);
  }
  const annotations = state.annotations;
  if (
    annotations !== undefined &&
    (annotations === null ||
      Array.isArray(annotations) ||
      typeof annotations !== 'object' ||
      Object.keys(annotations).length > mediaEditingLimits.annotations)
  )
    return invalidDocument();
  const document: MediaEditingDocument = {
    version: 1,
    editor: 'filerobot',
    editorVersion: '5.0.0-beta.159',
    state,
  };
  if (
    new TextEncoder().encode(JSON.stringify(document)).byteLength > mediaEditingLimits.documentBytes
  )
    return invalidDocument();
  return document;
};

/** Validate the persisted envelope, including version compatibility, at both trust boundaries. */
export const parseMediaEditingDocument = (input: unknown): MediaEditingDocument => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return invalidDocument();
  const value = input as Record<string, unknown>;
  if (
    value.version !== 1 ||
    value.editor !== 'filerobot' ||
    value.editorVersion !== '5.0.0-beta.159' ||
    Object.keys(value).some((key) => !['version', 'editor', 'editorVersion', 'state'].includes(key))
  )
    return invalidDocument();
  return createMediaEditingDocument(value.state);
};

/** Inline annotation resources are private data and must pass the existing upload scan. */
export const getMediaEditingResources = (document: MediaEditingDocument): readonly string[] => {
  const resources = new Set<string>();
  const visit = (value: MediaEditorValue, key = ''): void => {
    if (typeof value === 'string' && resourceKeys.has(key)) resources.add(value);
    else if (Array.isArray(value)) value.forEach((item) => visit(item, key));
    else if (value !== null && typeof value === 'object')
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  };
  visit(document.state);
  return [...resources];
};
