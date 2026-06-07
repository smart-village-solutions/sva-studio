import {
  Button,
  Input,
  StudioField,
  Textarea,
} from '@sva/studio-ui-react';
import type { FormEventHandler } from 'react';

type OutputTranslate = (key: string, variables?: Record<string, string | number>) => string;

export const WasteOutputConfigurationSection = ({
  brandingAssetUrl,
  contactBlock,
  onSubmit,
  running,
  setBrandingAssetUrl,
  setContactBlock,
  translate,
}: {
  readonly brandingAssetUrl: string;
  readonly contactBlock: string;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly running: boolean;
  readonly setBrandingAssetUrl: (value: string) => void;
  readonly setContactBlock: (value: string) => void;
  readonly translate: OutputTranslate;
}) => (
  <form className="space-y-4" onSubmit={onSubmit}>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{translate('output.pdf.title')}</h3>
        <p className="text-sm text-muted-foreground">{translate('output.pdf.description')}</p>
      </div>
      <StudioField
        id="waste-output-branding-asset-url"
        label={translate('output.pdf.fields.brandingAssetUrl')}
        description={translate('output.pdf.fieldHints.brandingAssetUrl')}
      >
        <Input
          id="waste-output-branding-asset-url"
          type="url"
          placeholder="https://cdn.example/logo.svg"
          value={brandingAssetUrl}
          onChange={(event) => setBrandingAssetUrl(event.target.value)}
        />
      </StudioField>
      <StudioField
        id="waste-output-contact-block"
        label={translate('output.pdf.fields.contactBlock')}
        description={translate('output.pdf.fieldHints.contactBlock')}
      >
        <Textarea
          id="waste-output-contact-block"
          rows={5}
          maxLength={2_000}
          value={contactBlock}
          onChange={(event) => setContactBlock(event.target.value)}
        />
      </StudioField>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{translate('output.pdf.meta.runtimeHint')}</p>
        <Button type="submit" disabled={running}>
          {running ? translate('output.pdf.actions.saving') : translate('output.pdf.actions.save')}
        </Button>
      </div>
    </section>
  </form>
);
