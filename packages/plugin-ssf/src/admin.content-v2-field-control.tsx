import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Input, RichTextHtmlEditor, StudioField, Textarea } from '@sva/studio-ui-react';
import { useMemo } from 'react';

import { createSsfEditorLabels } from './admin.editor-labels.js';
import type { SsfInstallationContentV2Fields, SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

type Path = readonly (string | number)[];
type FormValue = SsfInstallationContentV2Fields | SsfRuntimeContentV2Fields;
type FieldKind = 'text' | 'html' | 'url' | 'number' | 'checkbox' | 'textarea';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readSsfV2Path = (value: unknown, path: Path): unknown =>
  path.reduce<unknown>((current, segment) =>
    Array.isArray(current) && typeof segment === 'number'
      ? current[segment]
      : record(current) && typeof segment === 'string'
        ? current[segment]
        : undefined, value);

const readInheritedPath = (current: unknown, inherited: unknown, path: Path): unknown => {
  let source = current;
  let target = inherited;
  for (const segment of path) {
    if (typeof segment === 'number' && Array.isArray(source) && Array.isArray(target)) {
      const entry = source[segment] as { locale?: string; id?: string } | undefined;
      const identity = entry?.locale ?? entry?.id;
      source = entry;
      target = target.find((candidate: { locale?: string; id?: string }) =>
        (candidate.locale ?? candidate.id) === identity);
    } else if (typeof segment === 'string' && record(source) && record(target)) {
      source = source[segment];
      target = target[segment];
    } else return undefined;
  }
  return target;
};

const setPath = (value: unknown, path: Path, next: unknown): unknown => {
  const [head, ...tail] = path;
  if (head === undefined) return next;
  if (Array.isArray(value) && typeof head === 'number') {
    return value.map((entry, index) => index === head ? setPath(entry, tail, next) : entry);
  }
  if (record(value) && typeof head === 'string') {
    return { ...value, [head]: setPath(value[head], tail, next) };
  }
  throw new Error('ssf_v2_editor_path_invalid');
};

export const updateSsfV2Field = <T extends FormValue>(value: T, path: Path, next: unknown): T =>
  setPath(value, path, next) as T;


export type SsfV2EditorProps<T extends FormValue> = Readonly<{
  value: T;
  onChange: (value: T) => void;
  inherited?: T;
  disabled: boolean;
  errors?: Readonly<Record<string, string>>;
}>;

const parseInput = (raw: string, kind: FieldKind, nullable: boolean, optional: boolean): unknown => {
  if (raw !== '') return kind === 'number' ? Number(raw) : raw;
  if (nullable) return null;
  return optional ? undefined : raw;
};

const EditorControl = ({ id, kind, value, disabled, nullable, optional, set }: {
  id: string; kind: FieldKind; value: unknown; disabled: boolean;
  nullable: boolean; optional: boolean; set: (value: unknown) => void;
}) => {
  const pt = usePluginTranslation('ssf');
  const richText = useMemo(() => createSsfEditorLabels(pt), [pt]);
  if (kind === 'html') return <RichTextHtmlEditor id={id}
    value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={set} {...richText} />;
  if (kind === 'checkbox') return <Checkbox id={id} checked={value === true} disabled={disabled}
    onChange={(event) => set(event.currentTarget.checked)} />;
  if (kind === 'textarea') return <Textarea id={id} value={typeof value === 'string' ? value : ''}
    disabled={disabled} onChange={(event) => set(event.currentTarget.value)} />;
  return <Input id={id} type={kind === 'number' ? 'number' : kind === 'url' ? 'url' : 'text'}
    value={value === null || value === undefined ? '' : String(value)} disabled={disabled}
    onChange={(event) => set(parseInput(event.currentTarget.value, kind, nullable, optional))} />;
};

const ContentField = <T extends FormValue>({
  root, onChange, inherited, disabled, errors, path, labelKey, kind = 'text', nullable = false,
}: Readonly<SsfV2EditorProps<T> & {
  root: T;
  path: Path;
  labelKey: string;
  kind?: FieldKind;
  nullable?: boolean;
}>) => {
  const pt = usePluginTranslation('ssf');
  const value = readSsfV2Path(root, path);
  const inheritedValue = inherited === undefined ? undefined : readInheritedPath(root, inherited, path);
  const overridden = inherited !== undefined && !Object.is(value, inheritedValue);
  const id = `ssf-v2-${path.join('-')}`;
  const set = (next: unknown) => onChange(updateSsfV2Field(root, path, next));
  return (
    <div className="space-y-2">
      <StudioField id={id} label={pt(labelKey)} error={errors?.[path.join('.')]}>
        <EditorControl id={id} kind={kind} value={value} disabled={disabled} nullable={nullable}
          optional={['headline', 'minLabel', 'maxLabel', 'placeholder', 'maxLength'].includes(String(path[path.length - 1]))}
          set={set} />
      </StudioField>
      {inherited !== undefined ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{pt(overridden ? 'v2.overridden' : 'v2.inherited')}</span>
          {overridden ? (
            <Button type="button" variant="tertiary" disabled={disabled} onClick={() => set(inheritedValue)}>
              {pt('fields.inherit')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const SsfV2Field = <T extends FormValue>(props: Readonly<SsfV2EditorProps<T> & { path: Path; labelKey: string; kind?: FieldKind; nullable?: boolean }>) =>
  <ContentField {...props} root={props.value} />;
