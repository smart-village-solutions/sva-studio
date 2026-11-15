import { Button, Input, Select } from '@sva/studio-ui-react';
import type { LoadedAppConfigurationPreview as Loaded } from '@sva/sva-mainserver';
import { t } from '../../i18n';
import type {
  AppConfigurationDraft,
  AppConfigurationPreviewField,
} from './-use-app-configuration-preview';
const text = (key: string) => t(`interfaces.appConfiguration.${key}`);
const showField = (field: AppConfigurationPreviewField): string =>
  field.state === 'value'
    ? typeof field.value === 'boolean'
      ? text(field.value ? 'yes' : 'no')
      : String(field.value)
    : text(field.state);

export const AppConfigurationFields = ({
  source,
  draft,
  invalidLines,
  onChange,
  onLinesTouched,
}: Readonly<{
  source: Loaded;
  draft: AppConfigurationDraft;
  invalidLines: boolean;
  onChange: (draft: AppConfigurationDraft) => void;
  onLinesTouched: () => void;
}>) => (
  <div className="grid gap-4 md:grid-cols-2">
    <fieldset className="min-w-0 space-y-3 rounded-md border p-4">
      <legend className="px-1 font-medium">{text('general')}</legend>
      <label htmlFor="app-configuration-location" className="block text-sm font-medium">
        {text('alternativeLocation')}
      </label>
      <Select
        id="app-configuration-location"
        value={draft.alternativeLocation}
        onChange={(event) => onChange({ ...draft, alternativeLocation: event.target.value })}
      >
        {source.fields.alternativeLocation.state === 'unsupported' ? (
          <option value="unsupported" disabled>
            {text('unsupported')}
          </option>
        ) : null}
        <option value="missing">{text('missing')}</option>
        <option value="true">{text('yes')}</option>
        <option value="false">{text('no')}</option>
      </Select>
      {source.fields.alternativeLocation.state === 'unsupported' ? (
        <p className="text-sm text-muted-foreground">{text('unsupportedHelp')}</p>
      ) : null}
    </fieldset>
    <fieldset className="min-w-0 space-y-3 rounded-md border p-4">
      <legend className="px-1 font-medium">{text('design')}</legend>
      <label htmlFor="app-configuration-lines" className="block text-sm font-medium">
        {text('lines')}
      </label>
      <Input
        id="app-configuration-lines"
        type="number"
        min={1}
        step={1}
        value={draft.tileTitleLines}
        aria-invalid={invalidLines || undefined}
        aria-describedby="app-configuration-lines-help"
        onChange={(event) => {
          onChange({ ...draft, tileTitleLines: event.target.value });
          onLinesTouched();
        }}
      />
      <p id="app-configuration-lines-help" className="text-sm text-muted-foreground">
        {text('linesHelp')}
      </p>
      {source.fields.tileTitleLines.state === 'unsupported' ? (
        <p className="text-sm text-muted-foreground">{text('unsupportedHelp')}</p>
      ) : null}
      {invalidLines ? (
        <p role="alert" className="text-sm text-destructive">
          {text('linesError')}
        </p>
      ) : null}
    </fieldset>
  </div>
);
export const AppConfigurationChanges = ({
  changes,
  invalidLines,
  dirty,
  discard,
}: Readonly<{
  changes: readonly {
    key: string;
    before: AppConfigurationPreviewField;
    after: AppConfigurationPreviewField;
  }[];
  invalidLines: boolean;
  dirty: boolean;
  discard: () => void;
}>) => (
  <section aria-labelledby="app-configuration-changes-heading" className="space-y-3">
    <h3 id="app-configuration-changes-heading" className="font-medium">
      {text('preview')}
    </h3>
    {invalidLines ? (
      <p role="status">{text('invalidPreview')}</p>
    ) : changes.length ? (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{text('preview')}</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2">
                {text('field')}
              </th>
              <th scope="col" className="p-2">
                {text('before')}
              </th>
              <th scope="col" className="p-2">
                {text('after')}
              </th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.key} className="border-t">
                <th scope="row" className="p-2 font-medium">
                  {text(change.key)}
                </th>
                <td className="p-2">{showField(change.before)}</td>
                <td className="p-2">{showField(change.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p role="status" className="text-sm text-muted-foreground">
        {text('noChanges')}
      </p>
    )}
    <Button type="button" variant="secondary" disabled={!dirty} onClick={discard}>
      {text('discard')}
    </Button>
  </section>
);

const showVersion = (version: string | null): string => version ?? text('unversioned');
export const AppConfigurationRecord = ({ source }: Readonly<{ source: Loaded }>) => (
  <section aria-label={text('loaded')} className="space-y-2 rounded-md border p-4">
    <h3 className="font-medium">{text('loaded')}</h3>
    <dl className="grid gap-2 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">{text('record')}</dt>
        <dd>
          {source.record.name} · {source.record.id}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{text('requestedVersion')}</dt>
        <dd>{showVersion(source.requestedVersion)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{text('actualVersion')}</dt>
        <dd>{showVersion(source.record.version)}</dd>
      </div>
    </dl>
  </section>
);
