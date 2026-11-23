import React from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button, Input, Select, useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import type {
  AppConfigurationDocument,
  AppConfigurationFields,
  AppConfigurationSave,
} from '@sva/sva-mainserver';
import { saveAppConfiguration } from '../../lib/app-configuration-sync-api';
import { t } from '../../i18n';

const text = (key: string) => t(`interfaces.appConfiguration.${key}`);
type Field = keyof AppConfigurationFields;
type Review = { document: AppConfigurationDocument; conflicts: Field[] };
const fields: Field[] = ['alternativeLocation', 'tileTitleLines'];
const label = (field: Field) => text(field === 'tileTitleLines' ? 'lines' : field);
const display = (field: AppConfigurationFields[Field] | undefined) =>
  field?.state === 'value'
    ? typeof field.value === 'boolean'
      ? text(field.value ? 'yes' : 'no')
      : String(field.value)
    : text(field?.state ?? 'missing');

const initialValues = (f: AppConfigurationFields | null) => ({
  location: f?.alternativeLocation.state === 'value' ? String(f.alternativeLocation.value) : '',
  lines: f?.tileTitleLines.state === 'value' ? String(f.tileTitleLines.value) : '',
});

const changedValues = (
  draft: ReturnType<typeof initialValues>,
  initial: ReturnType<typeof initialValues>
): AppConfigurationSave['changes'] => ({
  ...(draft.location !== initial.location
    ? { alternativeLocation: draft.location === '' ? null : draft.location === 'true' }
    : {}),
  ...(draft.lines !== initial.lines
    ? { tileTitleLines: draft.lines === '' ? null : Number(draft.lines) }
    : {}),
});

export function ConfigurationForm({
  entry,
  reportDirty,
  onSaved,
  canWrite,
}: {
  entry: AppConfigurationDocument;
  reportDirty: (dirty: boolean) => void;
  onSaved: (document: AppConfigurationDocument) => void;
  canWrite: boolean;
}) {
  const save = useServerFn(saveAppConfiguration);
  const [baseline, setBaseline] = React.useState(entry);
  const [draft, setDraft] = React.useState(() => initialValues(entry.fields));
  const [review, setReview] = React.useState<Review>();
  const [choices, setChoices] = React.useState<AppConfigurationSave['choices']>();
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const initial = initialValues(baseline.fields);
  const dirty = draft.location !== initial.location || draft.lines !== initial.lines;
  React.useLayoutEffect(() => reportDirty(dirty), [dirty, reportDirty]);
  const discard = () => {
    setDraft(initial);
    setReview(undefined);
    setChoices(undefined);
    setFeedback('');
  };
  useStudioEditorLeaveGuard({ enabled: true, hasUnsavedChanges: dirty, onDiscard: discard });
  const invalid =
    draft.lines !== '' && (!Number.isSafeInteger(Number(draft.lines)) || Number(draft.lines) <= 0);
  const changes = changedValues(draft, initial);
  const submit = async () => {
    if (!baseline.fields || !dirty || busy || invalid || !canWrite) return;
    setBusy(true);
    setFeedback('');
    try {
      const response = await save({
        data: {
          id: baseline.id,
          baselineRevision: baseline.revision,
          baseline: baseline.fields,
          changes,
          reviewedRevision: review?.document.revision,
          choices,
        },
      });
      if (!response.ok) throw new Error();
      const result = response.data;
      if (result.status === 'saved') {
        setBaseline(result.document);
        setDraft(initialValues(result.document.fields));
        onSaved(result.document);
        setReview(undefined);
        setChoices(undefined);
        setFeedback('saved');
      } else if (result.status === 'review') {
        setReview(result);
        setChoices(undefined);
      } else {
        setFeedback(result.status === 'missing' ? 'variantMissing' : result.status);
      }
    } catch {
      setFeedback('unconfirmed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="space-y-4 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ConfigurationFieldInputs
        baseline={baseline}
        draft={draft}
        invalid={invalid}
        disabled={!canWrite || busy}
        change={(next) => {
          setDraft(next);
          setReview(undefined);
          setChoices(undefined);
        }}
      />
      {review && (
        <ConflictTable
          review={review}
          baseline={baseline}
          changes={changes}
          choices={choices}
          choose={(field, value) => setChoices((previous) => ({ ...previous, [field]: value }))}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            !canWrite ||
            !dirty ||
            busy ||
            invalid ||
            review?.conflicts.some((field) => !choices?.[field])
          }
        >
          {text(review ? 'confirmSync' : 'save')}
        </Button>
        <Button type="button" variant="secondary" disabled={!dirty || busy} onClick={discard}>
          {text('discard')}
        </Button>
      </div>
      {feedback && <p role={feedback === 'saved' ? 'status' : 'alert'}>{text(feedback)}</p>}
    </form>
  );
}

function ConfigurationFieldInputs({
  baseline,
  draft,
  invalid,
  disabled,
  change,
}: {
  baseline: AppConfigurationDocument;
  draft: ReturnType<typeof initialValues>;
  invalid: boolean;
  disabled: boolean;
  change: (draft: ReturnType<typeof initialValues>) => void;
}) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1">
        <span>
          {text('general')} · {label('alternativeLocation')}
        </span>
        <Select
          value={draft.location}
          disabled={baseline.fields?.alternativeLocation.state === 'unsupported'}
          onChange={(event) => change({ ...draft, location: event.target.value })}
        >
          <option value="">
            {display(
              baseline.fields?.alternativeLocation.state === 'unsupported'
                ? baseline.fields.alternativeLocation
                : undefined
            )}
          </option>
          <option value="true">{text('yes')}</option>
          <option value="false">{text('no')}</option>
        </Select>
      </label>
      <label className="space-y-1">
        <span>
          {text('design')} · {label('tileTitleLines')}
        </span>
        <Input
          type="number"
          min={1}
          step={1}
          aria-invalid={invalid}
          value={draft.lines}
          disabled={baseline.fields?.tileTitleLines.state === 'unsupported'}
          onChange={(event) => change({ ...draft, lines: event.target.value })}
        />
        {invalid && <span role="alert">{text('linesError')}</span>}
        {baseline.fields?.tileTitleLines.state === 'unsupported' && (
          <span>{text('unsupported')}</span>
        )}
      </label>
    </fieldset>
  );
}

function ConflictTable({
  review,
  baseline,
  changes,
  choices,
  choose,
}: {
  review: Review;
  baseline: AppConfigurationDocument;
  changes: AppConfigurationSave['changes'];
  choices: AppConfigurationSave['choices'];
  choose: (field: Field, value: 'studio' | 'mainserver' | undefined) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2 rounded-md border p-3">
      <legend className="px-1 font-medium">{text('reviewTitle')}</legend>
      <p role="status">{text('reviewHelp')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {['field', 'before', 'after', 'mainserverValue', 'choice'].map((k) => (
                <th key={k} scope="col" className="p-2">
                  {text(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const edited = changes[field];
              return (
                <tr key={field}>
                  <th scope="row" className="p-2">
                    {label(field)}
                  </th>
                  <td className="p-2">{display(baseline.fields?.[field])}</td>
                  <td className="p-2">
                    {edited === undefined
                      ? display(baseline.fields?.[field])
                      : display(edited === null ? undefined : { state: 'value', value: edited })}
                  </td>
                  <td className="p-2">{display(review.document.fields?.[field])}</td>
                  <td className="p-2">
                    {review.conflicts.includes(field) && (
                      <Select
                        aria-label={label(field)}
                        value={choices?.[field] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          choose(
                            field,
                            value === 'studio' || value === 'mainserver' ? value : undefined
                          );
                        }}
                      >
                        <option value="">{text('chooseValue')}</option>
                        <option value="studio">{text('keepStudio')}</option>
                        <option value="mainserver">{text('keepMainserver')}</option>
                      </Select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
