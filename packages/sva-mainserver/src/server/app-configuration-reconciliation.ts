import {
  applyEdits,
  getNodeValue,
  modify,
  parseTree,
  type Node,
  type ParseError,
} from 'jsonc-parser';
import type { AppConfigurationFields, AppConfigurationSave } from '../app-configuration.js';

const paths = {
  alternativeLocation: ['settings', 'locationService', 'showAlternativeLocationButton'],
  tileTitleLines: ['appDesignSystem', 'serviceTiles', 'numberOfLines'],
} as const;

type Field = keyof typeof paths;
const fields = Object.keys(paths) as Field[];

const readNode = (root: Node, path: readonly string[]): Node | undefined | null => {
  let node: Node | undefined = root;
  for (const key of path) {
    if (!node) return undefined;
    if (node.type !== 'object') return null;
    const matches: Node[] =
      node.children?.filter((property) => property.children?.[0]?.value === key) ?? [];
    if (matches.length > 1) return null;
    node = matches[0]?.children?.[1];
  }
  return node;
};

const state = <T>(node: Node | undefined | null, valid: (value: unknown) => value is T) => {
  if (node === undefined) return { state: 'missing' as const };
  const value: unknown = node ? getNodeValue(node) : null;
  return valid(value) ? { state: 'value' as const, value } : { state: 'unsupported' as const };
};

export const readAppConfigurationFields = (raw: string): AppConfigurationFields | null => {
  try {
    JSON.parse(raw);
  } catch {
    return null;
  }
  const errors: ParseError[] = [];
  const root = parseTree(raw, errors, { disallowComments: true });
  if (root?.type !== 'object' || errors.length) return null;
  return {
    alternativeLocation: state(
      readNode(root, paths.alternativeLocation),
      (value): value is boolean => typeof value === 'boolean'
    ),
    tileTitleLines: state(
      readNode(root, paths.tileTitleLines),
      (value): value is number =>
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ),
  };
};

const valueOf = (field: AppConfigurationFields[Field]) =>
  field.state === 'value' ? field.value : field.state === 'missing' ? null : undefined;

export const reconcileAppConfiguration = (
  raw: string,
  current: AppConfigurationFields,
  revision: string,
  input: AppConfigurationSave
) => {
  const changed = fields.filter(
    (field) =>
      input.changes[field] !== undefined && input.changes[field] !== valueOf(input.baseline[field])
  );
  if (
    changed.some(
      (field) =>
        current[field].state === 'unsupported' || input.baseline[field].state === 'unsupported'
    )
  )
    return { status: 'unsupported' as const };
  const conflicts = changed.filter((field) => {
    const value = valueOf(current[field]);
    return value !== valueOf(input.baseline[field]) && value !== input.changes[field];
  });
  if (
    (revision !== input.baselineRevision && input.reviewedRevision !== revision) ||
    conflicts.some((field) => !input.choices?.[field])
  )
    return { status: 'review' as const, conflicts };
  let content = raw;
  for (const field of changed) {
    const wanted = input.changes[field];
    if (input.choices?.[field] === 'mainserver' || wanted === valueOf(current[field])) continue;
    content = applyEdits(content, modify(content, [...paths[field]], wanted ?? undefined, {}));
  }
  return { status: 'ready' as const, content };
};
