/** Existing recording policy settings and retention controls. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Input, Select, StudioField, StudioSection } from '@sva/studio-ui-react';
import { SsfV2Field as Field } from './admin.content-v2-field-control.js';
import { RecordingWording } from './admin.content-v2-recording-wording.js';
import type { SsfRuntimeEditorProps as Props } from './admin.content-v2-runtime-fields.js';
const RecordingRetentionStatus = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const settings = props.value.recording ?? {};
  const set = (key: string, next: unknown) =>
    props.onChange({ ...props.value, recording: { ...settings, [key]: next } });
  const effectiveHours =
    settings.retentionHours ?? props.inherited?.recording?.retentionHours ?? 720;
  return (
    <>
      <p role="status">
        {pt('v2.recording.effectiveRetention')}: {effectiveHours}
      </p>
      <p>
        {pt(
          props.inherited
            ? settings.retentionHours == null
              ? 'v2.inherited'
              : 'v2.overridden'
            : 'v2.recording.installationDefault'
        )}
      </p>
      {props.inherited ? (
        <Button
          type="button"
          variant="tertiary"
          disabled={props.disabled}
          onClick={() => set('retentionHours', null)}
        >
          {pt('v2.recording.resetRetention')}
        </Button>
      ) : null}
    </>
  );
};

const RecordingChoices = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const settings = props.value.recording ?? {};
  const set = (key: string, next: unknown) =>
    props.onChange({ ...props.value, recording: { ...settings, [key]: next } });
  const choices = {
    legalBasis: ['consent', 'statutory'],
    signature: ['off', 'optional', 'required'],
    idCheck: ['off', 'optional', 'required'],
    recoveryMode: ['standard', 'enhanced'],
  } as const;
  return (
    <>
      {Object.entries(choices).map(([key, options]) => (
        <StudioField key={key} id={`ssf-v2-recording-${key}`} label={pt(`v2.recording.${key}`)}>
          <Select
            id={`ssf-v2-recording-${key}`}
            disabled={props.disabled}
            value={settings[key as keyof typeof choices] ?? ''}
            onChange={(event) => set(key, event.currentTarget.value || undefined)}
          >
            <option value="">{pt('v2.notConfigured')}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {pt(`v2.recording.options.${option}`)}
              </option>
            ))}
          </Select>
        </StudioField>
      ))}
    </>
  );
};

const RecordingRetentionInput = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const settings = props.value.recording ?? {};
  const set = (key: string, next: unknown) =>
    props.onChange({ ...props.value, recording: { ...settings, [key]: next } });
  return (
    <div data-ssf-field="recording.retentionHours">
      <StudioField
        id="ssf-v2-recording-retention"
        label={pt('v2.recording.retentionHours')}
        error={props.errors?.['recording.retentionHours']}
      >
        <Input
          id="ssf-v2-recording-retention"
          type="number"
          min={1}
          max={8760}
          step={1}
          disabled={props.disabled}
          value={settings.retentionHours ?? ''}
          onChange={(event) =>
            set(
              'retentionHours',
              event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
            )
          }
        />
      </StudioField>
    </div>
  );
};

export const RecordingFields = (
  props: Props & { section?: 'settings' | 'retention' | 'wording' }
) => {
  const pt = usePluginTranslation('ssf');
  const settings = props.value.recording ?? {};
  const value = { ...props.value, recording: settings };
  const editor = { ...props, value };
  const set = (key: string, next: unknown) =>
    props.onChange({ ...props.value, recording: { ...settings, [key]: next } });
  return (
    <StudioSection title={pt('v2.recording.title')}>
      <p>{pt('v2.recording.notice')}</p>
      {(!props.section || props.section === 'settings') && props.inherited ? (
        <StudioField
          id="ssf-v2-recording-enabled"
          label={pt('v2.recording.enabled')}
          error={props.errors?.['recording.enabled']}
        >
          <Checkbox
            id="ssf-v2-recording-enabled"
            checked={settings.enabled === true}
            disabled={props.disabled}
            onChange={(event) => set('enabled', event.currentTarget.checked)}
          />
        </StudioField>
      ) : null}
      {!props.section || props.section === 'retention' ? (
        <>
          <RecordingRetentionInput {...props} />
          <RecordingRetentionStatus {...props} />
        </>
      ) : null}
      {!props.section || props.section === 'settings' ? (
        <>
          <RecordingChoices {...props} />
          <Field
            {...editor}
            path={['recording', 'verificationRequired']}
            labelKey="v2.recording.verificationRequired"
            kind="checkbox"
          />
        </>
      ) : null}
      {!props.section || props.section === 'retention' ? (
        <>
          <Field
            {...editor}
            path={['recording', 'timestampAuthorityUrl']}
            labelKey="v2.recording.timestampAuthorityUrl"
            kind="url"
          />
          <Field
            {...editor}
            path={['recording', 'auditRetentionHours']}
            labelKey="v2.recording.auditRetentionHours"
            kind="number"
          />
        </>
      ) : null}
      {!props.section || props.section === 'wording' ? <RecordingWording {...props} /> : null}
    </StudioSection>
  );
};
