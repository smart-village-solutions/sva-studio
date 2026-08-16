import {
  StudioSaveButton,
  type StudioSaveStatus,
  StudioField,
  Textarea,
} from '@sva/studio-ui-react';
import type { FormEventHandler } from 'react';

import {
  WasteOutputBrandingMediaField,
  type WasteOutputTranslate,
} from './waste-management.output-branding-media.js';

export const WasteOutputConfigurationSection = ({
  brandingAssetUrl,
  brandingAssetUrlError,
  contactBlock,
  onSubmit,
  saveStatus,
  setBrandingAssetUrl,
  setContactBlock,
  translate,
}: {
  readonly brandingAssetUrl: string;
  readonly brandingAssetUrlError?: string;
  readonly contactBlock: string;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly saveStatus: StudioSaveStatus;
  readonly setBrandingAssetUrl: (value: string) => void;
  readonly setContactBlock: (value: string) => void;
  readonly translate: WasteOutputTranslate;
}) => (
  <form className="space-y-4" onSubmit={onSubmit}>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{translate('output.pdf.title')}</h3>
        <p className="text-sm text-muted-foreground">{translate('output.pdf.description')}</p>
      </div>
      <WasteOutputBrandingMediaField
        error={brandingAssetUrlError}
        onChange={setBrandingAssetUrl}
        translate={translate}
        value={brandingAssetUrl}
      />
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
        <StudioSaveButton
          type="submit"
          status={saveStatus}
          labels={{
            idle: translate('output.pdf.actions.save'),
            saving: translate('output.pdf.actions.saving'),
            saved: translate('output.pdf.actions.saved'),
          }}
        />
      </div>
    </section>
  </form>
);
