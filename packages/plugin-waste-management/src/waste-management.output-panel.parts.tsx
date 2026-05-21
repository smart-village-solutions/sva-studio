import {
  Button,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import type { FormEventHandler } from 'react';

import type { WasteManagementOutputPdfResult } from './waste-management.api.js';
import { formatUpdatedAt } from './waste-management.page.support.js';
import type { OutputLocationOption } from './waste-management.output-panel.model.js';

type OutputTranslate = (key: string, variables?: Record<string, string | number>) => string;

const outputPdfLinkClassName =
  'inline-flex items-center rounded-lg border border-border/70 px-3 py-2 text-sm font-medium text-primary underline-offset-2 hover:underline';

const OutputPdfLink = ({
  href,
  label,
}: {
  readonly href: string;
  readonly label: string;
}) => (
  <a href={href} target="_blank" rel="noreferrer" className={outputPdfLinkClassName}>
    {label}
  </a>
);

export const WasteOutputFormSection = ({
  collectionLocationOptions,
  onSubmit,
  running,
  selectedLocationId,
  setSelectedLocationId,
  setYear,
  translate,
  year,
  yearValid,
}: {
  readonly collectionLocationOptions: readonly OutputLocationOption[];
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly running: boolean;
  readonly selectedLocationId: string;
  readonly setSelectedLocationId: (value: string) => void;
  readonly setYear: (value: string) => void;
  readonly translate: OutputTranslate;
  readonly year: string;
  readonly yearValid: boolean;
}) => (
  <form className="space-y-4" onSubmit={onSubmit}>
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{translate('output.pdf.title')}</h3>
      <p className="text-sm text-muted-foreground">{translate('output.pdf.description')}</p>
    </div>
    <StudioFieldGroup>
      <StudioField id="waste-output-location" label={translate('output.pdf.fields.collectionLocationId')}>
        <Select id="waste-output-location" value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>
          <option value="">{translate('output.pdf.fields.collectionLocationUnset')}</option>
          {collectionLocationOptions.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField id="waste-output-year" label={translate('output.pdf.fields.year')}>
        <Input id="waste-output-year" type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(event.target.value)} />
      </StudioField>
    </StudioFieldGroup>
    <Button type="submit" disabled={running || !selectedLocationId || !yearValid}>
      {running ? translate('output.pdf.actions.generating') : translate('output.pdf.actions.generate')}
    </Button>
  </form>
);

export const WasteOutputExistingSection = ({
  pdfs,
  selectedLocationId,
  translate,
}: {
  readonly pdfs: readonly { year: number; deliveryUrl: string }[];
  readonly selectedLocationId: string;
  readonly translate: OutputTranslate;
}) => (
  <section className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-4">
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{translate('output.pdf.existing.title')}</h3>
      <p className="text-sm text-muted-foreground">{translate('output.pdf.result.description')}</p>
    </div>
    {pdfs.length ? (
      <div className="flex flex-wrap gap-3">
        {pdfs.map((pdf) => (
          <OutputPdfLink
            key={`${selectedLocationId}-${pdf.year}`}
            href={pdf.deliveryUrl}
            label={translate('output.pdf.existing.yearLabel', { value: pdf.year })}
          />
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">{translate('output.pdf.existing.empty')}</p>
    )}
  </section>
);

export const WasteOutputLatestResultSection = ({
  result,
  translate,
}: {
  readonly result: WasteManagementOutputPdfResult;
  readonly translate: OutputTranslate;
}) => (
  <section className="space-y-2 rounded-xl border border-border/60 bg-card/60 p-4">
    <h3 className="text-sm font-semibold">{translate('output.pdf.result.title')}</h3>
    <div className="flex flex-wrap items-center gap-3">
      <OutputPdfLink href={result.deliveryUrl} label={translate('output.pdf.actions.open')} />
      <span className="text-sm text-muted-foreground">{translate('output.pdf.existing.yearLabel', { value: result.year })}</span>
      <span className="text-sm text-muted-foreground">{formatUpdatedAt(result.expiresAt)}</span>
    </div>
  </section>
);
