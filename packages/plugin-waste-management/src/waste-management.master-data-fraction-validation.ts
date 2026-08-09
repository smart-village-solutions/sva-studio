import type { usePluginTranslation } from '@sva/plugin-sdk';

import type { FractionFormState } from './waste-management.master-data.forms.js';

export type FractionFormErrors = {
  readonly name?: string;
  readonly pdfShortLabel?: string;
  readonly color?: string;
};

export const isHexColor = (value: string) =>
  /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

export const validateFractionForm = (
  form: FractionFormState,
  pt: ReturnType<typeof usePluginTranslation>
): FractionFormErrors => ({
  name: form.name.trim()
    ? undefined
    : pt('masterData.fractions.createView.validation.nameRequired'),
  pdfShortLabel: form.pdfShortLabel.trim()
    ? undefined
    : pt('masterData.fractions.createView.validation.pdfShortLabelRequired'),
  color: isHexColor(form.color)
    ? undefined
    : pt('masterData.fractions.createView.validation.colorRequired'),
});
