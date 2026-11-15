/** Recording locale drafts retain stable row identities. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioSection } from '@sva/studio-ui-react';
import { useEffect, useRef, useState } from 'react';
import { SsfV2Field as Field, SsfLanguageVersionSelect } from './admin.content-v2-field-control.js';
import type { SsfRuntimeEditorProps as Props } from './admin.content-v2-runtime-fields.js';
const RecordingTextFields = ({ props, index }: { props: Props; index: number }) => {
  const value = { ...props.value, recording: props.value.recording ?? {} };
  return (
    <>
      {(['locale', 'consentHtml', 'resumePromptHtml'] as const).map((key) => (
        <Field
          key={key}
          {...props}
          value={value}
          path={['recording', 'texts', index, key]}
          labelKey={key === 'locale' ? 'v2.locale' : `v2.recording.${key}`}
          kind={key === 'locale' ? 'text' : 'html'}
        />
      ))}
    </>
  );
};

export const RecordingWording = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const counter = useRef(0);
  const ids = useRef((props.value.recording?.texts ?? []).map(() => `text-${counter.current++}`));
  const [selected, setSelected] = useState(ids.current[0] ?? '');
  const texts = props.value.recording?.texts ?? [];
  while (ids.current.length < texts.length) ids.current.push(`text-${counter.current++}`);
  const active = ids.current.includes(selected) ? selected : (ids.current[0] ?? '');
  const index = ids.current.indexOf(active);
  const setTexts = (next: typeof texts) =>
    props.onChange({ ...props.value, recording: { ...props.value.recording, texts: next } });
  useEffect(() => {
    const path = Object.keys(props.errors ?? {}).find((key) => key.startsWith('recording.texts.'));
    const invalid = path ? Number(path.split('.')[2]) : -1;
    if (ids.current[invalid]) setSelected(ids.current[invalid]!);
  }, [props.errors]);
  return (
    <StudioSection title={pt('administration.recordingWording')}>
      {texts.length ? (
        <>
          <SsfLanguageVersionSelect
            entries={texts.map((entry, i) => ({ id: ids.current[i]!, locale: entry.locale }))}
            selected={active}
            onSelect={setSelected}
            catalog={props.supportedLanguages}
          />
          {index >= 0 ? (
            <div key={active} className="space-y-3">
              <RecordingTextFields props={props} index={index} />
              <Button
                type="button"
                variant="tertiary"
                disabled={props.disabled}
                onClick={() => {
                  ids.current.splice(index, 1);
                  setTexts(texts.filter((_, i) => i !== index));
                  setSelected(ids.current[0] ?? '');
                }}
              >
                {pt('v2.recording.removeText')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={props.disabled || texts.length >= 40}
        onClick={() => {
          const id = `text-${counter.current++}`;
          ids.current.push(id);
          setSelected(id);
          setTexts([...texts, { locale: '', consentHtml: '', resumePromptHtml: '' }]);
        }}
      >
        {pt('v2.recording.addText')}
      </Button>
    </StudioSection>
  );
};
